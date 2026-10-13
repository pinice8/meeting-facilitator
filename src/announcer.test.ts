import { describe, expect, it, vi } from "vitest";
import { Announcer } from "./announcer";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const members = { value: [{ userId: "u1", displayName: "Alice Smith" }, { userId: "u2", displayName: "Bob Lee" }] };
const item = { id: "item-1", title: "Demo", minutes: 10, participants: ["Alice", "Zed"] };

function setup(post: () => Response = () => json({}, 201)) {
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (init?.method === "POST" ? post() : json(members)));
  const getToken = vi.fn().mockResolvedValue("tok");
  return { announcer: new Announcer({ getToken, chatId: "chat1", fetchFn: fetchFn as unknown as typeof fetch }), fetchFn, getToken };
}

describe("Announcer", () => {
  it("tags the matched people, reports who could not be matched, and posts once", async () => {
    const { announcer, fetchFn } = setup();
    await announcer.announce(item);
    expect(announcer.getStatus()).toEqual({ kind: "sent", title: "Demo", tagged: ["Alice Smith"], unresolved: ["Zed"] });
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string).mentions).toHaveLength(1);
  });

  it("does nothing for an item without participants", async () => {
    const { announcer, getToken } = setup();
    await announcer.announce({ id: "i", title: "X", minutes: 5 });
    expect(getToken).not.toHaveBeenCalled();
    expect(announcer.getStatus().kind).toBe("idle");
  });

  it("reports a failure and can retry it", async () => {
    let failing = true;
    const { announcer, fetchFn } = setup(() => (failing ? json({ error: { message: "blocked" } }, 403) : json({}, 201)));
    await announcer.announce(item);
    expect(announcer.getStatus()).toMatchObject({ kind: "failed", error: expect.stringContaining("blocked") });
    failing = false;
    await announcer.retry();
    expect(announcer.getStatus().kind).toBe("sent");
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
  });

  it("reports a sign-in failure", async () => {
    const announcer = new Announcer({ getToken: () => Promise.reject(new Error("popup closed")), chatId: "c" });
    await announcer.announce(item);
    expect(announcer.getStatus()).toMatchObject({ kind: "failed", error: "popup closed" });
  });

  it("notifies subscribers as the status changes", async () => {
    const { announcer } = setup();
    const seen: string[] = [];
    announcer.subscribe(() => seen.push(announcer.getStatus().kind));
    await announcer.announce(item);
    expect(seen).toEqual(["sending", "sent"]);
  });
});
