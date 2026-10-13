import { authentication } from "@microsoft/teams-js";
import type { Configuration } from "@azure/msal-browser";

/** Reading the invite. */
export const CALENDAR_SCOPES = ["Calendars.Read"];
/** Reading the meeting chat's members and posting to it as the user. */
export const CHAT_SCOPES = ["ChatMember.Read", "ChatMessage.Send"];

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
const tenant = (import.meta.env.VITE_ENTRA_TENANT as string | undefined) || "organizations";

/** Reading the invite only works once an Entra app registration is configured (see README). */
export const isGraphConfigured = (): boolean => Boolean(clientId);

export function msalConfig(redirectUri: string): Configuration {
  return {
    auth: { clientId: clientId ?? "", authority: `https://login.microsoftonline.com/${tenant}`, redirectUri },
    cache: { cacheLocation: "sessionStorage" },
  };
}

export const authPageUrl = (page: "auth-start.html" | "auth-end.html"): string =>
  new URL(page, window.location.href).href;

interface CachedToken {
  token: string;
  expiresAt: number;
}
const cache = new Map<string, CachedToken>();

/**
 * Opens the Teams sign-in popup (auth-start.html → Microsoft sign-in → auth-end.html) and returns a
 * Graph token for the scopes. Scopes are requested separately per feature, so a tenant that blocks
 * chat permissions does not also break reading the invite.
 */
export async function getGraphToken(scopes: string[]): Promise<string> {
  const key = scopes.join(" ");
  const hit = cache.get(key);
  if (hit && hit.expiresAt - 60_000 > Date.now()) return hit.token;
  const url = `${authPageUrl("auth-start.html")}?scopes=${encodeURIComponent(key)}`;
  const raw = await authentication.authenticate({ url, width: 600, height: 700 });
  const result = JSON.parse(raw) as { token: string; expiresOn?: number };
  cache.set(key, { token: result.token, expiresAt: result.expiresOn ?? Date.now() + 50 * 60_000 });
  return result.token;
}
