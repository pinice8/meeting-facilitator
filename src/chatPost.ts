import type { FlowPayload } from "./core/agendaMessage";

export function isFlowUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sends the agenda to a flow's URL as JSON. The Teams webhook trigger validates the body against a
 * schema and needs a real JSON object, so this is a normal application/json request (the browser may
 * first ask the flow whether web pages may call it). Resolves when the flow accepts it; throws with the
 * flow's own explanation when it rejects it, or with a plain message when the browser could not reach it.
 */
export async function postAgendaToFlow(url: string, payload: FlowPayload, fetchFn: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch {
    throw new Error(
      "couldn’t reach the flow. Either you are offline, or the browser blocked the request because the flow does not allow calls from web pages",
    );
  }
  if (!response.ok) throw new Error(`The flow answered ${response.status}${await explanation(response)}`);
}

/** The flow's own explanation of a rejection (trimmed), so "400" is never a mystery. */
async function explanation(response: Response): Promise<string> {
  try {
    const text = (await response.text()).replace(/\s+/g, " ").trim();
    return text ? `: ${text.length > 300 ? `${text.slice(0, 300)}…` : text}` : "";
  } catch {
    return "";
  }
}
