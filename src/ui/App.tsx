import { useEffect } from "react";
import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { HEARTBEAT_MS, applyLifecycle, lifecycleAction } from "../core/lifecycle";
import { SetupView, type InviteLoader } from "./SetupView";
import { RunningView } from "./RunningView";
import { DoneView } from "./DoneView";
import { AgendaBar } from "./AgendaBar";

interface Props {
  store: SessionStore;
  loadInvite?: InviteLoader;
  /** Open inside the live meeting (side panel / stage) rather than the pre-meeting chat tab. */
  inMeeting?: boolean;
}

export function App({ store, loadInvite, inMeeting = false }: Props) {
  const session = useSession(store);

  // A facilitator opening the app in the meeting starts the saved agenda (or restarts it if the
  // previous meeting ended), then keeps a heartbeat so the next opening can tell the difference.
  useEffect(() => {
    if (!inMeeting || !store.canControl) return;
    const action = lifecycleAction(store.getState(), {
      inMeeting,
      canControl: store.canControl,
      lastActiveAt: store.lastActiveAt(),
      now: store.now(),
    });
    if (action !== "none") store.update((s, now) => applyLifecycle(s, action, now));
    store.heartbeat();
    const id = setInterval(() => store.heartbeat(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [store, inMeeting]);

  const live = session.status === "running" || session.status === "paused";

  return (
    <>
      {live && <AgendaBar store={store} />}
      <main className="app">
        <header className="app-header">
          <h1>Meeting Facilitator</h1>
          <span className={`badge ${store.canControl ? "badge-control" : ""}`}>
            {store.canControl ? "You control the flow" : "View only"}
          </span>
        </header>
        {store.notice && <p className="notice" role="status">{store.notice}</p>}
        {session.status === "setup" && <SetupView store={store} loadInvite={loadInvite} inMeeting={inMeeting} />}
        {live && <RunningView store={store} />}
        {session.status === "done" && <DoneView store={store} />}
      </main>
    </>
  );
}
