import { describe, expect, it } from "vitest";
import { parseAgenda } from "./parser";

describe("parseAgenda", () => {
  it("parses plain lines without minutes", () => {
    expect(parseAgenda("Intro\nDemo\nQ&A")).toEqual([{ title: "Intro" }, { title: "Demo" }, { title: "Q&A" }]);
  });

  it("strips bullets and numbering and skips blank lines", () => {
    const text = "1. Intro\n\n- Demo\n* Retro\n• Wrap up\n2) Next steps";
    expect(parseAgenda(text).map((i) => i.title)).toEqual(["Intro", "Demo", "Retro", "Wrap up", "Next steps"]);
  });

  it.each([
    ["Demo - 10", "Demo", 10],
    ["Demo – 10 min", "Demo", 10],
    ["Demo: 15", "Demo", 15],
    ["Demo (10 min)", "Demo", 10],
    ["Demo (10)", "Demo", 10],
    ["Demo [5m]", "Demo", 5],
    ["Demo 20 minutes", "Demo", 20],
    ["10 min - Demo", "Demo", 10],
  ])("extracts minutes from %j", (line, title, minutes) => {
    expect(parseAgenda(line)).toEqual([{ title, minutes }]);
  });

  it("does not mistake years or big numbers for minutes", () => {
    expect(parseAgenda("Roadmap 2025")).toEqual([{ title: "Roadmap 2025" }]);
    expect(parseAgenda("Budget - 2025")).toEqual([{ title: "Budget - 2025" }]);
  });

  it("does not turn a title that is only a number into minutes", () => {
    expect(parseAgenda("- 10")).toEqual([{ title: "10" }]);
  });

  it("parses participants after a pipe, with or without minutes", () => {
    expect(parseAgenda("Demo - 10 | Alice, Bob")).toEqual([{ title: "Demo", minutes: 10, participants: ["Alice", "Bob"] }]);
    expect(parseAgenda("Retro | alice@nice.com; @Bob Lee")).toEqual([{ title: "Retro", participants: ["alice@nice.com", "Bob Lee"] }]);
    expect(parseAgenda("- Demo (5 min) |Alice")).toEqual([{ title: "Demo", minutes: 5, participants: ["Alice"] }]);
  });

  it("ignores an empty participants list and skips a line with only participants", () => {
    expect(parseAgenda("Demo |")).toEqual([{ title: "Demo" }]);
    expect(parseAgenda(" | Alice")).toEqual([]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseAgenda("  \n \n")).toEqual([]);
  });
});
