/**
 * Tagged Error Tests
 *
 * Tests Effect-TS error handling patterns with Data.TaggedError.
 * Verifies error creation, catchTag patterns, and error propagation.
 */

import { describe, it, expect } from "vitest";
import { Effect, Exit, Cause, Data } from "effect";

// =============================================================================
// TEST ERROR TYPES
// =============================================================================

/**
 * Example tagged error for sync operations
 */
class SyncError extends Data.TaggedError("Sync/Error")<{
  readonly reason: string;
  readonly retryable: boolean;
}> {}

/**
 * Example tagged error for validation
 */
class ValidationError extends Data.TaggedError("Validation/Error")<{
  readonly field: string;
  readonly message: string;
}> {}

/**
 * Example tagged error for auth
 */
class AuthError extends Data.TaggedError("Auth/Error")<{
  readonly type: "expired" | "invalid" | "missing";
}> {}

// =============================================================================
// TESTS
// =============================================================================

describe("Tagged Errors", () => {
  describe("error creation", () => {
    it("should create tagged error with correct _tag", () => {
      const error = new SyncError({
        reason: "Connection timeout",
        retryable: true,
      });

      expect(error._tag).toBe("Sync/Error");
      expect(error.reason).toBe("Connection timeout");
      expect(error.retryable).toBe(true);
    });

    it("should create validation error with field info", () => {
      const error = new ValidationError({
        field: "email",
        message: "Invalid email format",
      });

      expect(error._tag).toBe("Validation/Error");
      expect(error.field).toBe("email");
      expect(error.message).toBe("Invalid email format");
    });

    it("should create auth error with type", () => {
      const error = new AuthError({ type: "expired" });

      expect(error._tag).toBe("Auth/Error");
      expect(error.type).toBe("expired");
    });
  });

  describe("Effect.catchTag", () => {
    it("should catch error by specific tag", async () => {
      const program = Effect.fail(
        new SyncError({ reason: "Network error", retryable: true })
      ).pipe(
        Effect.catchTag("Sync/Error", (e) =>
          Effect.succeed(`Caught sync error: ${e.reason}`)
        )
      );

      const result = await Effect.runPromise(program);

      expect(result).toBe("Caught sync error: Network error");
    });

    it("should not catch unmatched tags", async () => {
      const program = Effect.fail(
        new ValidationError({ field: "name", message: "Required" })
      ).pipe(
        Effect.catchTag("Sync/Error", () => Effect.succeed("caught sync"))
      );

      const exit = await Effect.runPromiseExit(program);

      expect(exit._tag).toBe("Failure");
    });

    it("should handle multiple error types with catchTags", async () => {
      const testError = (
        error: SyncError | ValidationError | AuthError
      ): Effect.Effect<string, never> =>
        Effect.fail(error).pipe(
          Effect.catchTags({
            "Sync/Error": (e) => Effect.succeed(`sync: ${e.reason}`),
            "Validation/Error": (e) => Effect.succeed(`validation: ${e.field}`),
            "Auth/Error": (e) => Effect.succeed(`auth: ${e.type}`),
          })
        );

      const syncResult = await Effect.runPromise(
        testError(new SyncError({ reason: "timeout", retryable: true }))
      );
      const validationResult = await Effect.runPromise(
        testError(new ValidationError({ field: "email", message: "invalid" }))
      );
      const authResult = await Effect.runPromise(
        testError(new AuthError({ type: "expired" }))
      );

      expect(syncResult).toBe("sync: timeout");
      expect(validationResult).toBe("validation: email");
      expect(authResult).toBe("auth: expired");
    });
  });

  describe("Effect.either for error handling", () => {
    it("should wrap success in Right", async () => {
      const program = Effect.succeed("hello").pipe(Effect.either);

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right).toBe("hello");
      }
    });

    it("should wrap failure in Left", async () => {
      const program = Effect.fail(
        new ValidationError({ field: "id", message: "Missing" })
      ).pipe(Effect.either);

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("Validation/Error");
      }
    });

    it("should allow recovery from Left", async () => {
      const program = Effect.fail(
        new SyncError({ reason: "offline", retryable: true })
      ).pipe(
        Effect.either,
        Effect.map((either) => {
          if (either._tag === "Left" && either.left.retryable) {
            return "will retry";
          }
          return either._tag === "Right" ? either.right : "will not retry";
        })
      );

      const result = await Effect.runPromise(program);

      expect(result).toBe("will retry");
    });
  });

  describe("Effect.exit for comprehensive error inspection", () => {
    it("should capture success in Exit", async () => {
      const exit = await Effect.runPromiseExit(Effect.succeed(42));

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toBe(42);
      }
    });

    it("should capture failure with full cause", async () => {
      const exit = await Effect.runPromiseExit(
        Effect.fail(new SyncError({ reason: "db error", retryable: false }))
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        expect(error._tag).toBe("Some");
        if (error._tag === "Some") {
          expect(error.value._tag).toBe("Sync/Error");
          expect((error.value as SyncError).reason).toBe("db error");
        }
      }
    });

    it("should distinguish failure from defect", async () => {
      // Failure - expected error
      const failureExit = await Effect.runPromiseExit(
        Effect.fail(new AuthError({ type: "invalid" }))
      );

      // Defect - unexpected error (die)
      const defectExit = await Effect.runPromiseExit(
        Effect.die(new Error("Unexpected crash"))
      );

      if (Exit.isFailure(failureExit)) {
        const failure = Cause.failureOption(failureExit.cause);
        const defect = Cause.dieOption(failureExit.cause);
        expect(failure._tag).toBe("Some");
        expect(defect._tag).toBe("None");
      }

      if (Exit.isFailure(defectExit)) {
        const failure = Cause.failureOption(defectExit.cause);
        const defect = Cause.dieOption(defectExit.cause);
        expect(failure._tag).toBe("None");
        expect(defect._tag).toBe("Some");
      }
    });
  });

  describe("error composition", () => {
    it("should chain operations with error short-circuiting", async () => {
      const step1 = Effect.succeed(1);
      const step2 = Effect.fail(new SyncError({ reason: "step 2 failed", retryable: false }));
      const step3 = Effect.succeed(3); // Should not execute

      const program = Effect.gen(function* () {
        const a = yield* step1;
        const b = yield* step2; // Will fail here
        const c = yield* step3;
        return a + b + c;
      });

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should recover and continue with catchAll", async () => {
      const unstable = Effect.fail(
        new SyncError({ reason: "temporary", retryable: true })
      );

      const program = unstable.pipe(
        Effect.catchAll((e) => {
          if (e.retryable) {
            return Effect.succeed("recovered");
          }
          return Effect.fail(e);
        })
      );

      const result = await Effect.runPromise(program);

      expect(result).toBe("recovered");
    });

    it("should map errors with mapError", async () => {
      const program = Effect.fail(
        new ValidationError({ field: "age", message: "Must be positive" })
      ).pipe(
        Effect.mapError(
          (e) => new SyncError({ reason: `Validation: ${e.message}`, retryable: false })
        )
      );

      const exit = await Effect.runPromiseExit(program);

      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        if (error._tag === "Some") {
          expect(error.value._tag).toBe("Sync/Error");
          expect((error.value as SyncError).reason).toContain("Validation");
        }
      }
    });
  });

  describe("error accumulation", () => {
    it("should validate all fields and accumulate errors", async () => {
      const validateName = (name: string) =>
        name.length > 0
          ? Effect.succeed(name)
          : Effect.fail(new ValidationError({ field: "name", message: "Required" }));

      const validateEmail = (email: string) =>
        email.includes("@")
          ? Effect.succeed(email)
          : Effect.fail(new ValidationError({ field: "email", message: "Invalid format" }));

      // Using Effect.all with mode: "either" to collect all results
      const program = Effect.all(
        [validateName(""), validateEmail("invalid")],
        { mode: "either" }
      );

      const results = await Effect.runPromise(program);

      // Both should be Left (failures)
      expect(results[0]._tag).toBe("Left");
      expect(results[1]._tag).toBe("Left");
    });
  });
});
