import { app, authentication } from "@microsoft/teams-js";
import { PublicClientApplication } from "@azure/msal-browser";
import { authPageUrl, msalConfig } from "./graph/auth";

async function finish() {
  try {
    await app.initialize();
    const msal = new PublicClientApplication(msalConfig(authPageUrl("auth-end.html")));
    await msal.initialize();
    const result = await msal.handleRedirectPromise();
    if (!result) throw new Error("Sign-in did not return a result");
    authentication.notifySuccess(JSON.stringify({ token: result.accessToken, expiresOn: result.expiresOn?.getTime() }));
  } catch (error) {
    authentication.notifyFailure(error instanceof Error ? error.message : String(error));
  }
}
void finish();
