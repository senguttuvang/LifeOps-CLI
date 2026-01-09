/**
 * WhatsApp Domain Errors
 *
 * Tagged error classes for WhatsApp domain operations
 */

import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("WhatsApp/DatabaseError")<{
  readonly message: string;
  readonly query: string | undefined;
}> {}

export class ClaudeError extends Data.TaggedError("WhatsApp/ClaudeError")<{
  readonly message: string;
  readonly prompt: string | undefined;
}> {}

export class ValidationError extends Data.TaggedError("WhatsApp/ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}
