// Tests the same reading on a name however it ends, what a step is given beside its run and texts that try it: environments of any shape,
// actions and calls read once and bounded, globs and quotes in the script's name, each read in one pass or not read
// (#530), and a step's commands on the parser's bash grammar (bash-commands.mjs). Node's own modules.
//
//   node tests/steps-run-hostile-test.mjs
import { spawnSync } from "node:child_process";
import { CURL, linear, inMemory, stepped, copiesOf, notRead } from "../scripts/steps-kit.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { configs } from "../scripts/steps.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
// (the grammar's time for a step's text, 500 ms, is what a text that runs past it is lost to, and a runner under load
// takes a text that reads within it elsewhere past it: the cases here that read a text are given a time load cannot
// exhaust, and the case that tests the time itself runs a process of its own with the time it has; #1163)
process.env.CORE_BASH_PARSE_MS = "60000";

// (the review of 8b368b1: a naming however it ends, set in passing or in env:, in another case or spelling, and a run
// by a path the reader cannot place, are not read; node --test $RUN, which names no script, reads as before)
const withEnv = (run, env) => ({ "a.yml": { jobs: { j: { steps: [{ run, env }] } } } });
ok(["S=${S:-core/scripts/copies.mjs}\nnode $S bad.json", "x=`echo core/scripts/copies.mjs`\nnode $x bad.json", "printf -v S core/scripts/copies.mjs\nnode $S bad.json",
  ": ${S:=core/scripts/copies.mjs}\nnode $S bad.json", "node core/Scripts/copies.mjs bad.json", "node core/scripts/Copies.mjs bad.json",
  "node core/scripts/{copies,}.mjs bad.json", "cd core/scripts && node copies.mjs bad.json", `${CURL} -so x.mjs file://$PWD/core/scripts/copies.mjs\nnode x.mjs bad.json`]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && notRead("copies", withEnv("node $S bad.json", { S: "core/scripts/copies.mjs" }))
  && copiesOf({ "a.yml": stepped("node --test $RUN\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json" && copiesOf({ "a.yml": stepped("node core/scripts/x/../copies.mjs c.json") }) === "c.json",
  "a naming however it ends, set in passing or in env:, in another case or spelling, and a run the reader cannot place, are not read; node --test $RUN is no run of it, and core/scripts/x/../copies.mjs is the copy's");
// (the review of 35e05e0: what a step is given beside its run, read safely and once: an env: of any shape, a matrix, a
// local workflow's call)
ok(copiesOf(withEnv("node core/scripts/copies.mjs config/c.json", { S: { toString: "x", valueOf: "y" } })) === "config/c.json"
  && notRead("copies", { "a.yml": { jobs: { j: { strategy: { matrix: { script: ["core/scripts/copies.mjs"] } }, steps: [{ run: "node ${{ matrix.script }} bad.json" }] } } } })
  && notRead("copies", { "a.yml": { jobs: { c: { uses: "./.github/workflows/b.yml", with: { script: "core/scripts/copies.mjs" } } } }, "b.yml": stepped("node ${{ inputs.script }} bad.json") }),
  "an env: of any shape is read without a throw; a matrix or a local workflow's call that names the script leaves its run not read");
const manyEnvs = linear(n => {
  const manyEnv = Object.fromEntries(Array.from({ length: n }, (_, k) => [`E${k}`, `v${k}`])), manySteps = Array.from({ length: n }, (_, k) => ({ run: `echo ${k}` }));
  return () => copiesOf({ "a.yml": { env: manyEnv, jobs: { j: { env: manyEnv, steps: manySteps } } } }) === "checks/copies.json";
}, 250, 2000);
ok(manyEnvs.right && manyEnvs.linear, "a workflow's and a job's env: are read once, however many steps", manyEnvs.shown);
ok(notRead("copies", { "a.yml": stepped('node "$GITHUB_WORKSPACE/core/scripts/copies.mjs" c.json', { "working-directory": "app\\dir" }) }), "a folder with \"\\\" in it is not read as one");
// (the review of b69d16f: a script given by an expression of GitHub's, or in a mapping too large to read whole, and a
// key named __proto__, leave the run not read)
ok(notRead("copies", { "a.yml": stepped("node ${{ inputs.script }} bad.json") }) && notRead("copies", { "a.yml": stepped("node ${{ needs.a.outputs.s }} bad.json") })
  && notRead("copies", { "a.yml": { jobs: { j: { strategy: { matrix: { s: Array.from({ length: 100001 }, (_, k) => `v${k}`) } }, steps: [{ run: "echo x" }] } } } })
  && notRead("copies", { "a.yml": { jobs: { j: { steps: [{ run: "node $__proto__ bad.json", env: parseYaml("__proto__: core/scripts/copies.mjs\n") }] } } } }),
  "a script given by an expression of GitHub's, a mapping too large to read whole, and a key named __proto__ leave the run not read");
// (Codex's review of 8237183 and the review after it: a local action's steps are given what its caller is given; a
// file of another plain name past an expression is no run of the script)
ok(notRead("copies", { "a.yml": { env: { CHECK: "core/scripts/copies.mjs" }, jobs: { j: { steps: [{ uses: "./.github/actions/c" }] } } } }, { ".github/actions/c/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node \"$CHECK\" config/custom.json\n      shell: bash\n" })
  && copiesOf({ "a.yml": stepped("node ${{ github.action_path }}/index.js\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json",
  "a local action is read with what its caller gives it; a file of another plain name past an expression is no run of the script");
// (the review of 165db25: actions read once, and their steps, calls and depth bounded; a glob or a "/" after the name)
// (past the bound the run is not read and the work stops there, so it grows no faster than the input, though the bound does not hold it flat)
const fan = linear(n => {
  const files = { ".github/actions/a/action.yml": `runs:\n  using: composite\n  steps:\n${"    - uses: ./.github/actions/b\n".repeat(n - 1)}`, ".github/actions/b/action.yml": `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(n)}` };
  return () => notRead("copies", { "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/a" }] } } } }, files);
}, 200, 1999);
ok(fan.right && fan.linear, "actions called thousands of times are read once each, and past the bound the run is not read", fan.shown);
const chain = linear(n => {
  const files = Object.fromEntries(Array.from({ length: n }, (_, k) => [`.github/actions/c${k}/action.yml`, `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(n / 40)}    - uses: ./.github/actions/c${k + 1}\n`]));
  return () => notRead("copies", { "a.yml": { env: { A: "x" }, jobs: { j: { steps: [{ uses: "./.github/actions/c0" }] } } } }, files);
}, 200, 2000);
ok(chain.right && chain.linear, "a long chain of actions is read no deeper than the bound", chain.shown);
ok(['node "$CORE"/scripts/copies.mj? c.json', "node $CORE/scripts/copie[s].mjs c.json", "node $CORE/scripts/copies.* c.json", "node $C/copies.mjs/ c.json", "node ${{ github.action_path }}/copies.mjs/ c.json", "node core/scripts/copies.mj? c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && copiesOf({ "a.yml": stepped("node --test tests/*.mjs\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json",
  "a glob or a \"/\" after the script's name leaves the run not read; a glob in a folder that is no scripts folder is no run of it");
// (the review of f1663f5: a glob in the script's own name matched against the script's; what a step is given counted
// through the shared lists, never flattened again)
ok(["node copies.mj? c.json", "node ./copies.* c.json", "node * c.json", "node $D/copies.mj? c.json"].every(run => notRead("copies", { "a.yml": stepped(run, { "working-directory": "core/scripts" }) }))
  && ["node --test **/*.test.mjs", 'node --test "**/*.test.mjs"', "node --test test/**/*.mjs", "node --test scripts/*.test.mjs"].every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"),
  "a glob that can match the script's name, in its folder, is not read; one that cannot is no run of it");
// (the review of 8b78d8e: a glob after a cd or in a folder named only when it runs is not read, never a throw; a glob
// of many stars is read in one pass; braces, classes and ** may match)
ok(["cd app && node core/scripts/c*.mjs c.json", "pushd x; node ../core/scripts/copies.mj? c.json", "node core/scripts/{cop*,x}.mjs c.json", "node core/scripts/[[:alpha:]]opies.mjs c.json", "node core/**/s*/c*.mjs c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && notRead("copies", { "a.yml": stepped("node s*/c*.mjs c.json", { "working-directory": "${{ inputs.d }}" }) }),
  "a glob after a cd, in a folder named only when it runs, or with braces, a class or ** that may match, is not read");
const stars = linear((n, k) => notRead("copies", { "a.yml": stepped(`node core/scripts/${"*".repeat(n)}x c.json\nnode core/${"*".repeat(n)}/copies.mjs c.json # ${k}`) }), 10, 40);
ok(stars.right && stars.linear, "a glob of many stars is read in one pass", stars.shown);
// (the review of 5f229be: any class may match, read in one pass; a folder's "/" at its end is no other folder)
const classes = linear((n, k) => ["core/scripts/copie[]s].mjs", "core/scripts/copie[!]a].mjs", "core/scripts/[a[:alpha:]]opies.mjs", "core/scripts/[^[:digit:]]opies.mjs", `core/scripts/${"[a".repeat(n)}]x`]
  .every(f => notRead("copies", { "a.yml": stepped(`node ${f} c.json # ${k}`) })) && notRead("copies", { "a.yml": stepped("node copies.mj? c.json", { "working-directory": "core/scripts/" }) }), 12500, 100000);
ok(classes.right && classes.linear,
  "a class in any form may match, read in one pass; a folder named with a \"/\" at its end is that folder", classes.shown);
ok(configs(inMemory({ "a.yml": stepped("node core/scripts/reading-size.mjs config/sizes*.json") })).sizes === null && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs config/c?.json") })
  && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs 'config/c*.json'") }) === "config/c*.json", "a config given as an unquoted glob is not read; a quoted one is a file's name");
// (the review of 3546fd8: an extended glob of bash's may match; a run of "/" is read in one pass)
ok(["c?(x)opies.mjs", "+(c)opies*.mjs", "!(x)*.mjs", "@(copies|x).mjs", "!(x).mjs", "copies.@(mjs)"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode core/scripts/${f} c.json`) }))
  && ["core/?(x)scripts/c*.mjs", "core/@(scripts)/c*.mjs"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode ${f} c.json`) })),
  "an extended glob of bash's, in the script's name or its folder, may match, so the run is not read");
