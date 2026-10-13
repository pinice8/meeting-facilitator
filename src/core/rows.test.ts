import { describe, expect, it } from "vitest";
import { blankRows, itemsToRows, moveRow, parsedToRows, rowsToParsed, type Row } from "./rows";
import { parseAgenda } from "./parser";

const counter = () => {
  let n = 0;
  return () => ++n;
};

describe("rowsToParsed", () => {
  it("skips blank rows, trims names, and only carries explicit minutes and participants", () => {
    const rows: Row[] = [
      { key: 1, title: "  Intro ", minutes: 5, participants: "Alice, @Bob" },
      { key: 2, title: "   ", minutes: 9, participants: "" },
      { key: 3, title: "Demo", participants: "" },
    ];
    expect(rowsToParsed(rows)).toEqual([{ title: "Intro", minutes: 5, participants: ["Alice", "Bob"] }, { title: "Demo" }]);
  });
});

describe("rows from other shapes", () => {
  it("builds rows from pasted text with unique keys", () => {
    const rows = parsedToRows(parseAgenda("Intro - 5 | Alice\nDemo"), counter());
    expect(rows).toEqual([
      { key: 1, title: "Intro", minutes: 5, participants: "Alice" },
      { key: 2, title: "Demo", minutes: undefined, participants: "" },
    ]);
  });

  it("builds rows from saved items", () => {
    const rows = itemsToRows([{ id: "item-1", title: "A", minutes: 10, participants: ["X", "Y"] }], counter());
    expect(rows[0]).toMatchObject({ title: "A", minutes: 10, participants: "X, Y" });
  });

  it("makes blank rows", () => {
    expect(blankRows(2, counter())).toEqual([
      { key: 1, title: "", participants: "" },
      { key: 2, title: "", participants: "" },
    ]);
  });
});

describe("moveRow", () => {
  it("swaps with the neighbour", () => {
    expect(moveRow(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveRow(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the ends or out of range", () => {
    const list = ["a", "b"];
    expect(moveRow(list, 0, -1)).toBe(list);
    expect(moveRow(list, 1, 1)).toBe(list);
    expect(moveRow(list, 5, -1)).toBe(list);
  });
});
