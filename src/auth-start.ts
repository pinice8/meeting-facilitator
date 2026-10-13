import { app, authentication } from "@microsoft/teams-js";
import { PublicClientApplication } from "@azure/msal-browser";
import { CALENDAR_SCOPES, authPageUrl, msalConfig } from "./graph/auth";

async function start() {
  try {
    await app.initialize();
    const context = await app.getContext();
    const redirectUri = authPageUrl("auth-end.html");
    const msal = new PublicClientApplication(msalConfig(redirectUri));
    await msal.initialize();
    const requested = new URLSearchParams(window.location.search).get("scopes");
    const scopes = requested ? requested.split(" ") : CALENDAR_SCOPES;
    await msal.loginRedirect({ scopes, redirectUri, loginHint: context.user?.loginHint });
  } catch (error) {
    authentication.notifyFailure(error instanceof Error ? error.message : String(error));
  }
}
void start();
