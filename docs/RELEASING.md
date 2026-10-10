# Release checks

Build public media from the synthetic demo, with a fresh browser profile. Keep
real terminal output, machine inventories, workspace paths and private task
titles out of screenshots, recordings and example fixtures.

Before publishing a source snapshot:

- Inspect every branch, tag and reachable commit, including author and committer
  metadata. Changing the latest files does not remove older personal data.
- Scan credentials with a redacted report, for example
  `gitleaks git --log-opts=--all --redact`. Also inspect names, email addresses,
  machine names and local paths; credential scanners do not identify all personal
  information.
- Inspect media visually and with OCR, and check image/video metadata. Parse GLB
  JSON and decompress the editable Blender source to inspect saved file-browser
  paths and other embedded data. Model regeneration clears file-browser history.
- Check repository descriptions, issues, releases, CI logs and retained artifacts
  for private content. A clean source tree does not sanitize these surfaces.
- Include only intended release files. Exclude `.git` from an export, `.env`,
  ignored `artifacts/`, browser profiles, traces and raw production-session data.
- Use an organization or GitHub noreply identity for new public commits.
- Verify the license, [privacy disclosure](../PRIVACY.md) and
  [security policy](../SECURITY.md). Enable private vulnerability reporting on the
  public repository.

Run the required validation against the final source:

```sh
npm ci
npm audit
npm test
npm run test:browser
npm run build
npm run demo
```

The demo must serve only invented data, reject unknown/live targets, and retain
the fictional-output disclosure in terminal interactions. Production capture
scripts additionally restrict their origin to the isolated demo and abort
external requests.

If private history contains personal information, create a new repository from
the audited export rather than assuming a force-push erases it. GitHub documents
that old objects can remain available through cached SHA views, pull-request
references and existing clones. See
[GitHub's history-cleanup guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Keep the audit evidence privately. A public checklist should record what passed
without reproducing the private values that were removed.
