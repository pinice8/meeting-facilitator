import { app, meeting } from "@microsoft/teams-js";

export interface TeamsEnv {
  frameContext?: string;
  theme: string;
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
    return { frameContext: context.page?.frameContext, theme: context.app.theme };
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

/** Details of the meeting the app is open in (used to find the calendar invite). */
export async function getMeetingInfo(): Promise<MeetingInfo | null> {
  try {
    const response = await meeting.getMeetingDetailsVerbose();
    return { joinUrl: response.details.joinUrl };
  } catch {
    return null;
  }
}
