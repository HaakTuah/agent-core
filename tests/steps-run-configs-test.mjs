// Tests the reading of the configs a project's workflows give its checks (check-configs.mjs, through steps.mjs's
// `configs` and `runsOwn`) on workflows in memory: a script a step runs, its argument as the shell reads it, and each
// config read as its check is run, from every source the project gives it and not read where they differ or one cannot
// be known (#386). Node's own modules.
//
//   node tests/steps-run-configs-test.mjs
import { kind } from "../scripts/fresh.mjs";
import { linear, inMemory, stepped, coreCall, copiesOf, notRead } from "../scripts/steps-kit.mjs";
import { STEPS, Unread, configs, runsOwn } from "../scripts/steps.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-run-configs-");

const dotted = { files: [], read: () => null, manifest: "", workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: "node ./core/scripts/licences.mjs a.json\nnode vendor/core/scripts/copies.mjs b.json" }] } } } } } };
ok(runsOwn(dotted, "licences.mjs").length === 1 && runsOwn(dotted, "copies.mjs").every(r => r.unsure) && runsOwn(dotted, "copies.mjs").length === 1,
  "a script started as ./core/scripts/ is run; one under another folder's core/scripts/ is not the copy's, and not read");
// (the argument read as the shell reads it: past an option, through a line's continuation, quoted, and after a quoted
// script; and a slot read in its own cell, past the script and any command)
const passing = (run, manifest = "") => configs({ ...dotted, manifest, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run }] } } } } } }).copies;
ok(passing("node core/scripts/copies.mjs --first config/c.json") === "config/c.json" && passing("node core/scripts/copies.mjs \\\n  config/c.json") === "config/c.json"
  && passing('node core/scripts/copies.mjs "config/my copies.json"') === "config/my copies.json" && passing('node "./core/scripts/copies.mjs" config/c.json') === "config/c.json"
  && passing("echo none", "| *copies check* | `node core/scripts/copies.mjs` with `config/s.json` | more `x.json` |\n") === "config/s.json",
  "an argument is read past an option, a line's continuation and quotes, and the slot in its own cell past the script");
ok(configs({ ...dotted, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: 'node core/scripts/copies.mjs "${{ inputs.c }}"' }] } } } } } }).copies === null, "a quoted argument that names it only when the workflow runs is not read");
ok(passing("# a note \\\nnode core/scripts/copies.mjs config/c.json") === "config/c.json", "a comment that ends in a backslash continues nothing, as the shell reads it");
// (#386: each config read as its check is run, from every source the project gives it, and not read where they differ
// or one cannot be known)
ok(copiesOf({ "a.yml": stepped('echo "mend: node core/scripts/copies.mjs <config>"\nprintf "%s" core/scripts/copies.mjs x.json') }) === "checks/copies.json",
  "a script a line only names, as in a message, is not read as run: only one node starts is");
ok(copiesOf({ "a.yml": stepped('node core/scripts/copies.mjs "config/a # b.json"') }) === "config/a # b.json" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs config/c.json # its config") }) === "config/c.json",
  "a \" #\" inside quotes cuts nothing short; one outside them starts a comment");
