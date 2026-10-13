# Meeting Facilitator

A Microsoft Teams meeting app. Add it to a meeting, give it the agenda, and it splits the
meeting time across the items. Everyone sees the current item, a live countdown and whether the
meeting is ahead or behind; organizers and presenters move between items.

- **Static app, no backend.** Hosted on GitHub Pages. Everyone's view is synced through
  [Live Share](https://learn.microsoft.com/microsoftteams/platform/apps-in-teams-meetings/teams-live-share-overview)
  (Microsoft-hosted, data kept up to 24 h).
- **Agenda input:** build it in a table (name, optional participants, optional minutes; add, remove and
  reorder rows), or paste a whole agenda as text (`Demo - 10 | Alice`, `Demo (10 min)`, …), or **Load from
  invite** (reads the calendar event through Microsoft Graph; needs the Entra setup below).
- **Participants per item.** Add `| Alice, Bob` to an agenda line (or use the table's Participants
  column). They are shown next to the item as a note (who is presenting or involved); nobody is
  notified. (Tagging them in the meeting chat was tried and dropped: it needs an Entra app registration.)
- **Agenda in the meeting chat.** "Share the agenda in the meeting chat" (setup screen) has a **Copy
  agenda** button and an automatic option: paste your own Power Automate flow's URL once (kept only in
  this browser) and tick *Post the agenda to the meeting chat when I save*; Save (or Start now) then
  posts it, once per changed agenda. Teams gives tab apps no way to post messages themselves, so the
  flow does the posting. See the recipe below.
- **Time split:** items with minutes keep them; the rest of the meeting is divided evenly across the
  others. Over-long plans are flagged, never silently rescaled.
- **Starts by itself.** Save the agenda before the meeting (chat tab → *Save agenda*). When an
  organizer or presenter opens the app inside the live meeting (side panel / stage) the saved agenda
  starts running. A saved run counts as "in progress" only if another participant has the app open in
  the meeting (Live Share presence) or a facilitator panel was seen in the last 45 s (heartbeat every
  10 s, which also covers a panel reload). Otherwise it belongs to a meeting that ended, and it is
  restarted from item 1 (or, in the pre-meeting chat tab, shown as "ready" again). There is also a
  manual **Restart** button. Teams gives tab apps no "meeting started/ended" event (that needs a bot +
  backend), so "started" means "a facilitator opened the app in the meeting"; ending and rejoining
  within ~45 s continues the same run. The check also runs again every 10 s in the pre-meeting
  chat tab and whenever the page becomes visible; an automatic restart shows an **Undo** banner. The
  footer shows the build and what the last check decided, to debug in a real meeting.
- **Top bar.** A bar pinned to the top shows the running item first, filling as its time passes
  (green → amber → red), then the upcoming items; widths follow the planned minutes. Facilitators
  click any item in the bar to jump to it (finished items are small ✓ chips you can click to go back).
- **Meeting stage.** An organizer/presenter clicks **Show on stage** in the side panel; everyone then
  sees a full-width read-only view (big bar across the top, huge countdown, what is next). Needs the
  manifest's `meetingStage` context (v1.1.0+).
- **During the meeting:** Previous / Pause / Next / End session / Restart. Overrun goes red and counts
  up; it never auto-advances.

## Layout

| Path | What |
| --- | --- |
| `src/core` | Pure logic: agenda parser, planner, timer transitions, invite text extraction (unit-tested) |
| `src/store` | `SessionStore` interface; `LiveShareStore` (shared) and `MemoryStore` (local/tests/fallback) |
| `src/graph` | Teams sign-in popup (MSAL) and the Graph calendar lookup |
| `src/ui` | React views: Setup, Running, Done |
| `manifest` | Teams manifest template + icons; `scripts/package-app.mjs` zips the app package |

## Develop

```bash
npm ci
npm test            # unit tests
npm run dev         # then open http://localhost:5173/?harness=1
```

Harness options: `&role=attendee` (read-only view), `&speed=60` (a minute passes per second), `&meeting=1`
(behave like the in-meeting panel, i.e. auto-start) and `&agenda=Intro - 2|Demo|Q%26A - 1&total=6` (pre-saved agenda).

## Deploy

Push to `main`; `.github/workflows/deploy.yml` tests, builds and publishes to
`https://<user>.github.io/meeting-facilitator/` (repo Settings → Pages → Source: GitHub Actions).

