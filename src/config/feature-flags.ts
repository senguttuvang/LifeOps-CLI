/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management following Martin Fowler's patterns.
 * Enables trunk-based development and safe feature rollouts.
 *
 * @see https://martinfowler.com/articles/feature-toggles.html
 */

/**
 * Feature flag for vision/OCR-based event extraction
 *
 * When disabled:
 * - Vision extraction commands will exit gracefully with a message
 * - Image extraction commands will exit gracefully with a message
 * - Vision services remain in codebase but are not invoked
 *
 * Default: true (enabled)
 */
export const isVisionExtractionEnabled = (): boolean => {
  const flag = process.env.ENABLE_VISION_EXTRACTION;

  // Default to enabled if not set
  if (flag === undefined || flag === "") {
    return true;
  }

  // Parse boolean from string
  return flag.toLowerCase() === "true";
};

/**
 * Get all feature flags as an object
 *
 * Useful for debugging or logging current feature state
 */
export const getFeatureFlags = () => ({
  visionExtraction: isVisionExtractionEnabled(),
});
