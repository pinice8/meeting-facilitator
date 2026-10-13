import { describe, expect, it } from "vitest";
import { itemsToText, setMinutesInText } from "./agendaText";

describe("agendaText", () => {
  it("serializes saved items as 'Title - minutes' lines", () => {
    expect(itemsToText([{ id: "item-1", title: "Intro", minutes: 5 }, { id: "item-2", title: "Demo", minutes: 15 }])).toBe(
      "Intro - 5\nDemo - 15",
    );
  });

  it("sets explicit minutes on one line and keeps the others as they parse", () => {
    const text = "1. Intro\n- Demo - 10\n\nQ&A";
    expect(setMinutesInText(text, 0, 7)).toBe("Intro - 7\nDemo - 10\nQ&A");
  });

  it("round-trips through the parser", () => {
    const text = itemsToText([{ id: "item-1", title: "Intro", minutes: 5 }]);
    expect(setMinutesInText(text, 0, 5)).toBe(text);
  });

  it("ignores an out-of-range index", () => {
    expect(setMinutesInText("A\nB", 5, 3)).toBe("A\nB");
  });
});
