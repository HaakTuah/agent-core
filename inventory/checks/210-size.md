- `scripts/size.mjs`, `.github/workflows/size.yml`: fails a pull request that grows what a role reads at its start past
  that role's cap, or raises a cap without its comment; `size.yml` runs it with `scripts/general.mjs` and
  `scripts/shape.mjs`. *Runs:* any session and the runners. *Else:* none found. *Bugs:* 0. **Keep:** nothing fits; the
  caps are the core's.
