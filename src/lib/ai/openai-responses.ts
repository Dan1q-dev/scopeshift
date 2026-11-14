import "server-only";
import { z } from "zod";

const ENDPOINT = "https://api.openai.com/v1/responses";
const MAX_RESPONSE_BYTES = 262_144;

export type OpenAIProviderErrorKind = "configuration" | "rate_limit" | "timeout" | "unavailable" | "invalid_response" | "refused";

export class OpenAIProviderError extends Error {
  constructor(public readonly kind: OpenAIProviderErrorKind, message: string) {
    super(message);
    this.name = "OpenAIProviderError";
  }
}

export interface OpenAIRequestConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

// Zod uses oneOf for discriminated unions; their mutually exclusive kind
// literals make anyOf equivalent and compatible with OpenAI's schema subset.
export function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$schema")
        .map(([key, item]) => [key === "oneOf" ? "anyOf" : key, providerSchema(item)]),
    );
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new OpenAIProviderError("invalid_response", "OpenAI returned an oversized response.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new OpenAIProviderError("invalid_response", "OpenAI returned an empty response.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new OpenAIProviderError("invalid_response", "OpenAI returned an oversized response.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof OpenAIProviderError) throw error;
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) throw error;
    throw new OpenAIProviderError("invalid_response", "OpenAI returned invalid response data.");
  } finally {
    reader.releaseLock();
  }
}

const outputSchema = z.object({
  status: z.string(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).optional(),
  }).passthrough()),
}).passthrough();

export interface StructuredOpenAICallerOptions<T> {
  config: OpenAIRequestConfig;
  schema: z.ZodType<T>;
  schemaName: string;
  instructions: string;
  maxOutputTokens?: number;
  incompleteMessage: string;
  refusedMessage: string;
  invalidMessage: string;
  fetch?: typeof fetch;
}

export function createStructuredOpenAICaller<T>(options: StructuredOpenAICallerOptions<T>) {
  const apiKey = options.config.apiKey.trim();
  const model = options.config.model.trim();
  const timeoutMs = options.config.timeoutMs ?? 20_000;
  if (!apiKey || !/^[a-zA-Z0-9._:-]{1,120}$/.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new OpenAIProviderError("configuration", "OpenAI configuration is missing or invalid.");
  }
  const fetchResponse = options.fetch ?? fetch;
  const schema = providerSchema(z.toJSONSchema(options.schema));

  return async function callOpenAI(input: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchResponse(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: options.maxOutputTokens ?? 2_000,
          ...(/^(?:gpt-[56]|o[134])/.test(model) ? { reasoning: { effort: "low" } } : {}),
          instructions: options.instructions,
          input: [{ role: "user", content: typeof input === "string" ? input : JSON.stringify(input) }],
          text: { format: { type: "json_schema", name: options.schemaName, strict: true, schema } },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) throw new OpenAIProviderError("configuration", "OpenAI access is not configured for this application.");
        if (response.status === 429) throw new OpenAIProviderError("rate_limit", "OpenAI is temporarily rate limited. Please try again later.");
        throw new OpenAIProviderError("unavailable", "OpenAI is temporarily unavailable. Please try again.");
      }
      const parsedResponse = outputSchema.safeParse(await readJson(response));
      if (!parsedResponse.success) throw new OpenAIProviderError("invalid_response", "OpenAI returned an unexpected response format.");
      if (parsedResponse.data.status !== "completed") {
        throw new OpenAIProviderError("invalid_response", options.incompleteMessage);
      }
      const content = parsedResponse.data.output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []);
      if (content.some((item) => item.type === "refusal")) {
        throw new OpenAIProviderError("refused", options.refusedMessage);
      }
      const text = content.filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("");
      try {
        return options.schema.parse(JSON.parse(text));
      } catch {
        throw new OpenAIProviderError("invalid_response", options.invalidMessage);
      }
    } catch (error) {
      if (error instanceof OpenAIProviderError) throw error;
      if (controller.signal.aborted || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) {
        throw new OpenAIProviderError("timeout", "OpenAI took too long to respond. Please try again.");
      }
      throw new OpenAIProviderError("unavailable", "OpenAI could not be reached. Please try again.");
    } finally {
      clearTimeout(timer);
    }
  };
}
