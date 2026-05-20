import { describe, it, expect } from "vitest";
import { safeParseJson, cleanJsonString, extractJsonBlock } from "../utils/jsonExtractor";

describe("safeParseJson", () => {
  it("should parse valid JSON directly", () => {
    const result = safeParseJson('{"a": 1}', null);
    expect(result).toEqual({ a: 1 });
  });

  it("should fallback to default on invalid JSON", () => {
    const result = safeParseJson("not json at all", { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it("should handle markdown code blocks", () => {
    const result = safeParseJson('```json\n{"key": "value"}\n```', null);
    expect(result).toEqual({ key: "value" });
  });

  it("should handle ``` without json suffix", () => {
    const result = safeParseJson('```\n{"key": "value"}\n```', null);
    expect(result).toEqual({ key: "value" });
  });

  it("should handle trailing commas", () => {
    const result = safeParseJson('{"a": 1, "b": 2,}', null);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should handle JSON arrays", () => {
    const result = safeParseJson('[{"a": 1}, {"a": 2}]', null);
    expect(result).toHaveLength(2);
    expect((result as unknown as any[])[0].a).toBe(1);
    expect((result as unknown as any[])[1].a).toBe(2);
  });

  it("should handle markdown with JSON array code blocks", () => {
    const result = safeParseJson('```json\n[{"type": "openEnded", "question": "Q?"}]\n```', null);
    // Must be parsed as array
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect((result as unknown as any[])[0].question).toBe("Q?");
  });

  it("should handle single-quoted keys", () => {
    const result = safeParseJson("{'key': 'value'}", null);
    expect(result).toEqual({ key: "value" });
  });
});

describe("safeParseJson with typed default", () => {
  it("should return default on parse failure", () => {
    const defaultVal = { recall: 0.5, comprehension: 0.5 };
    const result = safeParseJson("total garbage", defaultVal);
    expect(result).toBe(defaultVal);
  });

  it("should return default for empty string", () => {
    const result = safeParseJson("", { fallback: "yes" });
    expect(result).toEqual({ fallback: "yes" });
  });
});

describe("cleanJsonString", () => {
  it("should strip ```json markers", () => {
    expect(cleanJsonString('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("should strip ``` markers", () => {
    expect(cleanJsonString('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("should fix trailing commas", () => {
    expect(cleanJsonString('{"a":1,"b":2,}')).toBe('{"a":1,"b":2}');
  });

  it("should fix unquoted keys", () => {
    const result = cleanJsonString("{key: 'value'}");
    // Valid JSON with or without space after colon is acceptable
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ key: "value" });
  });

  it("should strip single-line comments", () => {
    const result = cleanJsonString('{"a":1 // comment\n}');
    // Result should be parseable as valid JSON
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ a: 1 });
  });
});

describe("extractJsonBlock", () => {
  it("should extract JSON from surrounding text", () => {
    const text = 'Some text before { "key": "value" } and after';
    const result = extractJsonBlock(text);
    expect(JSON.parse(result!)).toEqual({ key: "value" });
  });

  it("should return null if no valid JSON found", () => {
    const result = extractJsonBlock("no json here");
    expect(result).toBeNull();
  });

  it("should handle nested objects", () => {
    const result = extractJsonBlock('{"a": {"b": "c"}}');
    expect(JSON.parse(result!)).toEqual({ a: { b: "c" } });
  });

  it("should skip mismatched brackets", () => {
    const result = extractJsonBlock('{ "a": 1 } {');
    expect(JSON.parse(result!)).toEqual({ a: 1 });
  });
});
