import {
  LivePresence,
  LiveShareClient,
  PresenceState,
  UserMeetingRole,
  type ILiveShareHost,
  type ITimestampProvider,
} from "@microsoft/live-share";
import { LiveShareHost } from "@microsoft/teams-js";
import { SharedMap } from "fluid-framework";
import type { IAzureAudience } from "@fluidframework/azure-client";
import { emptySession, type SessionState } from "../core/types";
import type { SessionStore, Transition } from "./SessionStore";

const KEY = "session";
// Kept in its own key so a heartbeat can never overwrite a concurrent change to the session.
const HEARTBEAT_KEY = "heartbeat";

/**
 * Shared state in the meeting's Live Share session: one JSON snapshot in a persistent
 * Fluid SharedMap (survives everyone leaving, for up to ~24h, so the agenda can be prepared
 * before the meeting). Time is read from Live Share's synchronized clock.
 */
/** Presence data each open app publishes: lets others tell the live meeting apart from a chat-tab view. */
interface PresenceData {
  inMeeting: boolean;
}

/** How long to wait for other participants' presence to arrive after joining. */
const PRESENCE_SETTLE_MS = 2500;

export class LiveShareStore implements SessionStore {
  readonly mode = "live-share" as const;
  private state: SessionState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly map: SharedMap,
    private readonly timestamps: ITimestampProvider,
    readonly canControl: boolean,
    private readonly presence: LivePresence<PresenceData>,
  ) {
    this.state = map.get<SessionState>(KEY) ?? emptySession();
    // Fluid orders all writes, so adopting every change keeps all clients converged.
    map.on("valueChanged", (changed) => {
      if (changed.key !== KEY) return;
      this.state = map.get<SessionState>(KEY) ?? emptySession();
      this.emit();
    });
  }

  now = () => this.timestamps.getTimestamp();
  getState = () => this.state;
  lastActiveAt = () => this.map.get<number>(HEARTBEAT_KEY);

  async othersInMeeting(): Promise<boolean> {
    await sleep(PRESENCE_SETTLE_MS);
    return this.presence
      .getUsers(PresenceState.online)
      .some((user) => !user.isLocalUser && user.getConnections(PresenceState.online).some((c) => c.data?.inMeeting));
  }

  heartbeat(): void {
    if (this.canControl) this.map.set(HEARTBEAT_KEY, this.now());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(transition: Transition): void {
    if (!this.canControl) return;
    const next = transition(this.state, this.now());
    if (next === this.state) return;
    this.state = next;
    this.map.set(KEY, next);
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Finds this client's connection id once the audience knows about us. */
async function waitForClientId(audience: IAzureAudience, timeoutMs = 10_000): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = audience.getMyself()?.connections?.[0]?.id;
    if (id) return id;
    await sleep(250);
  }
  return undefined;
}

/** Organizers and presenters may control. If Teams cannot tell us the role, we give the benefit of the doubt. */
async function resolveCanControl(host: ILiveShareHost, audience: IAzureAudience): Promise<boolean> {
  try {
    const clientId = await waitForClientId(audience);
    if (!clientId) return true;
    const roles = (await host.getClientInfo(clientId))?.roles ?? (await host.getClientRoles(clientId)) ?? [];
    if (roles.length === 0) return true;
    return roles.includes(UserMeetingRole.organizer) || roles.includes(UserMeetingRole.presenter);
  } catch {
    return true;
  }
}

export async function connectLiveShare(inMeeting: boolean): Promise<LiveShareStore> {
  const host = LiveShareHost.create();
  const client = new LiveShareClient(host);
  const { container, services, timestampProvider } = await client.joinContainer({
    initialObjects: { session: SharedMap, presence: LivePresence },
  });
  const map = container.initialObjects.session as SharedMap;
  const presence = container.initialObjects.presence as LivePresence<PresenceData>;
  await presence.initialize({ inMeeting });
  const canControl = await resolveCanControl(host, services.audience);
  return new LiveShareStore(map, timestampProvider, canControl, presence);
}
