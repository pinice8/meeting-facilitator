import { describe, expect, it } from "vitest";
import { agendaToCard, agendaToHtml, agendaToText, buildFlowPayload } from "./agendaMessage";

const items = [
  { id: "item-1", title: "Intro", minutes: 5, participants: ["Alice"] },
  { id: "item-2", title: "Demo & <Q&A>", minutes: 25 },
];

describe("agenda message", () => {
  it("formats plain text with numbering, minutes and participants", () => {
    expect(agendaToText(items, 30)).toBe("📋 Agenda — 30 min\n1. Intro (5 min) — Alice\n2. Demo & <Q&A> (25 min)");
  });

  it("formats HTML with <br> and escapes the content", () => {
    expect(agendaToHtml(items, 30)).toBe(
      "<b>📋 Agenda — 30 min</b><br>1. Intro (5 min) — Alice<br>2. Demo &amp; &lt;Q&amp;A&gt; (25 min)",
    );
  });

  it("builds the payload for the flow", () => {
    const payload = buildFlowPayload(items, 30, "19:abc@thread.v2");
    expect(payload.chatId).toBe("19:abc@thread.v2");
    expect(payload.message).toContain("<br>");
    expect(payload.text.split("\n")).toHaveLength(3);
    expect(payload.items).toEqual([
      { title: "Intro", minutes: 5, participants: ["Alice"] },
      { title: "Demo & <Q&A>", minutes: 25, participants: [] },
    ]);
  });

  it("defaults the chat id to an empty string", () => {
    expect(buildFlowPayload(items, 30).chatId).toBe("");
  });

  it("is a Teams message with an adaptive card, so the webhook trigger accepts it", () => {
    const payload = buildFlowPayload(items, 30, "c1");
    expect(payload.type).toBe("message");
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(payload.attachments[0].content.type).toBe("AdaptiveCard");
  });

  it("puts the heading and one text block per item in the card", () => {
    const card = agendaToCard(items, 30);
    expect(card.body.map((block) => block.text)).toEqual(["📋 Agenda — 30 min", "1. Intro (5 min) — Alice", "2. Demo & <Q&A> (25 min)"]);
  });
});
