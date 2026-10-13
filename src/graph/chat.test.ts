import { describe, expect, it, vi } from "vitest";
import { listChatMembers, sendChatMessage } from "./chat";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("listChatMembers", () => {
  it("returns members and follows paging", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ value: [{ userId: "u1", displayName: "Alice", email: "a@x.com" }], "@odata.nextLink": "https://graph/next" }))
      .mockResolvedValueOnce(json({ value: [{ userId: "u2", displayName: "Bob" }, { displayName: "No id" }] }));
    const members = await listChatMembers("tok", "19:meeting@thread.v2", fetchFn);
    expect(members).toEqual([
      { userId: "u1", displayName: "Alice", email: "a@x.com" },
      { userId: "u2", displayName: "Bob", email: undefined },
    ]);
    expect(fetchFn.mock.calls[0][0]).toBe("https://graph.microsoft.com/v1.0/chats/19%3Ameeting%40thread.v2/members");
    expect(fetchFn.mock.calls[1][0]).toBe("https://graph/next");
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("explains failures with Graph's message", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { message: "Forbidden" } }, 403));
    await expect(listChatMembers("t", "c", fetchFn)).rejects.toThrow(/403.*Forbidden/);
  });
});

describe("sendChatMessage", () => {
  const message = { body: { contentType: "html" as const, content: "hi" }, mentions: [] };

  it("posts the message as JSON to the chat", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}, 201));
    await sendChatMessage("tok", "chat1", message, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://graph.microsoft.com/v1.0/chats/chat1/messages");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(message);
  });

  it("rejects when Graph refuses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { message: "nope" } }, 403));
    await expect(sendChatMessage("t", "c", message, fetchFn)).rejects.toThrow(/403.*nope/);
  });
});
