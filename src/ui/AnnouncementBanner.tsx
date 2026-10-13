import { useSyncExternalStore } from "react";
import type { Announcer } from "../announcer";

/** Shows what happened when an item's participants were called into the meeting chat. */
export function AnnouncementBanner({ announcer }: { announcer: Announcer }) {
  const status = useSyncExternalStore(announcer.subscribe, announcer.getStatus);
  if (status.kind === "idle") return null;

  if (status.kind === "sending") {
    return <p className="notice" role="status">Calling in the participants for “{status.title}”…</p>;
  }
  if (status.kind === "sent") {
    return (
      <p className="notice" role="status">
        Tagged {status.tagged.join(", ") || "nobody"} in the meeting chat for “{status.title}”.
        {status.unresolved.length > 0 && ` Couldn’t match ${status.unresolved.join(", ")} to anyone in this meeting’s chat.`}
      </p>
    );
  }
  return (
    <p className="notice error" role="alert">
      Couldn’t call in the participants for “{status.item.title}”: {status.error}{" "}
      <button type="button" onClick={() => void announcer.retry()}>Retry</button>
    </p>
  );
}
