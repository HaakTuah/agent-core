- `scripts/json-keys.mjs`: fails a key that stands twice in one object of a JSON file git tracks, which `JSON.parse`
  keeps the last of (#1367); its cases are in `tests/parse-errors-test.mjs`. *Runs:* any session and the runners.
  *Else:* ESLint's `json/no-duplicate-keys` (`@eslint/json`), and Biome's `noDuplicateObjectKeys`, which reads JSON,
  Biome being a candidate of the general linter the inventory marks **try** (`inventory/lacks/010-…`): each dropped on
  an assumption that could be measured, that a linter installed for this one rule costs more than the scan, untried, so
  marked for the challenger; once that linter's trial turns on a rule that reads this, the rule takes this job. The
  small validators the registry holds (`json-dup-key-validator`, `find-duplicated-property-keys`), not weighed for
  upkeep, marked for the challenger too. *Bugs:* 1. **Keep:** the package brings too much, a linter of its own for one
  rule, against a scan of about 100 lines on Node's own modules.
