import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { SetupView, type InviteLoader } from "./SetupView";
import { RunningView } from "./RunningView";
import { DoneView } from "./DoneView";
import { AgendaBar } from "./AgendaBar";
import { StageView } from "./StageView";
import { useLifecycle } from "./useLifecycle";
import { useAgendaChat, type ChatOptions } from "./useAgendaChat";

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
  /** Where and how the agenda is posted to the meeting chat. */
  chatOptions?: ChatOptions;
}

export function App({ store, loadInvite, inMeeting = false, view = "panel", onShareToStage, frameContext, chatOptions }: Props) {
  const session = useSession(store);
  const { diagnostics, restart, undo, dismiss } = useLifecycle(store, inMeeting);
  const chat = useAgendaChat(chatOptions);

  const live = session.status === "running" || session.status === "paused";

  if (view === "stage") return <StageView store={store} />;

  return (
    <>
      {live && <AgendaBar store={store} interactive />}
      <main className="app">
        <header className="app-header">
          <h1>Meeting Facilitator</h1>
          {!store.canControl && <span className="badge">View only</span>}
        </header>
        {store.notice && <p className="notice" role="status">{store.notice}</p>}
        {restart && (
          <p className="notice" role="status">
            Started the agenda again: the previous run had no facilitator for a while.{" "}
            <button type="button" onClick={undo}>Undo</button> <button type="button" onClick={dismiss}>Dismiss</button>
          </p>
        )}
        {session.status === "setup" && <SetupView store={store} loadInvite={loadInvite} inMeeting={inMeeting} chat={chat} />}
        {live && <RunningView store={store} onShareToStage={onShareToStage} />}
        {session.status === "done" && <DoneView store={store} />}
        <footer className="footer">
          v{__APP_VERSION__} · build {__BUILD_ID__} · {frameContext ?? "local"} · {store.canControl ? "facilitator" : "view only"}
          {diagnostics && (
            <>
              <br />
              check: {diagnostics.action} (run {diagnostics.status}) · others in meeting: {diagnostics.othersInMeeting ? "yes" : "no"} ·
              facilitator seen {diagnostics.seenSecondsAgo === undefined ? "never" : `${diagnostics.seenSecondsAgo}s ago`}
            </>
          )}
        </footer>
      </main>
    </>
  );
}
