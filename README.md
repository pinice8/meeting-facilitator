# Meeting Facilitator

A Microsoft Teams meeting app. Add it to a meeting, give it the agenda, and it splits the
meeting time across the items. Everyone sees the current item, a live countdown and whether the
meeting is ahead or behind; organizers and presenters move between items.

- **Static app, no backend.** Hosted on GitHub Pages. Everyone's view is synced through
  [Live Share](https://learn.microsoft.com/microsoftteams/platform/apps-in-teams-meetings/teams-live-share-overview)
  (Microsoft-hosted, data kept up to 24 h).
- **Agenda input:** paste text (`Demo - 10`, `Demo (10 min)`, …) or **Load from invite** (reads the
  calendar event through Microsoft Graph; needs the Entra setup below).
- **Time split:** items with minutes keep them; the rest of the meeting is divided evenly across the
  others. Over-long plans are flagged, never silently rescaled.
- **Starts by itself.** Save the agenda before the meeting (chat tab → *Save agenda*). When an
  organizer or presenter opens the app inside the live meeting (side panel / stage) the saved agenda
  starts running. A saved run counts as "in progress" only if another participant has the app open in
  the meeting (Live Share presence) or a facilitator panel was seen in the last 30 s (heartbeat every
  10 s, which also covers a panel reload). Otherwise it belongs to a meeting that ended, and it is
  restarted from item 1 (or, in the pre-meeting chat tab, shown as "ready" again). There is also a
  manual **Restart** button. Teams gives tab apps no "meeting started/ended" event (that needs a bot +
  backend), so "started" means "a facilitator opened the app in the meeting"; ending and rejoining
  within ~30 s continues the same run.
- **Top bar.** A bar pinned to the top shows the running item first, filling as its time passes
  (green → amber → red), then the upcoming items; widths follow the planned minutes.
- **Meeting stage.** An organizer/presenter clicks **Show on stage** in the side panel; everyone then
  sees a full-width read-only view (big bar across the top, huge countdown, what is next). Needs the
  manifest's `meetingStage` context (v1.1.0+).
- **Floating strip.** **Pop out strip** (any user) opens the bar in a small always-on-top window
  (Document Picture-in-Picture, falling back to a pop-up) to drag to the top of your screen. It is
  per user and does not use the meeting stage, so others can still share. Whether Teams allows the
  window from inside a tab is the thing to check.
- **During the meeting:** Previous / Pause / Next / Rebalance / End. Overrun goes red and counts
  up; it never auto-advances. *Rebalance* redistributes the remaining time across the remaining items.

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
3. API permissions → Microsoft Graph → Delegated → `Calendars.Read` (grant consent if your tenant requires it).
4. In the GitHub repo set variables `ENTRA_CLIENT_ID` (and optionally `ENTRA_TENANT` = your tenant id), then re-run the deploy workflow.

Without this the button is hidden and you paste the agenda instead.

## Checks that only a real meeting can prove

- [ ] App installs and the config page's **Save** creates the tab (manifest + RSC permissions accepted).
- [ ] Two participants see the same agenda, current item and countdown (Live Share sync).
- [ ] The organizer/presenter sees the controls; an attendee sees "View only".
- [ ] Agenda saved before the meeting is still there, and starts by itself when you open the app in the meeting.
- [ ] A late joiner gets the current state.
- [ ] Meeting side panel during the live meeting.
- [ ] **Pop out strip** opens a small window with the bar (the footer shows the build, e.g. v1.2.0).
- [ ] End the meeting for everyone, start it again: the agenda restarts from item 1.
- [ ] **Show on stage** puts the big view on the stage for everyone (needs the v1.1.0 package).
- [ ] **Load from invite**: sign-in popup, event found, agenda and length filled in.

## Known limits

- Live Share content views work on Teams desktop and web only (not mobile).
- State lives in the Live Share session (≤ 24 h); there is no history after the meeting.
- Role gating is enforced in the UI. The shared state is a Fluid `SharedMap`, which does not
  check roles per write; use Live Share's `allowedRoles` objects if hard enforcement is needed.