ok(["node $GITHUB_WORKSPACE/core/scripts/copies.mjs config/c.json", 'node "${{ github.workspace }}/core/scripts/copies.mjs" "$GITHUB_WORKSPACE/config/c.json"',
  "node ${GITHUB_WORKSPACE}/core/scripts/copies.mjs ./config/c.json", "node --no-warnings core/scripts/copies.mjs --first config/c.json"]
  .every(run => copiesOf({ "a.yml": stepped(run, {}, { "runs-on": "ubuntu-latest" }) }) === "config/c.json"), "the checkout's root as a workflow names it and node's options read as the shell reads them");
{
  const rooted = (run, step = {}, job = {}, top = {}) => copiesOf({ "a.yml": stepped(`node core/scripts/copies.mjs ${run}/config/c.json`, step, job, top) });
  ok(rooted("%GITHUB_WORKSPACE%", { shell: "cmd" }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": "windows-latest" }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", {}, { "runs-on": ["self-hosted", "linux"], defaults: { run: { shell: "bash -e {0}" } } }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", {}, {}, { defaults: { run: { shell: "sh" } } }) === "config/c.json" && rooted("${{ github.workspace }}") === "config/c.json",
    "the root is read as the step's shell names it, the expression in any shell");
  ok([["%GITHUB_WORKSPACE%", { shell: "bash" }], ["%GITHUB_WORKSPACE%", {}, { "runs-on": "ubuntu-latest" }], ["$GITHUB_WORKSPACE", {}, { "runs-on": "windows-latest" }],
    ["$GITHUB_WORKSPACE", { shell: "cmd" }], ["$env:GITHUB_WORKSPACE", { shell: "bash" }], ["$GITHUB_WORKSPACE"], ["$GITHUB_WORKSPACE", {}, { "runs-on": "${{ matrix.os }}" }],
    ["$GITHUB_WORKSPACE", { shell: "python" }], ["$GITHUB_WORKSPACE", { shell: ["bash"] }]].every(a => rooted(...a) === null),
    "a root named as another shell names it, or where the step's shell cannot be told, is not read as the root");
  ok(rooted("$ENV:GITHUB_WORKSPACE", { shell: "pwsh" }) === "config/c.json" && rooted("%github_workspace%", { shell: "cmd" }) === "config/c.json"
    && rooted("${{ GITHUB.Workspace }}", { shell: "bash" }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", { shell: "/bin/bash -e {0}" }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", { shell: "powershell.exe" }) === "config/c.json"
    && rooted("$github_workspace", { shell: "bash" }) === null && rooted("$env:github_workspace", { shell: "pwsh" }, { "runs-on": "ubuntu-latest" }) === null,
    "a root's name read in any case only where its shell reads it so (cmd's, PowerShell's env: drive, GitHub's expression), and a shell named by its path");
  const labelled = linear(n => () => copiesOf({ "a.yml": { jobs: { j: { "runs-on": [...Array.from({ length: n }, (_, k) => `l${k}`), "ubuntu-latest"],
    steps: [...Array.from({ length: 4 * n }, () => ({ run: "echo x" })), { run: "node core/scripts/copies.mjs $GITHUB_WORKSPACE/config/c.json" }] } } } }) === "config/c.json", 500, 4000);
  ok(labelled.right && labelled.linear, "a job's many labels, over many steps, are read once", labelled.shown);
  ok(copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs config/c.json", { "working-directory": "%GITHUB_WORKSPACE%/app" }, { "runs-on": "ubuntu-latest" }) }) === null, "a folder named by a shell's variable, which no shell fills there, is not read");
  // (a macOS runner's shell is bash; an organisation's runner group may hold Windows machines, so its shell cannot be told)
  ok(["macos-latest", "macos-14"].every(r => rooted("$GITHUB_WORKSPACE", {}, { "runs-on": r }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": r }) === null)
    && [{ group: "org-runners" }, { group: "org-runners", labels: ["ubuntu-latest"] }].every(r => rooted("$GITHUB_WORKSPACE", {}, { "runs-on": r }) === null && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": r }) === null),
    "on a macOS runner the root is read as bash names it; on an organisation's runner group, whose shell cannot be told, in no shell's spelling");
}
// (the same runners, read by the new-package step for whether a lookup's failure stops its step: a macOS runner's bash
// does; a runner group's shell, which may be Windows' pwsh, cannot be told, so its lookup does not count)
{
  const lookupStep = STEPS.find(s => s.lead === "16 November 2026, a new package looked up");
  const on = runner => lookupStep.check({ ...inMemory({ "a.yml": { on: { pull_request: null }, jobs: { a: { "runs-on": runner, steps: [{ uses: "actions/checkout@v7", with: { "fetch-depth": 2 } },
    { run: "node core/scripts/lookup.mjs c.json --nuget" }, { run: "node core/scripts/nuget.mjs c.json" }] } } } }), root: tmp });
  ok(on("ubuntu-latest") === null && on("macos-latest") === null && [{ group: "org-runners" }, { group: "org-runners", labels: ["ubuntu-latest"] }].every(r => on(r)?.includes("add a step that runs `node core/scripts/lookup.mjs`")),
    "a NuGet lookup on a macOS runner counts, as on Linux; one on an organisation's runner group does not");
}
// (a .NET project known by a solution or a project file of any of its languages: each reads as NuGet, in its folder)
ok([["src/App.sln", "src"], ["src/App.slnx", "src"], ["src/App/App.fsproj", "src/App"], ["src/App/App.vbproj", "src/App"], ["App.sln", "."], ["src/App.SLN", "src"]].every(([f, at]) => kind({ ...inMemory({}, { [f]: "<Project />\n" }), root: tmp }).o.nuget === at),
  "a project holding only a .sln, .slnx, .fsproj or .vbproj, in any case, reads as a NuGet project, set up in that file's folder");
ok(["node core\\scripts\\copies.mjs config\\c.json", 'node "core\\scripts\\copies.mjs" "config\\c.json"', "node core/scripts/copies.mjs 'config\\c.json'"].every(run => copiesOf({ "a.yml": stepped(run) }) === null),
  "a path with \"\\\", one file on Windows and another on Linux, is not read");
ok(copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs ../config/c.json", { "working-directory": "app" }) }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs ../config/c.json", {}, { defaults: { run: { "working-directory": "app" } } }) }) === "config/c.json",
  "a step run in a folder of its own reads its paths from there");
ok(notRead("copies", { "a.yml": stepped("node ../core/scripts/copies.mjs c.json", { "working-directory": "${{ inputs.at }}" }) })
  && notRead("copies", { "a.yml": stepped("cd app && node ../core/scripts/copies.mjs c.json") })
  && notRead("copies", { "a.yml": stepped('node "$CORE_AT"scripts/copies.mjs c.json') }) && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs --first") }),
  "a step whose folder or script is named only when it runs, one that changes its folder first, and a run with no config are not read");
const nugetRun = inMemory({ "l.yml": coreCall("licences.yml", { config: "checks/licences.json" }), "n.yml": stepped("node core/scripts/nuget.mjs config/n.json") });
ok(configs(nugetRun).nuget === "config/n.json" && configs(nugetRun).licences === "checks/licences.json", "the project's own run of the NuGet check gives its config, before the licence check's");
const action = "name: checks\nruns:\n  using: composite\n  steps:\n    - run: node core/scripts/copies.mjs config/a.json\n      shell: bash\n";
ok(copiesOf({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/check" }] } } } }, { ".github/actions/check/action.yml": action }) === "config/a.json",
  "a step of a local action a workflow uses is read as the workflow's own");
const elsewhere = configs(inMemory({}, { "scripts/check.sh": "node core/scripts/copies.mjs config/x.json\n", "package.json": JSON.stringify({ scripts: { licences: "node core/scripts/licences.mjs config/l.json" } }) }));
ok(elsewhere.copies === null && elsewhere.licences === null && elsewhere.unread.some(u => u.includes("scripts/check.sh")) && elsewhere.unread.some(u => u.includes("package.json")),
  "a check run only from a shell script or a package's scripts is not read, never read at the slot's or the kit's path", JSON.stringify(elsewhere));
ok(configs(inMemory({}, { "README.sh.md": "node core/scripts/copies.mjs config/x.json" })).copies === "checks/copies.json", "a file that runs nothing, naming the script, gives no source");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": coreCall("copies.yml", { config: "b.json", sizes: "s.json" }) })
  && notRead("copies", { "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": stepped("node core/scripts/copies.mjs b.json") })
  && notRead("licences", { "a.yml": stepped("node core/scripts/licences.mjs a.json\nnode core/scripts/agent-tools.mjs b.json") })
  && copiesOf({ "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": stepped("node core/scripts/copies.mjs ./a.json") }) === "a.json",
  "two sources that give different files, calls or runs, are not read, naming each; two that give one file read it");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { sizes: "s.json" }) }) && notRead("licences", { "a.yml": coreCall("licences.yml", {}) }), "a call that passes no config is not read, never passed by to the next source");
