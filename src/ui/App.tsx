import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { SetupView, type InviteLoader } from "./SetupView";
import { RunningView } from "./RunningView";
import { DoneView } from "./DoneView";

interface Props {
  store: SessionStore;
  loadInvite?: InviteLoader;
}

export function App({ store, loadInvite }: Props) {
  const session = useSession(store);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Meeting Facilitator</h1>
        <span className={`badge ${store.canControl ? "badge-control" : ""}`}>
          {store.canControl ? "You control the flow" : "View only"}
        </span>
      </header>
      {store.notice && <p className="notice" role="status">{store.notice}</p>}
      {session.status === "setup" && <SetupView store={store} loadInvite={loadInvite} />}
      {(session.status === "running" || session.status === "paused") && <RunningView store={store} />}
      {session.status === "done" && <DoneView store={store} />}
    </main>
  );
}
