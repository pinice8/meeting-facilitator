import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import { MemoryStore } from "./store/MemoryStore";
import type { SessionStore } from "./store/SessionStore";
import { connectLiveShare } from "./store/LiveShareStore";
import { applyTheme, canShareToStage, getMeetingInfo, initTeams, markLoaded, shareToStage, watchTheme } from "./teams";
import { getGraphToken, isGraphConfigured } from "./graph/auth";
import { fetchInvite } from "./graph/invite";
import { extractAgendaFromInvite } from "./core/invite";
import type { InviteLoader } from "./ui/SetupView";
import { emptySession } from "./core/types";
import { parseAgenda } from "./core/parser";
import { planAgenda } from "./core/planner";

const root = createRoot(document.getElementById("root") as HTMLElement);
interface RenderOptions {
  loadInvite?: InviteLoader;
  inMeeting?: boolean;
  view?: "panel" | "stage";
  onShareToStage?: () => Promise<void>;
}
const render = (store: SessionStore, options: RenderOptions = {}) =>
  root.render(<StrictMode><App store={store} {...options} /></StrictMode>);

const message = (text: string) => root.render(<main className="app"><p>{text}</p></main>);

/**
 * Local try-out outside Teams: ?harness=1 [&role=attendee] [&speed=60] [&meeting=1]
 * [&agenda=Intro - 2|Demo|Q&A - 1] [&total=6] [&stage=1] [&share=1]
 * speed N makes time run N times faster; meeting=1 behaves like the in-meeting panel (auto-start);
 * stage=1 shows the meeting-stage view; share=1 shows the "Show on stage" button (does nothing).
 */
function startHarness(params: URLSearchParams) {
  const speed = Number(params.get("speed")) || 1;
  const t0 = Date.now();
  const agenda = params.get("agenda");
  const total = Number(params.get("total")) || 30;
  const initial = agenda
    ? { ...emptySession(total), items: planAgenda(parseAgenda(agenda.split("|").join("\n")), total).items }
    : undefined;
  render(
    new MemoryStore({
      canControl: params.get("role") !== "attendee",
      clock: () => t0 + (Date.now() - t0) * speed,
      notice: "Local harness: nothing is shared.",
      initial,
    }),
    {
      inMeeting: params.get("meeting") === "1" || params.get("stage") === "1",
      view: params.get("stage") === "1" ? "stage" : "panel",
      onShareToStage: params.get("share") === "1" ? () => Promise.resolve() : undefined,
    },
  );
}

const MEETING_FRAMES = ["sidePanel", "meetingStage"];

const inviteLoader: InviteLoader = async () => {
  const info = await getMeetingInfo();
  if (!info?.joinUrl) throw new Error("Teams didn’t provide this meeting’s join link");
  const token = await getGraphToken();
  const invite = await fetchInvite(token, info.joinUrl);
  return { agenda: extractAgendaFromInvite(invite.bodyText), totalMinutes: invite.totalMinutes };
};

async function start() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("harness")) return startHarness(params);

  const teams = await initTeams();
  if (!teams) return message("Open this app inside Microsoft Teams (or add ?harness=1 to try it locally).");

  applyTheme(teams.theme);
  watchTheme(applyTheme);

  let store: SessionStore;
  try {
    store = await connectLiveShare();
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
  });
  markLoaded();
}

void start();
