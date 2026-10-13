import type { FlowPayload } from "./core/agendaMessage";

export type PostResult = "confirmed" | "unconfirmed";

export function isFlowUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sends the agenda to a Power Automate flow's HTTP URL. It is sent as text/plain so the browser
 * needs no CORS preflight (flows don't answer one); the flow parses the JSON itself.
 * "confirmed" means the flow answered and the browser let us read it (the flow's Response action
 * allows it); "unconfirmed" means the request went out but we could not read an answer. HTTP errors throw.
 */
export async function postAgendaToFlow(url: string, payload: FlowPayload, fetchFn: typeof fetch = fetch): Promise<PostResult> {
  let response: Response;
  try {
    response = await fetchFn(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
  } catch {
    return "unconfirmed";
  }
  if (!response.ok) throw new Error(`The flow answered ${response.status}`);
  return "confirmed";
}
