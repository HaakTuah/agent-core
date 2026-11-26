#!/usr/bin/env node
// Tests of the step of the sync notes that asks a lookup beside each exact-versions check (scripts/steps/, the entry of 16 November
// 2026, "a new package looked up"), read against a workflow of the project's own written for each case in a scratch folder: each
// lookup is asked for apart, so that one does not hide the other, before the NuGet lookup only what cannot run the pull request's
// build files may stand, what has a step run more than its words show, and a local composite action, its inputs and its bounds.
// The lookup run on a project is lookup-run-test.mjs's. Run: node tests/lookup-step-test.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { notDone, STEPS } from "../scripts/steps.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };

const tmp = scratchDir("lookup-step-test-");
try {
  // (the step reads the project through git, as it does in a project)
  execFileSync("git", ["init", "-q"], { cwd: tmp });
  // The sync's step, on a workflow of the project's own: each lookup is asked for apart, so one does not hide the other.
  const step = STEPS.filter((x) => x.lead === "16 November 2026, a new package looked up");
  mkdirSync(join(tmp, ".github/workflows"), { recursive: true });
  const own = (...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  own("node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget.mjs c.json");
  let missed = notDone(tmp, step);
  ok(missed.length === 1 && /for each config `core\/scripts\/exact-versions\.mjs` is given, add a step that runs `node core\/scripts\/lookup\.mjs` with the same config \(or the licence check/u.test(missed[0].mend) && !/`--nuget`/u.test(missed[0].mend), `the NuGet lookup does not stand in for the npm one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget-fetch.mjs c.json", "node core/scripts/lookup.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /with the same config and `--nuget`/u.test(missed[0].mend), `nor the npm lookup for the NuGet one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json", "node core/scripts/nuget.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /give its checkout `fetch-depth: 2`/u.test(missed[0].mend), `with both, a checkout of one commit is still reported, since the lookup would read no base (${missed.map((m) => m.mend)})`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), `${readFileSync(join(tmp, ".github/workflows/own.yml"), "utf8").replace("    steps:\n", "    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n")}`);
  ok(notDone(tmp, step).length === 0, "and with both, on a checkout that holds the base, the step is done");
  // (from #1093 the licence script looks up npm's new packages itself: it counts where a lookup would, on a checkout
  // that holds the base, and never for NuGet, nor after something of the pull request's, nor with --action)
  const licenceFlow = (depth, ...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n${depth ? "        with:\n          fetch-depth: 2\n" : ""}${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  licenceFlow(true, "node core/scripts/licences.mjs c.json", "node core/scripts/exact-versions.mjs c.json");
  ok(notDone(tmp, step).length === 0, "the licence script, which looks up npm's new packages itself, stands for the npm lookup on a checkout that holds the base");
  licenceFlow(false, "node core/scripts/licences.mjs c.json", "node core/scripts/exact-versions.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs`/u.test(missed[0].mend), `but not on a checkout of one commit, where it reads no base (${missed.map((m) => m.mend)})`);
  licenceFlow(true, "npm ci", "node core/scripts/licences.mjs c.json", "node core/scripts/exact-versions.mjs c.json");
  ok(notDone(tmp, step).length === 1, "nor after something of the pull request's has run");
  licenceFlow(true, "node core/scripts/licences.mjs c.json --action", "node core/scripts/exact-versions.mjs c.json");
  ok(notDone(tmp, step).length === 1, "nor where it only writes the dependency review's lists");
  licenceFlow(true, "node core/scripts/licences.mjs c.json", "node core/scripts/nuget.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /`--nuget`/u.test(missed[0].mend), `nor for the NuGet lookup (${missed.map((m) => m.mend)})`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: echo first\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /give its checkout `fetch-depth: 2`/u.test(missed[0].mend), `a fetch depth in another job than the lookup's does not count (${missed.map((m) => m.mend)})`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: |\n          node core/scripts/exact-versions.mjs c.json\n          # node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs/u.test(missed[0].mend), `a lookup in a shell comment runs nothing, and does not count (${missed.map((m) => m.mend)})`);
  const nugetJob = (...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  nugetJob("dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /with nothing before it in its job but the checkout, `setup-` actions and the core's lookup, exact-versions, licence, agent-tools and install scripts/u.test(missed[0].mend), `a NuGet lookup after the restore, which runs the pull request's build files, does not count (${missed.map((m) => m.mend)})`);
  nugetJob("node core/scripts/lookup.mjs c.json --nuget", "dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and before it, it does");
  nugetJob("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/lookup.mjs c.json", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "the core's lookup and exact-versions scripts may stand before it");
  // Before the NuGet lookup only what cannot run the pull request's build files may stand: an allow-list, so a build
  // spelled any way is caught.
  for (const [what, line] of [["by a script in another folder named core", "node src/core/scripts/restore.mjs"], ["inside a core script's words", 'node core/scripts/labels.mjs "$(dotnet restore)"'], ["by the core's mutation tool, which runs the project's tests", "node core/scripts/mutate.mjs --report r.json 1"], ["behind a variable", "env X=1 dotnet build"], ["under sudo", "sudo dotnet restore"], ["in a script", "./build.sh"], ["in PowerShell", "pwsh build.ps1"], ["by make", "make restore"], ["by node on another file", "node build.mjs"]]) {
    nugetJob(line, "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a build ${what} does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: actions/setup-dotnet@v5\n      - uses: ./.github/actions/build\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor after a local action, though a setup action may stand before it");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: actions/setup-dotnet@v5\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and after the checkout and a setup action alone, it counts");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n        env:\n          NODE_OPTIONS: --import ./build.mjs\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor after a core script Node is told to load a file of the project's before");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n        env:\n          NODE_OPTIONS: --import ./build.mjs\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup Node is told to load a file of the project's before");
  // What has a step run more than its words show, before the NuGet lookup or in it.
  const lic = (extra) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${extra}      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n`);
  for (const [what, extra] of [
    ["BASH_ENV", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          BASH_ENV: ./build.sh\n"],
    ["a PATH of the project's", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          PATH: ./tools:/usr/bin:/bin\n"],
    ["a node of the project's", "      - run: ./tools/node core/scripts/licences.mjs c.json\n"],
    ["a shell of the step's own", "      - run: node core/scripts/licences.mjs c.json\n        shell: ./build.sh {0}\n"],
    ["an expansion bash evaluates", "      - run: node core/scripts/licences.mjs ${X:Y}\n"],
    ["a step that writes to $GITHUB_ENV", "      - run: echo NODE_OPTIONS=--import=./build.mjs >> \"$GITHUB_ENV\"\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: ./tools/node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup run by a node of the project's");
  for (const [what, extra] of [
    ["LD_PRELOAD", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          LD_PRELOAD: ./tools/hook.so\n"],
    ["a bash function named node", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          BASH_FUNC_node%%: \"() { ./build.sh; }\"\n"],
    ["a variable its words do not name", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          HOOK: ./build.sh\n"],
    ["a script of the core's from another folder", "      - run: node core/scripts/licences.mjs c.json\n        working-directory: tools\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  for (const [what, line, dir] of [["a lookup that writes over its own script", "node core/scripts/lookup.mjs c.json --nuget 3>core/scripts/lookup.mjs"], ["a lookup script the pull request holds", "node tools/core/scripts/lookup.mjs c.json --nuget"], ["a lookup run from another folder", "node core/scripts/lookup.mjs ../c.json --nuget", "tools"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: ${line}\n${dir ? `        working-directory: ${dir}\n` : ""}      - run: node core/scripts/nuget.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `${what} counts for none`);
  }
  nugetJob("npm run build", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 1, "an npm lookup after a step that runs the project's own files counts for none");
  for (const [what, extra] of [
    ["a setup action given an env of its own", "      - uses: actions/setup-node@v4\n        env:\n          LD_PRELOAD: ./evil.so\n"],
    ["a checkout of another repository into the copy's folder", "      - uses: actions/checkout@v7\n        with:\n          repository: someone/else\n          path: core\n"],
    ["a setup action that caches, running the package manager", "      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: yarn\n"],
    ["OPENSSL_CONF, though the step's words name it", "      - run: node core/scripts/licences.mjs $OPENSSL_CONF\n        env:\n          OPENSSL_CONF: evil.cnf\n"],
    ["a variable its words name, but not as its config", "      - run: node core/scripts/licences.mjs c.json $HOOK\n        env:\n          HOOK: ./build.sh\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  for (const [what, runner] of [["a Windows runner, whose shell is pwsh", "windows-latest"], ["a runner a matrix names", "${{ matrix.os }}"], ["a self-hosted runner, which may be Windows", "self-hosted"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ${runner}\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/licences.mjs @(./evil.ps1)\n      - run: node core/scripts/lookup.mjs c.json --nuget\n        shell: bash\n      - run: node core/scripts/nuget.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with no shell named on ${what} does not count`);
  }
  lic("      - run: node core/scripts/licences.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and after the licence script alone, it does");
  lic("      - uses: actions/setup-node@v4\n        with:\n          node-version-file: .node-version\n");
  ok(notDone(tmp, step).length === 0, "and after a setup action given only its version, it does");
  lic("      - uses: actions/setup-node@v5\n        with:\n          node-version: 22\n          package-manager-cache: false\n");
  ok(notDone(tmp, step).length === 0, "and after one whose cache is turned off, it does");
  lic("      - uses: actions/setup-node@v5\n        with:\n          node-version: 22\n          cache: false\n");
  ok(notDone(tmp, step).length === 1, "but not after one given cache: false, which names a package manager, not a switch");
  lic("      - uses: actions/setup-dotnet@v4\n        with:\n          dotnet-version: 8.x\n          cache: false\n");
  ok(notDone(tmp, step).length === 0, "save in setup-dotnet, where cache: false is the switch turned off");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    container:\n      image: node:22\n      env:\n        NODE_OPTIONS: --require ./evil.js\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup in a job run in a container of its own");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    services:\n      s:\n        image: node:22\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a job beside service containers");
  nugetJob("echo PATH=./tools >> \"$GITHUB_PATH\"", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 1, "nor does an npm lookup after a step that writes to $GITHUB_PATH");
  writeFileSync(join(tmp, "core-manifest.md"), `# Manifest\n\nCore: ${CORE} at ${"0".repeat(40)}, copied whole under shared/\n`);
  nugetJob("node shared/scripts/exact-versions.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /runs `node shared\/scripts\/lookup\.mjs/u.test(missed[0].mend), `where the manifest puts the core under shared/, its scripts are read there (${missed.map((m) => m.mend)})`);
  nugetJob("node shared/scripts/lookup.mjs c.json", "node shared/scripts/exact-versions.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and its lookup there counts");
  writeFileSync(join(tmp, "core-manifest.md"), "# Manifest\n");
  for (const [what, line] of [["named by an echo", "echo core/scripts/lookup.mjs c.json"], ["allowed to fail", "node core/scripts/lookup.mjs c.json || true"]]) {
    nugetJob("node core/scripts/exact-versions.mjs c.json", line);
    missed = notDone(tmp, step);
    ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs/u.test(missed[0].mend), `a lookup ${what} does not count (${missed.map((m) => m.mend)})`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  push:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a workflow no pull request starts");
  for (const [what, on] of [["only once it closes", "  pull_request:\n    types: [closed]\n"], ["only where its paths change", "  pull_request:\n    paths: [docs/**]\n"], ["only into some branches", "  pull_request:\n    branches: [nothing-here]\n"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n${on}jobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `nor one in a workflow a pull request starts ${what}`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review]\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and one that runs on its opening and every push counts");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n        continue-on-error: true\n");
  ok(notDone(tmp, step).length === 1, "nor one in a step allowed to fail");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n        if: false\n");
  ok(notDone(tmp, step).length === 1, "nor one under a condition the reader cannot tell");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a job allowed to fail");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /no `ref:`/u.test(missed[0].mend), `and a checkout of another commit than the merge does not hold the base (${missed.map((m) => m.mend)})`);
  nugetJob("msbuild -t:Restore", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 1, "a NuGet lookup after an msbuild restore does not count");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: dotnet restore --locked-mode\n        if: always()\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "a restore under a condition before the NuGet lookup is still a restore before it");
  for (const [what, extra] of [["piped on", "node core/scripts/lookup.mjs c.json | tee out"], ["sent to the background", "node core/scripts/lookup.mjs c.json &"]]) {
    nugetJob("node core/scripts/exact-versions.mjs c.json", extra);
    ok(notDone(tmp, step).length === 1, `a lookup ${what}, whose failure the step does not see, does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: windows-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one under pwsh, Windows' default shell, which goes on past a failure");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: windows-latest\n    defaults:\n      run:\n        shell: bash\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and one under bash on Windows counts");
  nugetJob("node core/scripts/exact-versions.mjs checks/frontend.json", "node core/scripts/exact-versions.mjs checks/backend.json", "node core/scripts/lookup.mjs checks/frontend.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /for each config `core\/scripts\/exact-versions\.mjs` is given/u.test(missed[0].mend), `a lookup of one config does not stand for another config's check (${missed.map((m) => m.mend)})`);
  nugetJob("node core/scripts/exact-versions.mjs checks/frontend.json", "node core/scripts/exact-versions.mjs checks/backend.json", "node core/scripts/lookup.mjs checks/frontend.json", "node core/scripts/lookup.mjs checks/backend.json");
  ok(notDone(tmp, step).length === 0, "and with a lookup of each, the step is done");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  front:\n    runs-on: ubuntu-latest\n    env:\n      CONFIG: checks/frontend.json\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs \"$CONFIG\"\n      - run: node core/scripts/lookup.mjs \"$CONFIG\"\n  back:\n    runs-on: ubuntu-latest\n    env:\n      CONFIG: checks/backend.json\n    steps:\n      - run: node core/scripts/exact-versions.mjs \"$CONFIG\"\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1, `a config named only when the workflow runs is matched in its own job alone (${missed.map((m) => m.mend)})`);
  const stepEnv = (check, look) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs "$CONFIG"\n        env:\n          CONFIG: ${check}\n      - run: node core/scripts/lookup.mjs "$CONFIG"\n        env:\n          CONFIG: ${look}\n`);
  stepEnv("checks/backend.json", "checks/frontend.json");
  ok(notDone(tmp, step).length === 1, "a variable config the lookup's step gives another value does not count");
  stepEnv("checks/backend.json", "checks/backend.json");
  ok(notDone(tmp, step).length === 0, "and given the same value, it does");
  // A check run from a local composite action is seen where it runs, as are a lookup there and a build there.
  const action = (...lines) => { mkdirSync(join(tmp, ".github/actions/packages"), { recursive: true }); writeFileSync(join(tmp, ".github/actions/packages/action.yml"), `name: packages\nruns:\n  using: composite\n  steps:\n${lines.map((l) => `    - run: ${l}\n      shell: bash\n`).join("")}`); };
  const usesAction = () => writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/packages\n");
  action("node core/scripts/exact-versions.mjs c.json"); usesAction();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs`/u.test(missed[0].mend), `a check run from a local action, with no lookup, is not done (${missed.map((m) => m.mend)})`);
  action("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and with the lookup beside it there, it is");
  action("dotnet restore --locked-mode", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 1, "a restore in a local action, before its NuGet lookup, is read as a build");
  action("node core/scripts/lookup.mjs c.json --nuget", "dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and a NuGet lookup first there counts");
  writeFileSync(join(tmp, ".github/actions/packages/action.yml"), "name: [unclosed\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /cannot be read whole/u.test(missed[0].mend), `a local action that cannot be read is named, not taken as running nothing (${missed.map((m) => m.mend)})`);
  // Ten actions, each calling the next ten times, would be ten billion steps: a bound on all a workflow's actions read.
  for (let i = 0; i < 10; i++) {
    mkdirSync(join(tmp, `.github/actions/a${i}`), { recursive: true });
    writeFileSync(join(tmp, `.github/actions/a${i}/action.yml`), `name: a${i}\nruns:\n  using: composite\n  steps:\n${i === 9 ? "    - run: node core/scripts/exact-versions.mjs c.json\n      shell: bash\n" : `    - uses: ./.github/actions/a${i + 1}\n`.repeat(10)}`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/a0\n");
  const began = Date.now();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /past 5000 steps/u.test(missed[0].mend) && Date.now() - began < 20000, `actions that call each other without end are read to a bound, and named (${missed.map((m) => m.mend.slice(0, 200))})`);
  // An action's input is its caller's `with:`: two calls given two configs are two configs, and one given none matches none.
  for (const [name, line] of [["look", "node core/scripts/lookup.mjs ${{ inputs.config }}"], ["check", "node core/scripts/exact-versions.mjs ${{ inputs.config }}"]]) {
    mkdirSync(join(tmp, `.github/actions/${name}`), { recursive: true });
    writeFileSync(join(tmp, `.github/actions/${name}/action.yml`), `name: ${name}\ninputs:\n  config:\n    required: false\nruns:\n  using: composite\n  steps:\n    - run: ${line}\n      shell: bash\n`);
  }
  const calls = (look, check) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/look\n${look ? `        with:\n          config: ${look}\n` : ""}      - uses: ./.github/actions/check\n${check ? `        with:\n          config: ${check}\n` : ""}`);
  calls("checks/a.json", "checks/b.json");
  ok(notDone(tmp, step).length === 1, "a lookup an action is given one config for does not stand for a check another is given another for");
  calls("checks/b.json", "checks/b.json");
  ok(notDone(tmp, step).length === 0, "and given the same, it does");
  calls(null, null);
  ok(notDone(tmp, step).length === 1, "an input no caller gives matches nothing");
  // The same, an input given through env.
  for (const [name, line] of [["look", "node core/scripts/lookup.mjs \"$CFG\""], ["check", "node core/scripts/exact-versions.mjs \"$CFG\""]]) {
    writeFileSync(join(tmp, `.github/actions/${name}/action.yml`), `name: ${name}\ninputs:\n  config:\n    required: false\nruns:\n  using: composite\n  steps:\n    - run: ${line}\n      shell: bash\n      env:\n        CFG: \${{ inputs.config }}\n`);
  }
  calls("checks/a.json", "checks/b.json");
  ok(notDone(tmp, step).length === 1, "an input given through env is the caller's too: a lookup of one config does not stand for another's check");
  calls("checks/b.json", "checks/b.json");
  ok(notDone(tmp, step).length === 0, "and given the same through env, it does");
  rmSync(join(tmp, ".github/actions"), { recursive: true, force: true });
  // An action past a megabyte is named, not read, and each action is read once however often it is used.
  mkdirSync(join(tmp, ".github/actions/big"), { recursive: true });
  writeFileSync(join(tmp, ".github/actions/big/action.yml"), `name: big\n# ${"x".repeat(1 << 20)}\nruns:\n  using: composite\n  steps:\n    - run: node core/scripts/exact-versions.mjs c.json\n      shell: bash\n`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${"      - uses: ./.github/actions/big\n".repeat(2000)}`);
  const timed = Date.now();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /cannot be read whole/u.test(missed[0].mend) && Date.now() - timed < 10000, `an action past a megabyte is named, and read once (${Date.now() - timed} ms; ${missed.map((m) => m.mend.slice(0, 160))})`);
  rmSync(join(tmp, ".github/actions"), { recursive: true, force: true });
  // One config's name in two folders is two configs: a lookup in one folder does not stand for the other's check.
  const dirs = (...pairs) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${pairs.map(([d, l]) => `      - run: ${l}\n        working-directory: ${d}\n`).join("")}`);
  dirs(["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"], ["frontend", "node ../core/scripts/lookup.mjs licences.json"]);
  ok(notDone(tmp, step).length === 1, "a lookup run in one folder does not stand for a check of the same name in another");
  dirs(["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"], [".", "node core/scripts/lookup.mjs frontend/licences.json"], [".", "node core/scripts/lookup.mjs backend/licences.json"]);
  ok(notDone(tmp, step).length === 1, "a lookup run from another folder than the root counts for none, though a check may run there");
  dirs([".", "node core/scripts/lookup.mjs frontend/licences.json"], [".", "node core/scripts/lookup.mjs backend/licences.json"], ["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"]);
  ok(notDone(tmp, step).length === 0, "and with a lookup of each folder's config from the root, before them, the step is done");
  nugetJob("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json # waits & sees");
  ok(notDone(tmp, step).length === 0, "an ampersand in a comment does not send the lookup to the background");
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(failed ? `${failed} failing` : "ok   the lookup step");
process.exit(failed ? 1 : 0);
