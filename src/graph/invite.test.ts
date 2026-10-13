import { describe, expect, it, vi } from "vitest";
import { fetchInvite, parseGraphEvent } from "./invite";

describe("parseGraphEvent", () => {
  it("returns subject, body text and duration in minutes", () => {
    const details = parseGraphEvent({
      subject: "Weekly sync",
      body: { content: "Agenda:\n- Intro" },
      start: { dateTime: "2026-10-13T12:00:00.0000000" },
      end: { dateTime: "2026-10-13T12:45:00.0000000" },
    });
    expect(details).toEqual({ subject: "Weekly sync", bodyText: "Agenda:\n- Intro", totalMinutes: 45 });
  });

  it("leaves the duration undefined when times are missing or absurd", () => {
    expect(parseGraphEvent({}).totalMinutes).toBeUndefined();
    expect(
      parseGraphEvent({ start: { dateTime: "2026-10-13T00:00:00" }, end: { dateTime: "2026-10-20T00:00:00" } }).totalMinutes,
    ).toBeUndefined();
  });
});

describe("fetchInvite", () => {
  const okResponse = (value: unknown[]) => ({ ok: true, status: 200, json: async () => ({ value }) }) as Response;

  it("queries by join URL with a bearer token and plain-text body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse([{ subject: "S", body: { content: "b" } }]));
    await fetchInvite("tok", "https://teams.microsoft.com/l/meetup-join/abc", fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(decodeURIComponent(url as string)).toContain("onlineMeeting/joinUrl eq 'https://teams.microsoft.com/l/meetup-join/abc'");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok",
      Prefer: 'outlook.body-content-type="text"',
    });
  });

  it("explains when no event matches", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse([]));
    await expect(fetchInvite("t", "u", fetchFn)).rejects.toThrow(/No calendar event/);
  });

  it("surfaces HTTP errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(fetchInvite("t", "u", fetchFn)).rejects.toThrow(/403/);
  });
});
