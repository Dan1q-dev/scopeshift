# Negotiation interpretation

`SCOPESHIFT_AI_MODE=rules` runs the deterministic, bounded English interpreter.
`SCOPESHIFT_AI_MODE=openai` uses the server-only OpenAI Responses adapter with
structured output and shared Zod validation. The API identifies the selected
mode in `X-ScopeShift-Interpreter`. OpenAI failures do not fall back to rules.

The engine makes all client acceptance decisions, computes money and estimates,
and generates replies from those actual decisions. A provider must never assign
the project state or bypass scenario policies.

The client initializes a signed anonymous cookie before paid calls. Validated
OpenAI actions and canonical engine turns are persisted by `FileReplayStore`,
bound to the exact history and model/engine version. Old turns are read from
receipts. Only the latest new turn can invoke OpenAI. The local filesystem
adapter is not a Vercel storage solution. See `docs/OPENAI_SETUP.md`.
