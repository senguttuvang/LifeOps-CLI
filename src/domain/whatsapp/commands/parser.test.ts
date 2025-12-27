/**
 * Command Parser Tests
 */

import { describe, it, expect } from "vitest";
import { parseCommand } from "./parser";

describe("parseCommand", () => {
  describe("valid commands", () => {
    it("should parse simple command without args", () => {
      const result = parseCommand("@lifeops help");
      expect(result).toEqual({ name: "help", args: "" });
    });

    it("should parse command with single arg", () => {
      const result = parseCommand("@lifeops suggest outdoor");
      expect(result).toEqual({ name: "suggest", args: "outdoor" });
    });

    it("should parse command with multiple args", () => {
      const result = parseCommand("@lifeops memory beach sunset");
      expect(result).toEqual({ name: "memory", args: "beach sunset" });
    });

    it("should parse command with complex args", () => {
      const result = parseCommand(
        "@lifeops draft apology for being late to dinner"
      );
      expect(result).toEqual({
        name: "draft",
        args: "apology for being late to dinner",
      });
    });

    it("should be case insensitive for @lifeops", () => {
      const result1 = parseCommand("@LIFEOPS help");
      const result2 = parseCommand("@LifeOps help");
      const result3 = parseCommand("@lifeops help");

      expect(result1).toEqual({ name: "help", args: "" });
      expect(result2).toEqual({ name: "help", args: "" });
      expect(result3).toEqual({ name: "help", args: "" });
    });

    it("should lowercase the command name", () => {
      const result = parseCommand("@lifeops HELP");
      expect(result).toEqual({ name: "help", args: "" });
    });

    it("should trim whitespace from message", () => {
      const result = parseCommand("  @lifeops help  ");
      expect(result).toEqual({ name: "help", args: "" });
    });

    it("should trim whitespace from args", () => {
      const result = parseCommand("@lifeops suggest   outdoor   ");
      expect(result).toEqual({ name: "suggest", args: "outdoor" });
    });
  });

  describe("invalid commands", () => {
    it("should return null for non-command messages", () => {
      const result = parseCommand("Just a regular message");
      expect(result).toBeNull();
    });

    it("should return null for @lifeops without command", () => {
      const result = parseCommand("@lifeops");
      expect(result).toBeNull();
    });

    it("should return null for @lifeops with only whitespace", () => {
      const result = parseCommand("@lifeops   ");
      expect(result).toBeNull();
    });

    it("should return null for messages starting with @lifeops but not at beginning", () => {
      const result = parseCommand("Hey @lifeops help");
      expect(result).toBeNull();
    });

    it("should return null for similar but different triggers", () => {
      expect(parseCommand("@life help")).toBeNull();
      expect(parseCommand("@ops help")).toBeNull();
      expect(parseCommand("lifeops help")).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = parseCommand("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace only", () => {
      const result = parseCommand("   ");
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle special characters in args", () => {
      const result = parseCommand("@lifeops draft sorry! didn't mean to");
      expect(result).toEqual({
        name: "draft",
        args: "sorry! didn't mean to",
      });
    });

    it("should handle numbers in command name", () => {
      const result = parseCommand("@lifeops test123");
      expect(result).toEqual({ name: "test123", args: "" });
    });

    it("should reject command names with special characters", () => {
      // Command name must be word characters only (\\w+)
      const result = parseCommand("@lifeops help!");
      expect(result).toBeNull();
    });

    it("should reject command names with spaces", () => {
      const result = parseCommand("@lifeops help me");
      // This should parse as command="help" with args="me"
      expect(result).toEqual({ name: "help", args: "me" });
    });
  });
});
