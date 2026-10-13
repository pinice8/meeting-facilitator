import { app, pages } from "@microsoft/teams-js";

// Shown once when the app is added to a meeting: one click on Save and the tab is created.
async function init() {
  await app.initialize();
  const contentUrl = new URL("index.html", window.location.href).href;
  pages.config.registerOnSaveHandler(async (saveEvent) => {
    try {
      await pages.config.setConfig({
        entityId: "meeting-facilitator",
        contentUrl,
        websiteUrl: contentUrl,
        suggestedDisplayName: "Facilitator",
      });
      saveEvent.notifySuccess();
    } catch (error) {
      saveEvent.notifyFailure(error instanceof Error ? error.message : String(error));
    }
  });
  pages.config.setValidityState(true);
  app.notifySuccess();
}
void init();