const parts = files => configs(inMemory({ "a.yml": coreCall("licences.yml", { config: "c/l.json" }) }, files));
ok(parts({ "c/l.json": "{ no json" }).licences === "c/l.json" && parts({ "c/l.json": "{ no json" }).audit === null && parts({ "c/l.json": "{ no json" }).unread.some(u => u.startsWith("the licence check's audit not compared: "))
  && parts({}).audit === "checks/licences-audit.json" && parts({ "c/l.json": JSON.stringify({ audit: "/c/audit.json" }) }).audit === "c/audit.json",
  "a config there and no JSON leaves its audit unread, one not there the kit's, and an audit named from the root read as the licence check joins it");
const sized = configs(inMemory({ "a.yml": coreCall("copies.yml", { config: "c/c.json", sizes: "c/sizes.json" }) }, {}, "| *size marks* | `checks/sizes.json` |\n"));
ok(sized.sizes === "c/sizes.json" && configs(inMemory({}, {}, "| *size marks* | `m/s.json` |\n")).sizes === "m/s.json", "the size marks are those the copies call passes, else the slot's");
const signed = configs(inMemory({ "s.yml": coreCall("signatures.yml", { directory: "${{ inputs.at }}" }) }));
ok(signed.packages === null && signed.unread.some(u => u.startsWith("the signature check's folder not read")) && configs(inMemory({ "s.yml": coreCall("signatures.yml", {}) })).packages === ".",
  "the signature check's folder passed as an expression is not read; none passed is the root");
