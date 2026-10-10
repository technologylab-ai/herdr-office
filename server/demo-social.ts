// Fictional social teaser identity and terminal copy authored by Claude Opus 5.5.
// The IDs select its existing ochre-hour and slate-blocks artwork, without changing the renderer.
export const socialDemo = {
  "secondary": {
    "name": "Cinder CI",
    "folder": "/demo/cinder-ci",
    "workspaceId": "demo-cinder-ci",
    "departmentIds": [
      "demo-cinder-ci:t-builds-2",
      "demo-cinder-ci:t-load-tests-3"
    ],
    "posterFamilies": [
      "ochre-hour",
      "slate-blocks"
    ]
  },
  "terminal": {
    "scenario": "settlement-review",
    "connectionId": "demo:studio",
    "paneId": "demo-w11:p1",
    "title": "Reconcile nightly settlement files",
    "provider": "codex",
    "watchLines": [
      "FICTIONAL DEMO OUTPUT",
      "",
      "Reconcile nightly settlement files",
      "/demo/basalt-ledger",
      "",
      "Loading demo-batch-a.csv, demo-batch-b.csv",
      "Matching rows against ledger snapshot...",
      "  ✓ 1,204 rows matched",
      "  ! 3 rows differ between batch A and B",
      "Plan: overwrite the 3 rows from batch B.",
      "",
      "Ready for your next instruction."
    ],
    "prompt": "Check for duplicate IDs first.",
    "resultLines": [
      "Checking row IDs across both batches...",
      "  ✓ 3 duplicate IDs found in batch B",
      "  ✓ Duplicates skipped, nothing overwritten",
      "  ✓ 1,204 / 1,204 rows reconciled",
      "",
      "Done. Summary: reports/nightly-demo.md"
    ]
  }
} as const;
