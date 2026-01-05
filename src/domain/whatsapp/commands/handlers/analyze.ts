/**
 * Analyze Command Handler
 *
 * Generates relationship health analysis
 */

import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../relationship/analysis.service";

export const handleAnalyze = (
  chatId: string
): Effect.Effect<string, Error> => {
  return Effect.gen(function* () {
    const analysisService = yield* AnalysisServiceTag;

    // Get relationship analysis
    const analysis = yield* analysisService.analyze(chatId);

    const response = `📊 Relationship Analysis

${analysis}`;

    return response;
  });
};
