import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import { MemoryStore } from "./store/MemoryStore";
import type { SessionStore } from "./store/SessionStore";
import { connectLiveShare } from "./store/LiveShareStore";
import { applyTheme, getMeetingInfo, initTeams, markLoaded, watchTheme } from "./teams";
import { getGraphToken, isGraphConfigured } from "./graph/auth";
import { fetchInvite } from "./graph/invite";
import { extractAgendaFromInvite } from "./core/invite";
import type { InviteLoader } from "./ui/SetupView";

const root = createRoot(document.getElementById("root") as HTMLElement);
const render = (store: SessionStore, loadInvite?: InviteLoader) =>
  root.render(<StrictMode><App store={store} loadInvite={loadInvite} /></StrictMode>);

const message = (text: string) => root.render(<main className="app"><p>{text}</p></main>);

/** Local try-out outside Teams: ?harness=1 [&role=attendee] [&speed=60] (speed N makes time run N times faster). */
function startHarness(params: URLSearchParams) {
  const speed = Number(params.get("speed")) || 1;
  const t0 = Date.now();
  render(new MemoryStore({
    canControl: params.get("role") !== "attendee",
    clock: () => t0 + (Date.now() - t0) * speed,
    notice: "Local harness: nothing is shared.",
  }));
}

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
  render(store, isGraphConfigured() ? inviteLoader : undefined);
  markLoaded();
}

void start();
