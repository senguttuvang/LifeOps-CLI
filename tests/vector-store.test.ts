import { describe, expect, test } from "bun:test";
import type { Document } from "../src/infrastructure/rag/vector.store";

describe("VectorStore", () => {
  describe("Document interface", () => {
    test("should create valid document with all fields", () => {
      const doc: Document = {
        id: "doc_001",
        text: "This is a sample document for testing.",
        metadata: {
          author: "Test Author",
          date: "2024-01-01",
          category: "test",
          priority: 1,
          published: true,
          tags: null,
        },
        vector: [0.1, 0.2, 0.3, 0.4, 0.5],
      };

      expect(doc.id).toBe("doc_001");
      expect(doc.text).toContain("sample document");
      expect(doc.metadata.author).toBe("Test Author");
      expect(doc.metadata.priority).toBe(1);
      expect(doc.metadata.published).toBe(true);
      expect(doc.metadata.tags).toBeNull();
      expect(doc.vector).toHaveLength(5);
    });

    test("should create document without optional vector field", () => {
      const doc: Document = {
        id: "doc_002",
        text: "Document without embedding vector.",
        metadata: {
          source: "manual",
        },
      };

      expect(doc.id).toBe("doc_002");
      expect(doc.vector).toBeUndefined();
    });

    test("should support various metadata value types", () => {
      const doc: Document = {
        id: "doc_003",
        text: "Testing metadata types.",
        metadata: {
          stringValue: "hello",
          numberValue: 42,
          booleanValue: false,
          nullValue: null,
          undefinedValue: undefined,
        },
      };

      expect(typeof doc.metadata.stringValue).toBe("string");
      expect(typeof doc.metadata.numberValue).toBe("number");
      expect(typeof doc.metadata.booleanValue).toBe("boolean");
      expect(doc.metadata.nullValue).toBeNull();
      expect(doc.metadata.undefinedValue).toBeUndefined();
    });

    test("should handle empty metadata", () => {
      const doc: Document = {
        id: "doc_004",
        text: "Document with empty metadata.",
        metadata: {},
      };

      expect(doc.metadata).toEqual({});
      expect(Object.keys(doc.metadata)).toHaveLength(0);
    });

    test("should handle long text content", () => {
      const longText = "Lorem ipsum ".repeat(1000);
      const doc: Document = {
        id: "doc_005",
        text: longText,
        metadata: {
          length: longText.length,
        },
      };

      expect(doc.text.length).toBeGreaterThan(10000);
      expect(doc.metadata.length).toBe(longText.length);
    });

    test("should handle special characters in text", () => {
      const doc: Document = {
        id: "doc_006",
        text: 'Special chars: 你好, émojis 🎉, quotes "\'", newlines\n\ttabs',
        metadata: {
          hasSpecialChars: true,
        },
      };

      expect(doc.text).toContain("你好");
      expect(doc.text).toContain("🎉");
      expect(doc.text).toContain('"');
      expect(doc.text).toContain("\n");
      expect(doc.text).toContain("\t");
    });

    test("should handle numeric vector of various dimensions", () => {
      const doc128: Document = {
        id: "doc_007",
        text: "128-dimensional vector",
        metadata: { dimensions: 128 },
        vector: Array.from({ length: 128 }, () => Math.random()),
      };

      const doc1536: Document = {
        id: "doc_008",
        text: "1536-dimensional vector (OpenAI)",
        metadata: { dimensions: 1536 },
        vector: Array.from({ length: 1536 }, () => Math.random()),
      };

      expect(doc128.vector).toHaveLength(128);
      expect(doc1536.vector).toHaveLength(1536);
    });

    test("should handle metadata with nested structure not allowed by type", () => {
      // This test verifies type safety - nested objects should cause type errors
      // The metadata type only allows primitive values, not nested objects

      const doc: Document = {
        id: "doc_009",
        text: "Metadata with primitive values only",
        metadata: {
          level1: "string",
          level1Number: 42,
          level1Bool: true,
          // Nested objects would cause TypeScript error:
          // nested: { key: "value" } // ❌ Type error
        },
      };

      expect(doc.metadata.level1).toBe("string");
      expect(doc.metadata.level1Number).toBe(42);
      expect(doc.metadata.level1Bool).toBe(true);
    });
  });
});
