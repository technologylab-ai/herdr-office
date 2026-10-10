# Local Herdr bridge

Run from a Herdr-managed terminal, with `HERDR_ENV=1` inherited. No session setup, updates, machine creation or pane changes happen on startup.

```sh
npm run dev
```

The API binds only `127.0.0.1:4318`; Vite at `127.0.0.1:5173` proxies `/api`. For a built app, run `npm run build` then `npm start`; the bridge also serves `dist` at `http://127.0.0.1:4318`.

`GET /api/world` returns `{connections, updatedAt, error?}`. Local sessions are discovered with `herdr session list --json`; saved SSH machines with `herdr machine list --json`. The bridge runs the same session-list command read-only on each enabled SSH host and includes every existing running or stopped session. Profiles with the same explicit SSH destination share one inventory and do not duplicate floors. IDs are `local:<session>` and `ssh:<profile-id>:<session>`. Online connections contain the real `herdr api snapshot` topology, with Office observation metadata on agents. Offline connections have an error and no snapshot. Initial discovery failure returns an empty inventory and an error; it never creates demo agents or rooms.

Agents have `status_since` and `status_since_source: "observed"`. Herdr 0.9.0 reports state and a state-change sequence, but no wall-clock start time. This value therefore records when this bridge first observed the current state. It persists across polls and ordinary output revisions, and resets after state/sequence/terminal changes, missing agents or an offline gap. It is an observed lower bound rather than reconstructed idle history; restarting the bridge begins a new observation timeline.

`GET /api/events` streams named `world` SSE events, including one immediately on connection. Snapshots are polled two seconds after each previous poll completes; discovery refreshes every fifteen seconds. No polls overlap, at most four targets are read concurrently, and slow SSE clients are disconnected rather than buffered indefinitely.

`GET /api/panes/<pane-id>/terminal?connectionId=<id>&source=recent-unwrapped&lines=120` returns `{text}` from the real terminal. Sources are `visible` or `recent-unwrapped`; line limits are 1–500. Reads do not focus a pane or mark an agent seen.

`POST /api/agents/<pane-id>/prompt` accepts `{connectionId, terminalId, text}` and uses `herdr agent prompt` with an explicit pane ID. Only a freshly observed `idle` or `done` agent can receive a normal prompt. `working`, `blocked`, `unknown`, missing agents and replaced terminal occupants are rejected. Successful submission returns `{ok:true,result}`; it acknowledges terminal delivery, not completion of an agent turn. A timeout must not be blindly retried because input may have reached the agent.

`POST /api/panes/<pane-id>/keys` accepts `{connectionId, terminalId, keys:["esc"]}`. It uses Herdr's agent surface for recognized agents, otherwise the pane surface. Supported logical keys include Enter, Escape, Tab, Backspace, Delete, arrows, Home, End, PageUp, PageDown, Space, Ctrl+A–Z, Shift+Tab and F1–F12. The API does not run arbitrary shell commands. Interactive approval controls only receive explicitly requested keys; the bridge never chooses an answer itself.

Every mutation refreshes its selected connection snapshot, validates the selected pane's terminal identity, and serializes input for that desk. All CLI calls use `execFile` and literal arguments with bounded execution time. Local sessions use their discovered socket path rather than inherited focus. Saved machines use noninteractive SSH with a connection deadline and separately quoted remote arguments. User-installed `.local/bin` / `.cargo/bin` binaries take priority over PATH, which can point at an obsolete system installation even while a newer Herdr server is running. Disabled profiles stay offline, stopped sessions are never started, and unknown SSH hosts or authentication failures are reported. Remote inventories are cached for fifteen seconds; failed discovery preserves only already known sessions offline. Configure saved machine profiles in Herdr; the bridge uses them without creating or modifying profiles.

Only the exact localhost or 127.0.0.1 application origins on ports 5173 and 4318 are accepted. Host validation blocks DNS rebinding, cross-site requests are rejected, mutations require a matching Origin and JSON body, and prompt/request sizes are bounded. Error responses use `{error: string, code: string}` and meaningful HTTP statuses.

Backend validation:

```sh
npx tsx --test server/*.test.ts
```

Tests use mocked transport and never send input to the user's live Herdr session. Live smoke checks use snapshot and terminal reads only. The CLI API is not transactional: identity is checked immediately before dispatch, but Herdr's current pane-targeted command interface cannot eliminate the tiny race where an occupant is replaced during command dispatch.
