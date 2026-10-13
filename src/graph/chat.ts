import type { ChatMember, ChatMessage } from "../core/announce";

const GRAPH = "https://graph.microsoft.com/v1.0";

interface GraphMember {
  userId?: string;
  displayName?: string;
  email?: string;
}

async function failure(response: Response, what: string): Promise<Error> {
  let detail = "";
  try {
    detail = ((await response.json()) as { error?: { message?: string } }).error?.message ?? "";
  } catch {
    /* no JSON body */
  }
  return new Error(`${what} failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

/** The people in a (meeting) chat; the pool we match participant names against. */
export async function listChatMembers(token: string, chatId: string, fetchFn: typeof fetch = fetch): Promise<ChatMember[]> {
  const members: ChatMember[] = [];
  let url: string | undefined = `${GRAPH}/chats/${encodeURIComponent(chatId)}/members`;
  for (let page = 0; url && page < 5; page++) {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw await failure(response, "Reading the meeting chat members");
    const data = (await response.json()) as { value?: GraphMember[]; "@odata.nextLink"?: string };
    for (const m of data.value ?? []) {
      if (m.userId && m.displayName) members.push({ userId: m.userId, displayName: m.displayName, email: m.email });
    }
    url = data["@odata.nextLink"];
  }
  return members;
}

/** Posts a message to the chat as the signed-in user. */
export async function sendChatMessage(token: string, chatId: string, message: ChatMessage, fetchFn: typeof fetch = fetch): Promise<void> {
  const response = await fetchFn(`${GRAPH}/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!response.ok) throw await failure(response, "Posting to the meeting chat");
}
