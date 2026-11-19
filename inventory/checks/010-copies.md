- `scripts/copies.mjs`, `.github/workflows/copies.yml`, `scripts/blobs.mjs`, `scripts/whole-output.mjs`,
  `scripts/schemas.mjs`, `scripts/schemas/`, `.github/copies.json`, `.github/copies-baseline.json`,
  `tests/copies-tools-test.mjs`: fails a run of code (8 lines) or of the rule files' prose (12 words) that stands in two
  places, unless its baseline lists it; `copies.yml` runs it and the other checks of the part "copies" through
  `scripts/checks.mjs`. *Runs:* any session and the runners. *Else:* jscpd (MIT, maintained, a program for each system,
  224 languages, Markdown among them), kept, tried above; PMD's CPD, dropped on fact: a Java runtime; Simian, dropped on
  fact: no licence the Open Source Initiative approves. *Bugs:* 9, and 4 naming `copies.yml`, the most of any check.
  **Try** jscpd for the finding, its definition taking the core's place by default (#534, point 3); the baseline and the
  near-copies the audit reads stay the core's glue. This weighs again the "Kept" of #486's inventory, whose reason was
  the core's own definition. Its config's shape is held by a schema and ajv (`scripts/schemas.mjs`; #530, item 7).
