/**
 * Four Horsemen Detector Tests
 *
 * Tests for Gottman's Four Horsemen pattern detection.
 */

import { describe, expect, it } from "bun:test";
import {
  detectInMessage,
  calculateScore,
  getAntidote,
} from "./four-horsemen.detector";
import type { HorsemanDetection } from "./types";

describe("Four Horsemen Detector", () => {
  describe("detectInMessage", () => {
    it("should detect criticism patterns", () => {
      const message = {
        id: "msg-1",
        text: "You always forget everything important!",
        timestamp: new Date(),
        fromMe: true,
      };

      const detections = detectInMessage(message);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].horseman).toBe("criticism");
      expect(detections[0].confidence).toBeGreaterThan(0.5);
    });

    it("should detect contempt patterns with higher severity", () => {
      const message = {
        id: "msg-2",
        text: "Whatever. Do whatever you want, I don't care.",
        timestamp: new Date(),
        fromMe: false,
      };

      const detections = detectInMessage(message);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections.some((d) => d.horseman === "contempt")).toBe(true);

      const contemptDetection = detections.find((d) => d.horseman === "contempt");
      expect(contemptDetection?.severity).toBe(5); // Highest severity
    });

    it("should detect contempt emoji 🙄", () => {
      const message = {
        id: "msg-3",
        text: "Sure 🙄",
        timestamp: new Date(),
        fromMe: true,
      };

      const detections = detectInMessage(message);

      expect(detections.some((d) => d.horseman === "contempt")).toBe(true);
    });

    it("should detect defensiveness patterns", () => {
      const message = {
        id: "msg-4",
        text: "It's not my fault! What about when you did the same thing?",
        timestamp: new Date(),
        fromMe: true,
      };

      const detections = detectInMessage(message);

      expect(detections.some((d) => d.horseman === "defensiveness")).toBe(true);
    });

    it("should detect stonewalling patterns", () => {
      const message = {
        id: "msg-5",
        text: "fine",
        timestamp: new Date(),
        fromMe: false,
      };

      const detections = detectInMessage(message);

      expect(detections.some((d) => d.horseman === "stonewalling")).toBe(true);
    });

    it("should not detect horsemen in positive messages", () => {
      const message = {
        id: "msg-6",
        text: "I love you so much! Thank you for being there for me.",
        timestamp: new Date(),
        fromMe: true,
      };

      const detections = detectInMessage(message);

      expect(detections.length).toBe(0);
    });

    it("should handle empty messages", () => {
      const message = {
        id: "msg-7",
        text: "",
        timestamp: new Date(),
        fromMe: true,
      };

      const detections = detectInMessage(message);

      expect(detections.length).toBe(0);
    });
  });

  describe("calculateScore", () => {
    it("should return 100 for no horsemen detected", () => {
      const detections: HorsemanDetection[] = [];
      const score = calculateScore(detections, 100);

      expect(score.score).toBe(100);
      expect(score.criticismCount).toBe(0);
      expect(score.contemptCount).toBe(0);
    });

    it("should weight contempt 2x in scoring", () => {
      const criticismOnly: HorsemanDetection[] = [
        {
          horseman: "criticism",
          confidence: 0.8,
          severity: 3,
          messageId: "msg-1",
          excerpt: "You always...",
          matchedPattern: "you always",
          timestamp: new Date(),
          sender: "user",
        },
      ];

      const contemptOnly: HorsemanDetection[] = [
        {
          horseman: "contempt",
          confidence: 0.8,
          severity: 5,
          messageId: "msg-2",
          excerpt: "Whatever...",
          matchedPattern: "whatever",
          timestamp: new Date(),
          sender: "user",
        },
      ];

      const criticismScore = calculateScore(criticismOnly, 100);
      const contemptScore = calculateScore(contemptOnly, 100);

      // Contempt should result in lower health score (weighted 2x)
      expect(contemptScore.score).toBeLessThan(criticismScore.score);
    });

    it("should track sender attribution", () => {
      const detections: HorsemanDetection[] = [
        {
          horseman: "criticism",
          confidence: 0.8,
          severity: 3,
          messageId: "msg-1",
          excerpt: "test",
          matchedPattern: "test",
          timestamp: new Date(),
          sender: "user",
        },
        {
          horseman: "criticism",
          confidence: 0.8,
          severity: 3,
          messageId: "msg-2",
          excerpt: "test",
          matchedPattern: "test",
          timestamp: new Date(),
          sender: "user",
        },
        {
          horseman: "contempt",
          confidence: 0.8,
          severity: 5,
          messageId: "msg-3",
          excerpt: "test",
          matchedPattern: "test",
          timestamp: new Date(),
          sender: "partner",
        },
      ];

      const score = calculateScore(detections, 100);

      // User has 2, partner has 1 → user is primary exhibitor
      expect(score.primaryExhibitor).toBe("user");
    });
  });

  describe("getAntidote", () => {
    it("should return antidote for criticism", () => {
      const antidote = getAntidote("criticism");

      expect(antidote).toContain("specific behavior");
    });

    it("should return antidote for contempt", () => {
      const antidote = getAntidote("contempt");

      expect(antidote).toContain("appreciation");
    });

    it("should return antidote for defensiveness", () => {
      const antidote = getAntidote("defensiveness");

      expect(antidote).toContain("responsibility");
    });

    it("should return antidote for stonewalling", () => {
      const antidote = getAntidote("stonewalling");

      expect(antidote).toContain("break");
    });
  });
});
