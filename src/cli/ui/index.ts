/**
 * LifeOps CLI UI Layer
 *
 * Ink-based rich terminal UI for LifeOps CLI.
 * Provides React components for rendering beautiful CLI output.
 *
 * Usage:
 * ```typescript
 * import { renderOnce, FineAnalysis, InkRendererLive } from "./ui/index.js";
 * import React from "react";
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* analyzeMessage("I'm fine");
 *   yield* renderOnce(<FineAnalysis result={result} />);
 * }).pipe(Effect.provide(InkRendererLive));
 * ```
 */

// Re-export all components
export * from "./components/index.js";

// Re-export render service
export {
  InkRenderer,
  InkRendererLive,
  renderOnce,
  withSpinner,
} from "./render.js";
