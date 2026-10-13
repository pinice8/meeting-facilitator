import { app, meeting } from "@microsoft/teams-js";

export interface TeamsEnv {
  frameContext?: string;
  theme: string;
  /** Id of the meeting's chat (the flow needs it to know where to post). */
  chatId?: string;
}

export interface MeetingInfo {
  joinUrl?: string;
}

/** Initializes the Teams SDK. Returns null when the page is not running inside Teams. */
export async function initTeams(timeoutMs = 5000): Promise<TeamsEnv | null> {
  try {
    await Promise.race([
      app.initialize(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Teams did not respond")), timeoutMs)),
    ]);
    const context = await app.getContext();
    return { frameContext: context.page?.frameContext, theme: context.app.theme, chatId: context.chat?.id };
  } catch {
    return null;
  }
}

export function markLoaded(): void {
  app.notifyAppLoaded();
  app.notifySuccess();
}

export function watchTheme(onChange: (theme: string) => void): void {
  app.registerOnThemeChangeHandler(onChange);
}

export function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

/** Whether the local user may share the app to the meeting stage (needs the manifest's meetingStage context). */
export function canShareToStage(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      meeting.getAppContentStageSharingCapabilities((error, capabilities) =>
        resolve(!error && Boolean(capabilities?.doesAppHaveSharePermission)),
      );
    } catch {
      resolve(false);
    }
  });
}

/** Shares the given page to the meeting stage, where everyone in the meeting sees it. */
export function shareToStage(contentUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    meeting.shareAppContentToStage((error) => {
      if (error) reject(new Error(typeof error === "object" && error.message ? error.message : "Teams refused to share the app"));
      else resolve();
    }, contentUrl);
  });
}

/** Details of the meeting the app is open in (used to find the calendar invite). */
export async function getMeetingInfo(): Promise<MeetingInfo | null> {
  try {
    const response = await meeting.getMeetingDetailsVerbose();
    return { joinUrl: response.details.joinUrl };
  } catch {
    return null;
  }
}
