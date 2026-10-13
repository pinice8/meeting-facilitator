import { describe, expect, it } from "vitest";
import { buildChatMessage, resolveParticipants, type ChatMember } from "./announce";

const members: ChatMember[] = [
  { userId: "u1", displayName: "Alice Smith", email: "alice@nice.com" },
  { userId: "u2", displayName: "Bob Lee", email: "bob@nice.com" },
  { userId: "u3", displayName: "Alice Jones", email: "alice.j@nice.com" },
  { userId: "u4", displayName: "Carol King" },
];

describe("resolveParticipants", () => {
  it("matches by email, full name and unique first name, ignoring case and a leading @", () => {
    const r = resolveParticipants(["ALICE@nice.com", "bob lee", "@Carol"], members);
    expect(r.mentioned.map((m) => m.userId)).toEqual(["u1", "u2", "u4"]);
    expect(r.unresolved).toEqual([]);
  });

  it("does not guess when a name is ambiguous or unknown", () => {
    const r = resolveParticipants(["Alice", "Dave"], members);
    expect(r.mentioned).toEqual([]);
    expect(r.unresolved).toEqual(["Alice", "Dave"]);
  });

  it("matches a surname or a partial name when it is unique", () => {
    expect(resolveParticipants(["Lee"], members).mentioned.map((m) => m.userId)).toEqual(["u2"]);
    expect(resolveParticipants(["Smi"], members).mentioned.map((m) => m.userId)).toEqual(["u1"]);
  });

  it("tags each person once even if listed twice", () => {
    const r = resolveParticipants(["Bob", "bob@nice.com"], members);
    expect(r.mentioned).toHaveLength(1);
  });
});

describe("buildChatMessage", () => {
  const item = { id: "item-1", title: "Demo & <Q&A>", minutes: 10, participants: ["Bob"] };

  it("tags the mentioned people with matching <at> ids and escapes the title", () => {
    const message = buildChatMessage(item, { mentioned: [members[1], members[3]], unresolved: [] });
    expect(message.body.contentType).toBe("html");
    expect(message.body.content).toContain('<at id="0">Bob Lee</at>, <at id="1">Carol King</at>');
    expect(message.body.content).toContain("<b>Demo &amp; &lt;Q&amp;A&gt;</b> (10 min)");
    expect(message.mentions).toEqual([
      { id: 0, mentionText: "Bob Lee", mentioned: { user: { id: "u2", displayName: "Bob Lee", userIdentityType: "aadUser" } } },
      { id: 1, mentionText: "Carol King", mentioned: { user: { id: "u4", displayName: "Carol King", userIdentityType: "aadUser" } } },
    ]);
  });

  it("names people it could not tag as plain text", () => {
    const message = buildChatMessage(item, { mentioned: [members[1]], unresolved: ["Dave <x>"] });
    expect(message.body.content).toContain("@Dave &lt;x&gt;");
    expect(message.mentions).toHaveLength(1);
  });
});
