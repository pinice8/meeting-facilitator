import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { AgendaBar } from "./AgendaBar";

/** Content of the floating strip window: just the bar, or a one-line status when nothing is running. */
export function StripView({ store }: { store: SessionStore }) {
  const state = useSession(store);
  const live = state.status === "running" || state.status === "paused";
  if (live) return <AgendaBar store={store} variant="strip" />;
  return (
    <div className="strip-message">
      {state.status === "done" ? "Meeting finished" : "Waiting for the meeting to start…"}
    </div>
  );
}
