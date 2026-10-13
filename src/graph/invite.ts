export interface InviteDetails {
  subject: string;
  bodyText: string;
  totalMinutes?: number;
}

interface GraphEvent {
  subject?: string;
  body?: { content?: string };
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}

/** Both timestamps come back in the same time zone, so treating them as UTC gives the right duration. */
function minutesBetween(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const ms = Date.parse(`${start}Z`) - Date.parse(`${end}Z`);
  const minutes = Math.round(-ms / 60_000);
  return minutes >= 1 && minutes <= 480 ? minutes : undefined;
}

export function parseGraphEvent(event: GraphEvent): InviteDetails {
  return {
    subject: event.subject ?? "",
    bodyText: event.body?.content ?? "",
    totalMinutes: minutesBetween(event.start?.dateTime, event.end?.dateTime),
  };
}

/** Finds the calendar event for a Teams meeting by its join URL and returns its plain-text body and length. */
export async function fetchInvite(
  token: string,
  joinUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<InviteDetails> {
  const filter = `onlineMeeting/joinUrl eq '${joinUrl.replace(/'/g, "''")}'`;
  const url =
    "https://graph.microsoft.com/v1.0/me/events" +
    `?$filter=${encodeURIComponent(filter)}&$select=subject,body,start,end&$top=1`;
  const response = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
  });
  if (!response.ok) throw new Error(`Calendar lookup failed (${response.status})`);
  const data = (await response.json()) as { value?: GraphEvent[] };
  const event = data.value?.[0];
  if (!event) throw new Error("No calendar event in your calendar matches this meeting");
  return parseGraphEvent(event);
}