// a workflow nested past what the reader of keys given twice reads is told with its own mend, to nest it less, never
// as a key given twice it may not hold (#610)
{
  const keysStep = STEPS.find(s => s.lead === "16 November 2026, no workflow gives a key twice");
  const deep = keysStep.check(inMemory({}, { ".github/workflows/deep.yml": `on: push\nx: ${"[".repeat(200)}1${"]".repeat(200)}\n` }));
  const both = keysStep.check(inMemory({}, { ".github/workflows/deep.yml": `on: push\nx: ${"[".repeat(200)}1${"]".repeat(200)}\n`, ".github/workflows/two.yml": "on: push\non: pull_request\n" }));
  ok(/nest the lists and mappings of these workflows or actions no deeper than a workflow needs, a few levels, since past 128 deep a key given twice in them cannot be read: `\.github\/workflows\/deep\.yml`\./.test(deep ?? "") && !/keep one of the two keys/.test(deep ?? "")
    && /keep one of the two keys.*`\.github\/workflows\/two\.yml` line 2, "on"/.test(both ?? "") && /no deeper than a workflow needs.*`\.github\/workflows\/deep\.yml`/.test(both ?? "")
    && keysStep.check(inMemory({}, { ".github/workflows/flat.yml": "on: push\n" })) === null,
    "a workflow nested past 128 deep is told to nest less, a key given twice to keep one, each with its own mend, and a plain one passes", [deep, both].join("\n"));
  // (a workflow longer than the length read is told to be cut, never to nest less: #752)
  const long = keysStep.check(inMemory({}, { ".github/workflows/long.yml": `on: push\n# ${"x".repeat(262144)}\n` }));
  ok(/cut these workflows or actions to under 262144 characters.*`\.github\/workflows\/long\.yml`\./.test(long ?? "") && !/nest the lists/.test(long ?? ""),
    "a workflow longer than the length read is told to be cut, with its own mend", long ?? "");
}

const advisory = STEPS.find(s => s.lead === "13 November 2026, the NuGet check fails from the first day");
let threw = null;
try { advisory.check(inMemory({ "n.yml": coreCall("nuget.yml", { config: "c.json", advisory: "${{ vars.ADVISORY }}" }) })); } catch (e) { threw = e; }
ok(threw instanceof Unread && advisory.check(inMemory({ "n.yml": coreCall("nuget.yml", { config: "c.json", advisory: true }) })) !== null, "the NuGet call's advisory passed as an expression is not read as false");

done("steps-run-configs");
