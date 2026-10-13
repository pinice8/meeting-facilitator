import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import { MemoryStore } from "./store/MemoryStore";
import type { SessionStore } from "./store/SessionStore";
import { connectLiveShare } from "./store/LiveShareStore";
import { applyTheme, canShareToStage, getMeetingInfo, initTeams, markLoaded, shareToStage, watchTheme } from "./teams";
import { CALENDAR_SCOPES, getGraphToken, isGraphConfigured } from "./graph/auth";
import { fetchInvite } from "./graph/invite";
import { extractAgendaFromInvite } from "./core/invite";
import type { InviteLoader } from "./ui/SetupView";
import { emptySession } from "./core/types";
import { startSession } from "./core/timer";
import { parseAgenda } from "./core/parser";
import { planAgenda } from "./core/planner";

const root = createRoot(document.getElementById("root") as HTMLElement);
/**
 * Teams can keep serving a cached copy of this page. If the deployed build differs from the one
 * running, reload once with a changed URL (a new cache key) to pick up the latest.
 */
async function reloadIfStale(): Promise<boolean> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
    const { build } = (await response.json()) as { build: string };
    const url = new URL(window.location.href);
    if (build === __BUILD_ID__ || url.searchParams.get("v") === build) return false;
    url.searchParams.set("v", build);
    window.location.replace(url.href);
    return true;
  } catch {
    return false; // dev server or offline: carry on with what we have
  }
}

interface RenderOptions {
  loadInvite?: InviteLoader;
  inMeeting?: boolean;
  view?: "panel" | "stage";
  onShareToStage?: () => Promise<void>;
  frameContext?: string;
}
const render = (store: SessionStore, options: RenderOptions = {}) =>
  root.render(<StrictMode><App store={store} {...options} /></StrictMode>);

const message = (text: string) => root.render(<main className="app"><p>{text}</p></main>);

/**
 * Local try-out outside Teams: ?harness=1 [&role=attendee] [&speed=60] [&meeting=1]
 * [&agenda=Intro - 2~Demo | Alice~Q&A - 1] [&total=6] [&stage=1] [&share=1]
 * speed N makes time run N times faster; meeting=1 behaves like the in-meeting panel (auto-start);
 * stage=1 shows the meeting-stage view; share=1 shows the "Show on stage" button (does nothing);
 * stale=1 loads the agenda as a run left over from a meeting that ended 30 minutes ago.
 */
function startHarness(params: URLSearchParams) {
  const speed = Number(params.get("speed")) || 1;
  const t0 = Date.now();
  const agenda = params.get("agenda");
  const total = Number(params.get("total")) || 30;
  const saved = agenda
    ? { ...emptySession(total), items: planAgenda(parseAgenda(agenda.split("~").join("\n")), total).items }
    : undefined;
  const initial = saved && params.get("stale") === "1" ? startSession(saved, t0 - 30 * 60_000) : saved;
  const memory = new MemoryStore({
    canControl: params.get("role") !== "attendee",
    clock: () => t0 + (Date.now() - t0) * speed,
    notice: "Local harness: nothing is shared.",
    initial,
  });
  render(memory, {
    inMeeting: params.get("meeting") === "1" || params.get("stage") === "1",
    view: params.get("stage") === "1" ? "stage" : "panel",
    onShareToStage: params.get("share") === "1" ? () => Promise.resolve() : undefined,
  });
}

const MEETING_FRAMES = ["sidePanel", "meetingStage"];

const inviteLoader: InviteLoader = async () => {
  const info = await getMeetingInfo();
  if (!info?.joinUrl) throw new Error("Teams didn’t provide this meeting’s join link");
  const token = await getGraphToken(CALENDAR_SCOPES);
  const invite = await fetchInvite(token, info.joinUrl);
  return { agenda: extractAgendaFromInvite(invite.bodyText), totalMinutes: invite.totalMinutes };
};

async function start() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("harness")) return startHarness(params);

  if (await reloadIfStale()) return;

  const teams = await initTeams();
  if (!teams) return message("Open this app inside Microsoft Teams (or add ?harness=1 to try it locally).");

  applyTheme(teams.theme);
  watchTheme(applyTheme);

  let store: SessionStore;
  try {
    store = await connectLiveShare(MEETING_FRAMES.includes(teams.frameContext ?? ""));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    store = new MemoryStore({ notice: `Couldn’t connect to the shared meeting session (${reason}). Showing a local-only timer.` });
  }
  const stageUrl = new URL("index.html", window.location.href).href;
  const mayShare = teams.frameContext === "sidePanel" && (await canShareToStage());
  render(store, {
    loadInvite: isGraphConfigured() ? inviteLoader : undefined,
    inMeeting: MEETING_FRAMES.includes(teams.frameContext ?? ""),
    view: teams.frameContext === "meetingStage" ? "stage" : "panel",
    onShareToStage: mayShare ? () => shareToStage(stageUrl) : undefined,
    frameContext: teams.frameContext,
  });
  markLoaded();
}

void start();