## Install in Teams

```bash
PAGES_BASE_URL=https://<user>.github.io/meeting-facilitator/ npm run package
```

Upload `dist-app/meeting-facilitator.zip` in Teams → Apps → Manage your apps → Upload an app. Then in
a scheduled meeting's chat click **+**, choose *Meeting Facilitator*, and **Save**. Bump
`version` in `package.json` when you change the manifest, and use *Upload a new version*.

## "Load from invite" setup (optional)

1. Entra admin center → App registrations → New registration (single tenant is fine).
2. Authentication → add a **Single-page application** redirect URI:
   `https://<user>.github.io/meeting-facilitator/auth-end.html`.
3. API permissions → Microsoft Graph → **Delegated** → `Calendars.Read` (grant consent if your tenant requires it).
4. In the GitHub repo set variables `ENTRA_CLIENT_ID` (and optionally `ENTRA_TENANT` = your tenant id), then re-run the deploy workflow.

Without this the button is hidden and you paste the agenda instead.

## Post the agenda to the meeting chat (Power Automate recipe)

Use the **Teams webhook** trigger, not "When an HTTP request is received": the HTTP trigger is a *premium*
Power Automate trigger, while Microsoft states the Teams webhook trigger needs no premium license.
Do this once, in https://make.powerautomate.com:

1. **Create → Instant cloud flow**, give it a name, click **Skip** (no trigger yet).
2. **Add a trigger → Microsoft Teams → When a Teams webhook request is received**. Set *Who can trigger the flow* to **Anyone**.
3. **Add an action → Compose**, rename it `Payload`, with the expression `json(string(triggerBody()))`.
4. **Add an action → Microsoft Teams → Post message in a chat or channel** (not "Post card"):
   - *Post as*: **User** (use Flow bot only if User is not offered); *Post in*: **Group chat**;
   - *Group chat*: choose **Enter custom value**, then the expression `outputs('Payload')?['chatId']`;
   - *Message*: the expression `outputs('Payload')?['message']`.
5. Save the flow, copy the **HTTP POST URL** from the trigger, and paste it into the app (*Share the agenda in the meeting chat → Flow URL*). Tick the checkbox to post on every save.

The app sends a Teams "message with an adaptive card" (`type`, `attachments[]`, which is what the Teams
webhook trigger validates) plus our own fields `chatId`, `message` (HTML), `text`, `totalMinutes` and
`items[]`, as a normal `application/json` request. The trigger validates the body against a schema, so
it must be real JSON (a text/plain body is rejected with "Expected Object but got String"). That makes
the browser first ask the flow whether web pages may call it (CORS); if the flow refuses, the app says
it could not reach the flow. A rejection shows the flow's own explanation next to the HTTP status; the
flow's **Run history** in Power Automate shows what happened after it accepted the request.
The footer's "chat id ok/missing" tells you whether Teams gave the app the meeting chat's id.
Treat the URL like a password: anyone who has it can make your flow post, so never commit it.
The message is posted as you. Your tenant may restrict "Anyone" triggers or the Teams connector.

## Checks that only a real meeting can prove

- [ ] App installs and the config page's **Save** creates the tab (manifest + RSC permissions accepted).
- [ ] Two participants see the same agenda, current item and countdown (Live Share sync).
- [ ] The organizer/presenter sees the controls; an attendee sees "View only".
- [ ] Agenda saved before the meeting is still there, and starts by itself when you open the app in the meeting.
- [ ] A late joiner gets the current state.
- [ ] Meeting side panel during the live meeting.
- [ ] End the meeting for everyone, start it again: the agenda restarts from item 1.
- [ ] **Show on stage** puts the big view on the stage for everyone (needs the v1.1.0 package).
- [ ] **Agenda in chat**: *Copy agenda* works (or the text can be selected by hand); with a flow URL set, Save posts the agenda to the meeting chat once, and Save again with no change posts nothing (needs the flow to allow calls from web pages).
- [ ] **Load from invite**: sign-in popup, event found, agenda and length filled in.

## Known limits

- Live Share content views work on Teams desktop and web only (not mobile).
- State lives in the Live Share session (≤ 24 h); there is no history after the meeting.
- Role gating is enforced in the UI. The shared state is a Fluid `SharedMap`, which does not
  check roles per write; use Live Share's `allowedRoles` objects if hard enforcement is needed.
