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
  it("posts the payload as JSON text without a preflight-triggering content type", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    await postAgendaToFlow("https://flow/x", payload, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://flow/x");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "text/plain" });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it("is confirmed when the flow answers OK", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    expect(await postAgendaToFlow("https://flow/x", payload, fetchFn)).toBe("confirmed");
  });

  it("is unconfirmed when the browser cannot read the answer (the request was still sent)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await postAgendaToFlow("https://flow/x", payload, fetchFn)).toBe("unconfirmed");
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
