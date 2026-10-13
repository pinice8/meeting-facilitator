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

Harness options: `&role=attendee` for the read-only view, `&speed=60` to make a minute pass per second.

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
- [ ] Agenda saved before the meeting is still there when the meeting starts.
- [ ] A late joiner gets the current state.
- [ ] Meeting side panel during the live meeting.
- [ ] **Load from invite**: sign-in popup, event found, agenda and length filled in.

## Known limits

- Live Share content views work on Teams desktop and web only (not mobile).
- State lives in the Live Share session (≤ 24 h); there is no history after the meeting.
- Role gating is enforced in the UI. The shared state is a Fluid `SharedMap`, which does not
  check roles per write; use Live Share's `allowedRoles` objects if hard enforcement is needed.
