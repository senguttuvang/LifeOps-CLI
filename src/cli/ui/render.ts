/**
 * Ink Render Service
 *
 * Effect service layer for rendering Ink components.
 * Provides type-safe, composable rendering that integrates with Effect.
 */

import { Context, Effect, Layer } from "effect";
import { type Instance, render } from "ink";

import type { ReactNode } from "react";

/**
 * InkRenderer service interface
 */
export interface InkRendererService {
  /**
   * Render a React element to the terminal.
   * Returns an Effect that completes when rendering is done.
   */
  readonly render: (element: ReactNode) => Effect.Effect<void>;

  /**
   * Render a React element and keep it mounted.
   * Returns the Ink instance for later cleanup.
   */
  readonly renderPersistent: (element: ReactNode) => Effect.Effect<Instance>;

  /**
   * Render with a spinner while an effect runs.
   * Automatically unmounts the spinner when the effect completes.
   */
  readonly withSpinner: <A, E, R>(spinnerElement: ReactNode, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}

/**
 * InkRenderer service tag
 */
export class InkRenderer extends Context.Tag("InkRenderer")<InkRenderer, InkRendererService>() {}

/**
 * Create the InkRenderer service implementation
 */
const makeInkRenderer = (): InkRendererService => ({
  render: (element: ReactNode) =>
    Effect.sync(() => {
      const instance = render(element);
      instance.unmount();
    }),

  renderPersistent: (element: ReactNode) => Effect.sync(() => render(element)),

  withSpinner: <A, E, R>(spinnerElement: ReactNode, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.acquireUseRelease(
      // Acquire: mount the spinner
      Effect.sync(() => render(spinnerElement)),
      // Use: run the effect
      () => effect,
      // Release: unmount the spinner
      (instance) => Effect.sync(() => instance.unmount()),
    ),
});

/**
 * Live layer for InkRenderer
 */
export const InkRendererLive = Layer.succeed(InkRenderer, makeInkRenderer());

/**
 * Convenience function to render once and unmount
 */
export const renderOnce = (element: ReactNode): Effect.Effect<void, never, InkRenderer> =>
  Effect.flatMap(InkRenderer, (renderer) => renderer.render(element));

/**
 * Convenience function to render with spinner
 */
export const withSpinner = <A, E, R>(
  spinnerElement: ReactNode,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | InkRenderer> =>
  Effect.flatMap(InkRenderer, (renderer) => renderer.withSpinner(spinnerElement, effect));