const slashes = linear((n, k) => copiesOf({ "a.yml": stepped(`node core/scripts${"/".repeat(n)}x*.mjs c.json\nnode core/scripts/copies.mjs c.json # ${k}`) }) === "c.json", 12500, 100000);
ok(slashes.right && slashes.linear, "a run of \"/\" is read in one pass", slashes.shown);
// (on the parser, #530: a text the grammar cannot read within its time is not read at all, since a line read alone
// would misread a quote or a continued line over it; the fallback reviewer's review of 4ffb50d)
// (in a process of its own, under the time the reader has: a busy runner only makes the text run further past it)
const hostile = spawnSync(process.execPath, ["--input-type=module", "-e", `import { notRead } from ${JSON.stringify(new URL("../scripts/steps-kit.mjs", import.meta.url).href)};
process.exit(notRead("copies", { "a.yml": { jobs: { j: { steps: [{ run: "echo " + "a?(b)".repeat(100000) + "\\nnode core/scripts/copies.mjs c.json" }] } } } }) ? 0 : 1);`],
  { encoding: "utf8", timeout: 60000, env: { ...process.env, CORE_BASH_PARSE_MS: "" } });
ok(hostile.status === 0, "a long line of extended globs leaves its step not read, which the grammar's own budget decides", `status ${hostile.status} (null: it ran past its 60 s limit, as a budget gone would; a parse the budget stops takes about a second): ${hostile.stdout}${hostile.stderr}`);
const oneRun = { ".github/actions/a/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      shell: bash\n" };
const givenEnv = linear(n => {
  const bigEnv = Object.fromEntries(Array.from({ length: n }, (_, k) => [`E${k}`, `v${k}`]));
  return () => copiesOf({ "a.yml": { jobs: { j: { env: bigEnv, steps: Array.from({ length: n / 450 }, () => ({ uses: "./.github/actions/a" })) } } } }, oneRun) === "checks/copies.json";
}, 12375, 99000);
ok(givenEnv.right && givenEnv.linear,
  "a large env: given to many calls of an action is read once", givenEnv.shown);
