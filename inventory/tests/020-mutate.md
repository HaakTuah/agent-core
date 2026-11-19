- `scripts/mutate.mjs`, `scripts/strength.mjs`: the mutation tool puts faults into the lines a change touches, one at a
  time, and writes the open mutation report, which the strength check reads to say how strong the tests are. *Runs:* any
  session and the runners. *Else:* StrykerJS (Apache-2.0, 176 packages) and Stryker.NET, kept, tried above; mutmut and
  Cosmic Ray for Python, kept for a Python project. *Bugs:* 0. **Replace** `mutate.mjs` with Stryker (a tool that only
  runs, fetched at set-up), which put nine times as many faults into the same lines, 63 of them surviving against the
  core's 4, and reaches .NET, which the core's tool does not; its packages are what #488's lookup weighs. **Keep**
  `strength.mjs`: it reads the report every such tool writes, and holds the core's measure.
