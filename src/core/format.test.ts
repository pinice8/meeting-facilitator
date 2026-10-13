import { describe, expect, it } from "vitest";
import { formatClock, formatDelta } from "./format";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(10 * 60_000)).toBe("10:00");
  });
  it("shows overtime with a minus sign", () => {
    expect(formatClock(-90_000)).toBe("-1:30");
  });
  it("shows hours when needed", () => {
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });
});

describe("formatDelta", () => {
  it("is on schedule within 30 seconds", () => {
    expect(formatDelta(20_000)).toBe("On schedule");
    expect(formatDelta(-20_000)).toBe("On schedule");
  });
  it("says behind or ahead in minutes", () => {
    expect(formatDelta(3 * 60_000)).toBe("3 min behind");
    expect(formatDelta(-2 * 60_000)).toBe("2 min ahead");
  });
});
