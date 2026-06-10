import { describe, it, expect } from "vitest";
import { formatBytes, formatDate } from "./formatters";

describe("formatBytes", () => {
  it("returns '0 Bytes' when bytes is 0", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("returns 'Invalid size' when bytes is negative", () => {
    expect(formatBytes(-100)).toBe("Invalid size");
  });

  it("formats bytes accurately with default decimal precision", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("respects the custom decimals argument", () => {
    expect(formatBytes(1572864, 2)).toBe("1.5 MB");
    expect(formatBytes(1572864, 0)).toBe("2 MB");
    expect(formatBytes(1234567, 3)).toBe("1.177 MB");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO 8601 date string", () => {
    const isoString = "2026-06-10T12:00:00.000Z";
    const result = formatDate(isoString);
    expect(result).toContain("2026");
    expect(typeof result).toBe("string");
  });

  it("falls back to the input string if date conversion fails", () => {
    const invalidDate = "not-a-date";
    expect(formatDate(invalidDate)).toBe("not-a-date");
  });
});
