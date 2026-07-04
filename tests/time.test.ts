import { describe, expect, it } from "vitest";
import { formatTimestamp, parseTimestampToMs } from "../src/core/time.js";

describe("time helpers", () => {
  it("formats millisecond timestamps", () => {
    expect(formatTimestamp(0)).toBe("0:00.000");
    expect(formatTimestamp(65_432)).toBe("1:05.432");
    expect(formatTimestamp(3_665_007)).toBe("1:01:05.007");
  });

  it("parses seconds and clock timestamps", () => {
    expect(parseTimestampToMs("1.25")).toBe(1250);
    expect(parseTimestampToMs("1:05.432")).toBe(65_432);
    expect(parseTimestampToMs("1:01:05.007")).toBe(3_665_007);
  });
});
