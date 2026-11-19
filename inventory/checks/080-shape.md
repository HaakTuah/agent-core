- `scripts/shape.mjs`, `scripts/code-shape.mjs`, `scripts/shape-readers.mjs`, `scripts/shape-csharp.mjs`,
  `scripts/shape-python.mjs`, `scripts/csharp-functions.mjs`, `scripts/javascript-functions.mjs`,
  `scripts/python-functions.mjs`, `scripts/tree-walk.mjs`, `scripts/dose.mjs`, `scripts/wait.mjs`, `.github/shape.json`,
  `.github/shape-baseline.json`, `tests/readers-test.mjs`: fails what is new in how the code is put together: a function past its marks for lines,
  depth and branching, an import on a cycle, a file in no system. *Runs:* any session and the runners. *Else:* Lizard
  (MIT, Python, some 30 languages), dropped on fact: its definitions of a branch are fixed in its code (#519's record);
  ESLint's `complexity` and `max-lines-per-function`, dropped on fact: JavaScript alone; dependency-cruiser (MIT, 18
  packages) and madge, for cycles and boundaries, dropped on fact: JavaScript and TypeScript alone, where the check
  reads C# and Python too. *Bugs:* 3. **Keep:** fitting costs more than keeping, each tool knowing one language or
  fixing its definitions; its readers go to the parser, as #486's group 3 and #519's path say, C#'s functions the first
  (`scripts/csharp-functions.mjs`, #529), then JavaScript's and TypeScript's (`scripts/javascript-functions.mjs`), then
  Python's (`scripts/python-functions.mjs`). *Tried:* 19 November 2026 (#723), tree-sitter's JavaScript grammar 0.25.0
  and TypeScript's 0.23.2, on the core's 204 files of JavaScript and every case of the lexer's tests: the same where the
  lexer read by its definition, mended where it misread; the same day, its Python grammar 0.25.0, on 30,902 files of
  Python, likewise. *Replayed:* none: no bug filed names a reader of functions (Python's were of its imports, which
  stay); the review findings its tests hold all read. Its config's shape is held by a schema and ajv
  (`scripts/schemas/shape.json`; #530, item 7).
