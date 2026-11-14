import type { RealApiErrorCode } from "@/types/real-project";

export class RealProjectError extends Error {
  constructor(public readonly status: number, public readonly code: RealApiErrorCode, message: string) {
    super(message);
    this.name = "RealProjectError";
  }
}
