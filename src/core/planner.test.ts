import { describe, expect, it } from "vitest";
import { distribute, planAgenda } from "./planner";

const minutesOf = (r: ReturnType<typeof planAgenda>) => r.items.map((i) => i.minutes);

describe("distribute", () => {
  it("always adds up to the total", () => {
    expect(distribute(10, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(10);
    expect(distribute(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });
  it("is proportional to weights", () => {
    expect(distribute(12, [1, 2, 3])).toEqual([2, 4, 6]);
  });
});

describe("planAgenda", () => {
  it("splits the meeting evenly when no item has minutes", () => {
    const plan = planAgenda([{ title: "A" }, { title: "B" }, { title: "C" }], 30);
    expect(minutesOf(plan)).toEqual([10, 10, 10]);
    expect(plan.overByMinutes).toBe(0);
    expect(plan.unassignedMinutes).toBe(0);
  });

  it("gives the extra minutes to the first items when it does not divide evenly", () => {
    expect(minutesOf(planAgenda([{ title: "A" }, { title: "B" }, { title: "C" }], 10))).toEqual([4, 3, 3]);
  });

  it("keeps explicit minutes and splits the rest", () => {
    const plan = planAgenda([{ title: "A", minutes: 10 }, { title: "B" }, { title: "C" }], 30);
    expect(minutesOf(plan)).toEqual([10, 10, 10]);
  });

  it("reports unassigned time when everything is explicit and short", () => {
    const plan = planAgenda([{ title: "A", minutes: 10 }, { title: "B", minutes: 5 }], 30);
    expect(plan.unassignedMinutes).toBe(15);
    expect(plan.overByMinutes).toBe(0);
  });

  it("reports the overrun instead of rescaling when explicit minutes exceed the meeting", () => {
    const plan = planAgenda([{ title: "A", minutes: 40 }, { title: "B" }], 30);
    expect(minutesOf(plan)).toEqual([40, 1]);
    expect(plan.overByMinutes).toBe(11);
  });

  it("gives at least 1 minute to each flexible item", () => {
    const plan = planAgenda([{ title: "A" }, { title: "B" }, { title: "C" }], 2);
    expect(minutesOf(plan)).toEqual([1, 1, 1]);
    expect(plan.overByMinutes).toBe(1);
  });

  it("keeps participants on the planned items", () => {
    const plan = planAgenda([{ title: "A", participants: ["Alice"] }, { title: "B" }], 10);
    expect(plan.items[0].participants).toEqual(["Alice"]);
    expect(plan.items[1]).not.toHaveProperty("participants");
  });

  it("gives stable ids", () => {
    expect(planAgenda([{ title: "A" }, { title: "B" }], 10).items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
  });
});
