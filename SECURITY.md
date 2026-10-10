# Security

Herdr Office is a local companion for a trusted user's Herdr sessions. The app
and bridge bind to `127.0.0.1`. Use SSH port forwarding for access from another
computer. The bridge has no multiuser login system; do not expose its port
through a public reverse proxy or change its binding to a public interface.

The bridge validates allowed local Host and Origin values, rejects cross-site
requests, requires JSON bodies for input, and bounds request sizes. Herdr CLI
calls use literal subprocess arguments. Saved remote machines use noninteractive
SSH with independently quoted arguments and connection deadlines.

Reading a terminal does not submit input. Prompts and terminal keys require an
explicit user action and a matching terminal identity checked immediately before
dispatch. Normal prompts are limited to idle/done agents. Enter, Escape and
interrupt controls require confirmation in the interface. The app never chooses
an interactive permission answer. These guards do not make terminal commands
harmless: submitted text and keys act on the selected real terminal.

Herdr's current pane-targeted API has no atomic identity-and-input operation.
A terminal replacement can still race with dispatch after identity validation.
Input is not automatically retried after an ambiguous failure.

The synthetic demo uses its own in-memory API and does not load the live Herdr
bridge, connect to machines, invoke a label model, or submit input to real agents.

Keep security reports private. Use the repository's **Security → Report a
vulnerability** option when available. Do not attach real terminal transcripts,
credentials, machine inventories or personal directory paths to public issues.
See [PRIVACY.md](PRIVACY.md) for the model-labeling data flow.
