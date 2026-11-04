import { describe, expect, it } from "vitest";
import { formatTime, parseTime, stepTime } from "./time";

describe("parseTime / formatTime", () => {
  it("reads and pads", () => {
    expect(parseTime("7:05")).toEqual([7, 5]);
    expect(formatTime(7, 5)).toBe("07:05");
  });
  it("rejects what is not a time", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("noon")).toBeNull();
  });
});

describe("stepTime", () => {
  it("steps the hour and wraps round the clock without touching the minutes", () => {
    expect(stepTime("08:30", "hour", 1)).toBe("09:30");
    expect(stepTime("23:15", "hour", 1)).toBe("00:15");
    expect(stepTime("00:15", "hour", -1)).toBe("23:15");
  });
  it("steps the minutes to the next or previous multiple of 5", () => {
    expect(stepTime("08:30", "minute", 1)).toBe("08:35");
    expect(stepTime("08:07", "minute", 1)).toBe("08:10");
    expect(stepTime("08:07", "minute", -1)).toBe("08:05");
    expect(stepTime("08:30", "minute", -1)).toBe("08:25");
  });
  it("wraps the minutes without changing the hour", () => {
    expect(stepTime("08:55", "minute", 1)).toBe("08:00");
    expect(stepTime("08:00", "minute", -1)).toBe("08:55");
  });
  it("starts from 12:00 when the text is not a time", () => {
    expect(stepTime("", "hour", 1)).toBe("13:00");
  });
});
