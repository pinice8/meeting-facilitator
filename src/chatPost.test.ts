import { describe, expect, it, vi } from "vitest";
import { isFlowUrl, postAgendaToFlow } from "./chatPost";
import { buildFlowPayload } from "./core/agendaMessage";

const payload = buildFlowPayload([{ id: "item-1", title: "A", minutes: 5 }], 10, "chat1");

describe("isFlowUrl", () => {
  it("accepts https URLs only", () => {
    expect(isFlowUrl("https://prod-12.westus.logic.azure.com/workflows/abc")).toBe(true);
    expect(isFlowUrl("http://example.com")).toBe(false);
    expect(isFlowUrl("not a url")).toBe(false);
    expect(isFlowUrl("")).toBe(false);
  });
});

describe("postAgendaToFlow", () => {
  it("posts the payload as a real JSON body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await postAgendaToFlow("https://flow/x", payload, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://flow/x");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it("resolves when the flow accepts it (the Teams webhook answers 202)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await expect(postAgendaToFlow("https://flow/x", payload, fetchFn)).resolves.toBeUndefined();
  });

  it("says plainly when the browser could not reach the flow (never reports that as sent)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(postAgendaToFlow("https://flow/x", payload, fetchFn)).rejects.toThrow(/couldn’t reach the flow.*blocked/);
  });

  it("throws when the flow answers with an error, including its explanation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"error":{"message":"Body schema mismatch"}}', { status: 400 }));
    await expect(postAgendaToFlow("https://flow/x", payload, fetchFn)).rejects.toThrow(/400.*Body schema mismatch/);
  });

  it("trims a very long explanation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("x".repeat(1000), { status: 500 }));
    await expect(postAgendaToFlow("https://flow/x", payload, fetchFn)).rejects.toThrow(/^The flow answered 500: x{300}…$/);
  });
});
