import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { HEARTBEAT_MS, applyLifecycle, lifecycleAction } from "../core/lifecycle";
import { SetupView, type InviteLoader } from "./SetupView";
import { RunningView } from "./RunningView";
import { DoneView } from "./DoneView";
import { AgendaBar } from "./AgendaBar";
import { StageView } from "./StageView";
import { StripView } from "./StripView";
import { openStripWindow, type StripWindow } from "../strip";

interface Props {
  store: SessionStore;
  loadInvite?: InviteLoader;
  /** Open inside the live meeting (side panel / stage) rather than the pre-meeting chat tab. */
  inMeeting?: boolean;
  /** Teams frame context, shown in the footer to help diagnose what the user is looking at. */
  frameContext?: string;
  /** "stage" is the full-width read-only view shown on the meeting stage. */
  view?: "panel" | "stage";
  /** Present only when the local user may share the app to the meeting stage. */
  onShareToStage?: () => Promise<void>;
}

export function App({ store, loadInvite, inMeeting = false, view = "panel", onShareToStage, frameContext }: Props) {
  const session = useSession(store);
  const [strip, setStrip] = useState<StripWindow | null>(null);

  const popOut = useCallback(async () => {
    const opened = await openStripWindow();
    opened.win.addEventListener("pagehide", () => setStrip(null));
    // The strip is useless without this window: close it when the app goes away.
    window.addEventListener("pagehide", () => opened.win.close(), { once: true });
    setStrip(opened);
  }, []);

  // A facilitator opening the app in the meeting starts the saved agenda (or restarts it if the
  // previous meeting ended), then keeps a heartbeat so the next opening can tell the difference.
  useEffect(() => {
    if (!store.canControl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      // Decide before our own heartbeat overwrites the evidence of whether the last run is still alive.
      const othersInMeeting = await store.othersInMeeting();
      if (cancelled) return;
      const action = lifecycleAction(store.getState(), {
        inMeeting,
        canControl: store.canControl,
        lastActiveAt: store.lastActiveAt(),
        othersInMeeting,
        now: store.now(),
      });
      if (action !== "none") store.update((s, now) => applyLifecycle(s, action, now));
      if (!inMeeting) return;
      store.heartbeat();
      timer = setInterval(() => store.heartbeat(), HEARTBEAT_MS);
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [store, inMeeting]);

  const live = session.status === "running" || session.status === "paused";

  if (view === "stage") return <StageView store={store} />;

  return (
    <>
      {live && <AgendaBar store={store} />}
      {strip && createPortal(<StripView store={store} />, strip.root)}
      <main className="app">
        <header className="app-header">
          <h1>Meeting Facilitator</h1>
          <span className={`badge ${store.canControl ? "badge-control" : ""}`}>
            {store.canControl ? "You control the flow" : "View only"}
          </span>
        </header>
        {store.notice && <p className="notice" role="status">{store.notice}</p>}
        {session.status === "setup" && <SetupView store={store} loadInvite={loadInvite} inMeeting={inMeeting} />}
        {live && <RunningView store={store} onShareToStage={onShareToStage} onPopOut={view === "panel" ? popOut : undefined} />}
        {session.status === "done" && <DoneView store={store} />}
        <footer className="footer">
          v{__APP_VERSION__} · build {__BUILD_ID__} · {frameContext ?? "local"} · {store.canControl ? "facilitator" : "view only"}
        </footer>
      </main>
    </>
  );
}
