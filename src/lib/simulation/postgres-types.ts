/** Minimal SQL boundary shared by the durable stores and their test clients. */
export interface SqlClient {
  query(text: string, values?: unknown[]): Promise<{
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }>;
}
