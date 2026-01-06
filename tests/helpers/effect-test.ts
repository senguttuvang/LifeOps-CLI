/**
 * Effect-TS Test Utilities
 *
 * Helpers for testing Effect-based services with Vitest.
 * Provides type-safe utilities for running effects, asserting results,
 * and working with test layers.
 */

import { Cause, Effect, Exit, Layer, type Context } from "effect";

/**
 * Run an Effect and return the result.
 * Throws if the effect fails.
 */
export const runEffect = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(effect);

/**
 * Run an Effect and return the Exit for inspection.
 * Never throws - use for asserting on errors.
 */
export const runEffectExit = <A, E>(effect: Effect.Effect<A, E, never>): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(effect);

/**
 * Run an Effect expecting it to succeed.
 * Provides better error messages than runEffect on failure.
 */
export const expectSuccess = async <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isFailure(exit)) {
    const error = Cause.failureOption(exit.cause);
    const defect = Cause.dieOption(exit.cause);

    if (error._tag === "Some") {
      throw new Error(`Expected success but got failure: ${JSON.stringify(error.value, null, 2)}`);
    }
    if (defect._tag === "Some") {
      throw new Error(`Expected success but got defect: ${defect.value}`);
    }
    throw new Error(`Expected success but got failure: ${Cause.pretty(exit.cause)}`);
  }

  return exit.value;
};

/**
 * Run an Effect expecting it to fail with a specific tagged error.
 * Returns the error for further assertions.
 */
export const expectTaggedError = async <A, E extends { _tag: string }>(
  effect: Effect.Effect<A, E, never>,
  expectedTag: E["_tag"],
): Promise<E> => {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    throw new Error(`Expected failure with tag "${expectedTag}" but got success: ${JSON.stringify(exit.value)}`);
  }

  const error = Cause.failureOption(exit.cause);

  if (error._tag === "None") {
    const defect = Cause.dieOption(exit.cause);
    if (defect._tag === "Some") {
      throw new Error(`Expected failure with tag "${expectedTag}" but got defect: ${defect.value}`);
    }
    throw new Error(`Expected failure with tag "${expectedTag}" but got unexpected cause`);
  }

  const actualError = error.value as E;
  if (actualError._tag !== expectedTag) {
    throw new Error(`Expected error tag "${expectedTag}" but got "${actualError._tag}"`);
  }

  return actualError;
};

/**
 * Run an Effect expecting it to fail (any error).
 * Returns the error for further assertions.
 */
export const expectFailure = async <A, E>(effect: Effect.Effect<A, E, never>): Promise<E> => {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    throw new Error(`Expected failure but got success: ${JSON.stringify(exit.value)}`);
  }

  const error = Cause.failureOption(exit.cause);

  if (error._tag === "None") {
    const defect = Cause.dieOption(exit.cause);
    if (defect._tag === "Some") {
      throw new Error(`Expected failure but got defect: ${defect.value}`);
    }
    throw new Error("Expected failure but got unexpected cause");
  }

  return error.value;
};

/**
 * Run an Effect with a provided layer.
 * Convenience wrapper for Effect.provide + runPromise.
 */
export const runWithLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, never, never>,
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer));

/**
 * Run an Effect with a provided layer, returning Exit.
 */
export const runWithLayerExit = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, never, never>,
): Promise<Exit.Exit<A, E>> => Effect.runPromiseExit(Effect.provide(effect, layer));

/**
 * Create a test runner pre-configured with a layer.
 * Useful when running many tests with the same layer.
 */
export const createTestRunner = <R>(layer: Layer.Layer<R, never, never>) => ({
  /**
   * Run effect with the layer, returning result
   */
  run: <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, layer)),

  /**
   * Run effect with the layer, returning Exit
   */
  runExit: <A, E>(effect: Effect.Effect<A, E, R>): Promise<Exit.Exit<A, E>> =>
    Effect.runPromiseExit(Effect.provide(effect, layer)),

  /**
   * Run effect expecting success
   */
  expectSuccess: async <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> => {
    const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));
    if (Exit.isFailure(exit)) {
      throw new Error(`Expected success: ${Cause.pretty(exit.cause)}`);
    }
    return exit.value;
  },

  /**
   * Run effect expecting failure with specific tag
   */
  expectTaggedError: async <A, E extends { _tag: string }>(
    effect: Effect.Effect<A, E, R>,
    expectedTag: E["_tag"],
  ): Promise<E> => {
    const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));
    if (Exit.isSuccess(exit)) {
      throw new Error(`Expected failure with tag "${expectedTag}" but got success`);
    }
    const error = Cause.failureOption(exit.cause);
    if (error._tag === "None") {
      throw new Error(`Expected failure with tag "${expectedTag}" but got defect`);
    }
    const actualError = error.value as E;
    if (actualError._tag !== expectedTag) {
      throw new Error(`Expected error tag "${expectedTag}" but got "${actualError._tag}"`);
    }
    return actualError;
  },
});

/**
 * Utility to collect console output during a test.
 * Returns captured logs and a cleanup function.
 */
export const captureConsole = () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(" "));
  };

  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
};
