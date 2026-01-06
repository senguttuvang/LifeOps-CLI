// @ts-nocheck - Experimental feature (Phase 1 self-DM interface)
/**
 * Draft Command Handler
 *
 * Drafts a message based on user's communication style
 */

import { Effect } from "effect";
import { AnalysisServiceTag } from "../../../relationship/analysis.service";

export const handleDraft = (
  intent: string,
  chatId: string
): Effect.Effect<string, Error> => {
  if (!intent) {
    return Effect.succeed(
      "Please describe what you want to say.\nExample: @lifeops draft apology for being late"
    );
  }

  return Effect.gen(function* () {
    const analysisService = yield* AnalysisServiceTag;

    // Generate draft using analysis service
    const draft = yield* analysisService.draftResponse(chatId, intent);

    const response = `💬 Message Draft (based on your style):

${draft}

---
Feel free to edit and send!`;

    return response;
  });
};