// ---- a step's commands on the parser's bash grammar (bash-commands.mjs; #530, item 3): where the grammar the core
// installs reads otherwise than bash, the reader mends it from the tree ----
{
  const { bashCommands } = await import("../scripts/bash-commands.mjs");
  const shown = run => bashCommands(run).map(c => c.map(w => `${w.text}${w.dynamic ? "*" : ""}`).join(" "));
  ok(JSON.stringify(shown("a=1 b=2\nnode core/scripts/copies.mjs c.json")) === JSON.stringify(["a=1 b=2", "node core/scripts/copies.mjs c.json"]),
    "assignments on a line of their own are a command apart from the next line's, where the grammar joins them");
  ok(JSON.stringify(shown("node core/scripts/copies.mjs > log c.json 2>&1 d.json")) === JSON.stringify(["node core/scripts/copies.mjs c.json d.json"]),
    "the words after a redirection's file are the command's arguments, as bash gives them, where the grammar gives them to the redirection");
  ok(JSON.stringify(shown("node core/scripts/c?(x)opies.mjs c.json")) === JSON.stringify(["node core/scripts/c?(x)opies.mjs* c.json"]) && JSON.stringify(shown('echo "a?(b)"')) === JSON.stringify(["echo a?(b)"]),
    "an extended glob is part of its word, filled when it runs, where the grammar reads a subshell; in quotes it is text");
  ok(JSON.stringify(shown("echo ${{ inputs.a }}x 'y${{ b }}'\ncat <<EOF\nnode no\nEOF\nnode yes")) === JSON.stringify(["echo ${{ inputs.a }}x* y${{ b }}*", "cat", "node yes"]),
    "an expression of GitHub's is filled when it runs, quoted or not, and a here-document's lines are no commands");
  ok(JSON.stringify(shown("cat <<OPEN\nnode core/scripts/copies.mjs c.json")) === JSON.stringify(["cat", "node core/scripts/copies.mjs c.json"]),
    "a here-document with no line that ends it leaves its lines read as commands, so that no run is missed");
  ok(JSON.stringify(shown('echo "$(node a.mjs)" `node b.mjs`')) === JSON.stringify(['echo $(node a.mjs)* `node b.mjs`*', "node a.mjs", "node b.mjs"]),
    "a command inside $( ) or ` ` is a command of its own, its output a word filled when it runs");
  // (Codex's security review of 76119ae: "!" turns a command's status over, so a check run under it cannot fail)
  ok(JSON.stringify(shown("! node core/scripts/lookup.mjs c.json\nif ! node a.mjs; then x; fi")) === JSON.stringify(["! node core/scripts/lookup.mjs c.json", "! if", "! node a.mjs", "! x"])
    && notRead("copies", { "a.yml": stepped("! node core/scripts/copies.mjs config/c.json") }),
    "a \"!\" in a step leads each of its commands, and a check's run under it is not read as its run");
// (Codex's review of d32e5f0: a command inside a function, a loop, an if, a case or a { } group may run once, many
// times or never, so its keyword is a command of its own, and the step is never one command run once)
ok(["check() { node core/scripts/lookup.mjs c.json; }", "for f in; do node core/scripts/lookup.mjs c.json; done", "case x in y) node core/scripts/lookup.mjs c.json;; esac",
  "while false; do node core/scripts/lookup.mjs c.json; done", "{ node core/scripts/lookup.mjs c.json; }"].every(run => { const c = shown(run); return c.length > 1 && c.includes("node core/scripts/lookup.mjs c.json"); })
  && JSON.stringify(shown("until x; do y; done")) === JSON.stringify(["until", "x", "y"]),
  "a command inside a function, a loop, a case or a group is read with its keyword as a command before it, so no such step reads as one command run once");
// (the fallback reviewer's check of ccee6c9: a here-document opened in a subshell is data to its delimiter's line, as
// bash reads it; a subshell at a step's start is no extended glob)
ok(copiesOf({ "a.yml": stepped("(cat <<E)\nnode core/scripts/copies.mjs config/fake.json\nE\nnode core/scripts/copies.mjs config/c.json") }) !== "config/fake.json"
  && JSON.stringify(shown("(cat <<\"E\")\nnode fake.mjs\nE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("cat <<A <<-B\nnode x.mjs\nA\nnode y.mjs\n\tB\nnode z.mjs")) === JSON.stringify(["cat", "node z.mjs"])
  && JSON.stringify(shown("cat <<E\n\tE\nnode fake.mjs\nE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("cat <<-E\n\tE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("( node core/scripts/lookup.mjs c.json )")) === JSON.stringify(["node core/scripts/lookup.mjs c.json"]),
  "a here-document opened in a subshell, or second on its line, holds its lines as data to its delimiter's line, tabs before it ending only a '<<-', and a subshell at a step's start is read as one");
// (the fallback reviewer's check of d32e5f0: a folder changed behind "!" is changed, and a pipeline under it is led by
// it in each of its commands)
ok(["! cd app; node core/scripts/copies.mjs config/c.json", "! pushd app\nnode core/scripts/copies.mjs config/c.json", "! echo x | node core/scripts/copies.mjs config/c.json",
  "! { echo x; } | node core/scripts/copies.mjs config/c.json", "true\n! false\nnode core/scripts/copies.mjs config/c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a folder changed behind \"!\" leaves the run after it not read, and so does a check's run in a step that holds \"!\" anywhere, a pipeline's or a group's under it among them");
}

done("steps-run-hostile");
