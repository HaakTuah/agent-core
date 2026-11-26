- `scripts/json-keys.mjs`: fails a key that stands twice in one object of a JSON file git tracks, which `JSON.parse`
  keeps the last of (#1367); its cases are in `tests/parse-errors-test.mjs`. *Runs:* any session and the runners.
  *Else:* ESLint's JSON rule for duplicate keys, dropped as an assumption to measure: it runs only with ESLint and a
  config of its own installed for the one rule, which the core's other checks need none of, and no trial of it has been
  made. *Bugs:* 1. **Keep:** a scan of under 60 lines on Node's own modules.
