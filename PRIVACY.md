# Privacy

In live mode, the local bridge reads the Herdr workspace tree, agent states,
task titles, directory paths and configured machine/session inventory. Selecting
a desk reads that terminal's output and can display it on the in-world monitor.
The browser communicates with the loopback bridge; configured remote sessions
are reached through your saved Herdr SSH profiles. Office does not create those
profiles or install Herdr remotely.

**Task-label refinement uses a remote model by default.** The locally logged-in
Codex CLI sends bounded Herdr task titles, pane labels and directory basenames
to GPT-6 Luna to produce short avatar labels. These metadata strings may contain
private project or task information. Absolute directory paths and terminal
transcripts are not supplied to this labeling helper. The model provider's
account settings and data policies apply to these requests.

Disable model labeling before starting the live app to retain the original
Herdr titles without sending labeling requests:

```sh
HERDR_OFFICE_LABEL_MODEL=off npm run dev
```

For a production build, use `HERDR_OFFICE_LABEL_MODEL=off npm start`. Background
labels are cached in memory, requests are batched and rate limited, and temporary
schema/output files are removed when each invocation finishes. The app does not
maintain a persistent terminal transcript archive.

The browser saves interface preferences, including terminal font size, drawer
width, view settings and a main-agent identity bookmark, in localStorage. Clear
site data to remove these preferences. The bookmark does not create a Herdr role
or write to the bookmarked agent.

The synthetic demo uses invented workspaces, people and terminal text. Its
separate API does not load the live Herdr bridge or invoke model labeling; demo
interactions affect only in-memory fixtures. Public screenshots and teaser
footage are captured from this demo.

Herdr Office contains no analytics or telemetry integration. Live terminal output
and labels can still reveal personal information on screen: use the synthetic
demo for recordings and screenshots intended for sharing.
