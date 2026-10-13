import { authentication } from "@microsoft/teams-js";
import type { Configuration } from "@azure/msal-browser";

export const GRAPH_SCOPES = ["Calendars.Read"];

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
let cached: CachedToken | undefined;

/** Opens the Teams sign-in popup (auth-start.html → Microsoft sign-in → auth-end.html) and returns a Graph token. */
export async function getGraphToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const raw = await authentication.authenticate({ url: authPageUrl("auth-start.html"), width: 600, height: 700 });
  const result = JSON.parse(raw) as { token: string; expiresOn?: number };
  cached = { token: result.token, expiresAt: result.expiresOn ?? Date.now() + 50 * 60_000 };
  return result.token;
}
