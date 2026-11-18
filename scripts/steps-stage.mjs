// For the tests alone (tests/steps-test.mjs and tests/upgrade-test.mjs): for each step steps.mjs reads with a
// check, how a project that missed it holds it (`stage`, written into the project at `dir`) and its mend as the step
// words it (`mend`), so that a test can take a step out of a synced project, see the sync report exactly that, and
// see the mend as written make it done. A step with a check and no entry here fails steps-test.mjs. One marked
// `asked` is a step a project that changed nothing of its own still has to do once a sync brings it (a check's own
// list to write): upgrade-test.mjs sees it reported after the sync, alone, and done by its mend. `after`, where a stage
// has one, takes out what its mend leaves that a later stage would read again. Node's own modules.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { copiesConfig, licenceConfig } from "./check-configs.mjs";
import { where } from "./choices.mjs";
import { MOVED_GLOB, MOVED_GLOBS, callers, moved, project } from "./steps.mjs";

const at = (dir, f) => path.join(dir, f);
const read = (dir, f) => fs.readFileSync(at(dir, f), "utf8");
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(at(dir, f)), { recursive: true }); fs.writeFileSync(at(dir, f), text); };
const SLOTS = /^(\| Slot \| Here \|\r?\n\| --- \| --- \|\r?\n)/m;

const PIN = "0".repeat(40);
// (whether the project's call to core.yml runs the NuGet check in its one job: #376)
const folds = (dir, key) => fs.existsSync(at(dir, ".github/workflows/core.yml")) && new RegExp(`^ {6}${key}: `, "m").test(read(dir, ".github/workflows/core.yml"));
const NUGET = `name: nuget\n\non:\n  pull_request:\n\njobs:\n  nuget:\n    uses: ${CORE}/.github/workflows/nuget.yml@${PIN}\n    with:\n      config: checks/licences.json\n`;

// (a suite of the project's own that reads the core's scripts, run on a change to them and to its own code)
const SCRIPTS = "name: scripts-staged\n\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - 'core/scripts/**'\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo test\n";
// (a suite of the project's own whose path filter leaves the copy and the manifest out, as it was told, and not the
// files that hold only calls to the core's workflows, whose pins a sync moves)
const SUITE = "name: suites-staged\n\non:\n  pull_request:\n    paths-ignore:\n      - 'core/**'\n      - 'core-manifest.md'\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo the suite\n";

// (a rule file of an agent tool's, which the copies and pointer checks read since #405)
const STAGED = ".agents/rules/staged.md";
const copies = (dir, flag) => spawnSync(process.execPath, ["core/scripts/copies.mjs", copiesConfig(project(dir)), flag], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "" } });

// (a workflow of the project's own with a key twice in a step, which GitHub refuses)
const TWICE = "name: twice-staged\n\non:\n  push:\n\npermissions:\n  contents: read\n\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo a\n        if: github.event_name == 'push'\n        if: always()\n";

export const STAGES = {
  "16 November 2026, hostile tests for every named input": {
    // (rule 5 of SECURITY.md lists an input whose hostile tests are nowhere; the mend writes them where it names them)
    stage: dir => write(dir, "SECURITY.md", read(dir, "SECURITY.md").replace(/^(5\. .*\r?\n)(?:(?!\d+\. |#).*\r?\n)*/m,
      "$1   - a peer's message: its type and size checked on arrival; its hostile tests: `tests/hostile/peer-message.test.mjs`.\n")),
    mend: dir => write(dir, "tests/hostile/peer-message.test.mjs", "// too long, the wrong type, markup, a file path, a number out of range, nothing at all\n"),
  },
  "16 November 2026, an agent's own tools listed": {
    // (a plug-in turned on and listed nowhere; the mend lists it, with its publisher and one exact version)
    stage: dir => {
      const file = ".claude/settings.json", settings = fs.existsSync(at(dir, file)) ? JSON.parse(read(dir, file)) : {};
      write(dir, file, `${JSON.stringify({ ...settings, enabledPlugins: { ...settings.enabledPlugins, "staged@example-market": true } }, null, 2)}\n`);
    },
    mend: dir => {
      const config = JSON.parse(read(dir, "checks/licences.json"));
      write(dir, "checks/licences.json", `${JSON.stringify({ ...config, agentTools: [...(config.agentTools ?? []), { kind: "plugin", name: "staged@example-market", publisher: "Example Tools", version: "1.0.0" }] }, null, 2)}\n`);
    },
  },
  "12 November 2026, builders named by role": {
    stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(SLOTS, "$1| *Codex's checks* | the project's own tests |\n")),
    mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^\| \*Codex's checks\* \|.*\r?\n/m, "")),
  },
  "12 November 2026, a slimmer copy": {
    stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Paths: .*?)( or archive\/)/m, "$1, archive/ or reports/")),
    mend: dir => {
      const want = /^Paths: .*$/m.exec(fs.readFileSync(fileURLToPath(new URL("../setup/template/core-manifest.md.tmpl", import.meta.url)), "utf8"))[0];
      write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^Paths: .*$/m, want));
    },
  },
  "12 November 2026, the signature check on every pull request": {
    stage: dir => write(dir, ".github/workflows/signatures.yml", fs.existsSync(at(dir, ".github/workflows/signatures.yml"))
      ? read(dir, ".github/workflows/signatures.yml").replace(/^  pull_request:[ \t]*$/m, "  pull_request:\n    paths: [\"package-lock.json\"]")
      : `name: signatures\n\non:\n  pull_request:\n    paths: ["package-lock.json"]\n\njobs:\n  signatures:\n    uses: ${CORE}/.github/workflows/signatures.yml@${PIN}\n`),
    mend: dir => write(dir, ".github/workflows/signatures.yml", read(dir, ".github/workflows/signatures.yml").replace(/^    paths: .*\r?\n/m, "")),
  },
  "12 November 2026, exact versions": {
    // (an npm project that runs the licence script from a workflow of its own, without the exact-versions check)
    stage: dir => {
      if (!fs.existsSync(at(dir, "package-lock.json"))) write(dir, "stage-npm/package-lock.json", "{}\n");
      const core = at(dir, ".github/workflows/licences.yml");
      if (fs.existsSync(core)) { write(dir, ".stage-licences/licences.yml", fs.readFileSync(core, "utf8")); fs.rmSync(core); }
      write(dir, ".github/workflows/licences-own.yml", "name: licences-own\n\non:\n  pull_request:\n\njobs:\n  licences:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/licences.mjs checks/licences.json\n      - run: node core/scripts/agent-tools.mjs checks/licences.json\n      - run: node core/scripts/lookup.mjs checks/licences.json\n");
    },
    mend: dir => {
      write(dir, ".github/workflows/licences-own.yml", `${read(dir, ".github/workflows/licences-own.yml")}      - run: node core/scripts/exact-versions.mjs checks/licences.json\n`);
      if (fs.existsSync(at(dir, ".stage-licences"))) { write(dir, ".github/workflows/licences.yml", read(dir, ".stage-licences/licences.yml")); fs.rmSync(at(dir, ".stage-licences"), { recursive: true }); }
    },
  },
  "12 November 2026, the security review shown on every pull request": {
    stage: dir => {
      const file = at(dir, ".github/workflows/security-review.yml");
      if (fs.existsSync(file)) { write(dir, ".stage/security-review.yml", fs.readFileSync(file, "utf8")); fs.rmSync(file); }
    },
    mend: dir => { write(dir, ".github/workflows/security-review.yml", read(dir, ".stage/security-review.yml")); fs.rmSync(at(dir, ".stage"), { recursive: true }); },
  },
  "13 November 2026, the NuGet check": {
    stage: dir => write(dir, "stage/Staged.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />\n"),
    // (as the step words it: the lock file committed, the core's NuGet check called, and the lock file named in the
    // licence check's config)
    mend: dir => {
      write(dir, "stage/packages.lock.json", "{\n  \"version\": 1,\n  \"dependencies\": {}\n}\n");
      if (!fs.existsSync(at(dir, ".github/workflows/nuget.yml")) && !folds(dir, "nuget")) write(dir, ".github/workflows/nuget.yml", NUGET);
      const config = JSON.parse(read(dir, "checks/licences.json"));
      config.nuget ??= { ships: [], tools: [] };
      config.nuget.ships = [...(config.nuget.ships ?? []), "stage/packages.lock.json"];
      write(dir, "checks/licences.json", `${JSON.stringify(config, null, 2)}\n`);
    },
  },
  "13 November 2026, the NuGet check fails from the first day": {
    // (where core.yml's one job runs the NuGet check, on that call: #376)
    stage: dir => folds(dir, "nuget") ? write(dir, ".github/workflows/core.yml", read(dir, ".github/workflows/core.yml").replace(/^( {6}nuget: .*\r?\n)/m, "$1      advisory: true\n"))
      : write(dir, ".github/workflows/nuget-staged.yml", `${NUGET.replace("name: nuget", "name: nuget-staged")}      advisory: true\n`),
    mend: dir => { for (const f of ["nuget-staged.yml", "core.yml"]) if (fs.existsSync(at(dir, `.github/workflows/${f}`))) write(dir, `.github/workflows/${f}`, read(dir, `.github/workflows/${f}`).replace(/^      advisory: true\r?\n/m, "")); },
  },
  "13 November 2026, the core's scripts started through bash": {
    stage: dir => write(dir, ".github/workflows/publish-staged.yml", "name: publish-staged\n\non:\n  push:\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: core/scripts/site-publish.sh root site\n"),
    mend: dir => write(dir, ".github/workflows/publish-staged.yml", read(dir, ".github/workflows/publish-staged.yml").replace("- run: core/scripts/", "- run: bash core/scripts/")),
  },
  "14 November 2026, the size marks' total counts the project's own files": {
    // (a total that still counts the core's copy, as one written before the core's own cap held it)
    stage: dir => { const m = JSON.parse(read(dir, "checks/sizes.json")); write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, total: 1000000 }, null, 2)}\n`); },
    mend: dir => {
      const r = spawnSync(process.execPath, ["core/scripts/reading-size.mjs", "checks/sizes.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
      const to = Number(/set it to (\d+)/.exec(r.stdout)[1]);
      const m = JSON.parse(read(dir, "checks/sizes.json"));
      write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, total: to }, null, 2)}\n`);
    },
  },
  "15 November 2026, the progress file holds order only": {
    // (a progress file past a quarter of the general mark, at the general mark: its first trim is due)
    stage: dir => {
      const m = JSON.parse(read(dir, "checks/sizes.json"));
      write(dir, "docs/PROGRESS.md", `${read(dir, "docs/PROGRESS.md")}\n## Done\n\n${"- A finished entry, kept after it was done.\n".repeat(Math.ceil(m.each / 4 / 40))}`);
      write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, read: { ...m.read, "docs/PROGRESS.md": m.each } }, null, 2)}\n`);
    },
    // (as the step words it: the finished entries taken out, then a mark of its own, below "each", at least its size)
    mend: dir => {
      write(dir, "docs/PROGRESS.md", read(dir, "docs/PROGRESS.md").replace(/\n## Done\n[\s\S]*$/, "\n"));
      const m = JSON.parse(read(dir, "checks/sizes.json"));
      write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, read: { ...m.read, "docs/PROGRESS.md": Math.min(m.each - 1, fs.statSync(at(dir, "docs/PROGRESS.md")).size + 1024) } }, null, 2)}\n`);
    },
  },
  "16 November 2026, how code is put together": {
    asked: true,
    stage: dir => { for (const f of ["checks/shape.json", "checks/shape-baseline.json"]) fs.rmSync(at(dir, f), { force: true }); },
    // (as the step words it: the config as the starter kit writes it, then its first baseline)
    mend: dir => {
      write(dir, "checks/shape.json", read(dir, "core/setup/template/shape.json.tmpl"));
      spawnSync(process.execPath, ["core/scripts/shape.mjs", "checks/shape.json", "--first"], { cwd: dir, encoding: "utf8", env: { ...process.env, SHAPE_BASE: "" } });
    },
  },
  "16 November 2026, how strong the tests are": {
    asked: true,
    stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").split(/\r?\n/).filter(l => !l.includes("*mutation tool*")).join("\n")),
    // (as the step words it: the row, here `none` with its reason)
    mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(SLOTS, "$1| *mutation tool* | `none`: no mutation tool is named for this project's language yet |\n")),
  },
  "16 November 2026, the tests a change can reach": {
    asked: true,
    // (a test of the project's own, tracked, and no job that selects; the kit's mutation row told a reason other than
    // "no tests yet", so that the strength step stays as it was)
    stage: dir => {
      write(dir, "test/staged.test.mjs", "// the selection's staged test: it guards nothing but its own place\n");
      spawnSync("git", ["add", "test/staged.test.mjs"], { cwd: dir });
      write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(\| \*mutation tool\* \| `none`): no tests yet[^|\n]*\|/m, "$1: no mutation tool is named for this project's language yet |"));
    },
    // (as the step words it: a step that selects, with its base, before the tests, which run what it names)
    mend: dir => write(dir, ".github/workflows/tests-selected.yml", "name: tests-selected\n\non:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/select.mjs --env RUN\n        env:\n          SELECT_BASE: HEAD^1\n      - run: if [ \"$RUN\" = all ]; then node --test; else node --test $RUN; fi\n"),
  },
  "16 November 2026, the NuGet check where it can matter": {
    // (a project file that imports a build file of another name than those the call's paths name)
    // (on a call of its own to the core's nuget.yml: where core.yml's one job ran the check, it is moved to that call, #376)
    stage: dir => {
      if (folds(dir, "nuget")) write(dir, ".github/workflows/core.yml", read(dir, ".github/workflows/core.yml").replace(/^ {6}nuget: .*\r?\n/m, ""));
      const call = fs.existsSync(at(dir, ".github/workflows/nuget.yml")) ? read(dir, ".github/workflows/nuget.yml") : NUGET;
      write(dir, ".github/workflows/nuget.yml", /^ {4}paths:/m.test(call) ? call : call.replace(/^ {2}pull_request:\r?\n/m, on => `${on}${read(fileURLToPath(new URL("..", import.meta.url)), "setup/template/workflows/nuget-paths.yml.tmpl")}`));
      write(dir, "staged-import/Imports.csproj", '<Project Sdk="Microsoft.NET.Sdk">\n  <Import Project="deps.xml" />\n</Project>\n');
      write(dir, "staged-import/deps.xml", "<Project>\n</Project>\n");
      write(dir, "staged-import/packages.lock.json", "{\n  \"version\": 1,\n  \"dependencies\": {}\n}\n");
      const config = JSON.parse(read(dir, "checks/licences.json"));
      config.nuget ??= { ships: [], tools: [] };
      config.nuget.ships = [...(config.nuget.ships ?? []), "staged-import/packages.lock.json"];
      write(dir, "checks/licences.json", `${JSON.stringify(config, null, 2)}\n`);
    },
    // (as the step words it: the file added to the paths, by its exact path)
    mend: dir => write(dir, ".github/workflows/nuget.yml", read(dir, ".github/workflows/nuget.yml").replace(/^( {4}paths:\r?\n)/m, "$1      - 'staged-import/deps.xml'\n")),
  },
  "16 November 2026, no workflow gives a key twice": {
    // (a workflow whose step gives if: twice; the mend keeps one, with both conditions in it, and the file goes after)
    stage: dir => write(dir, ".github/workflows/twice-staged.yml", TWICE),
    after: dir => fs.rmSync(at(dir, ".github/workflows/twice-staged.yml"), { force: true }),
    mend: dir => write(dir, ".github/workflows/twice-staged.yml", TWICE.replace("        if: github.event_name == 'push'\n        if: always()\n", "        if: github.event_name == 'push' && always()\n")),
  },
  // (last, so that its mend, which lists the files that hold only calls to the core's workflows, sees every such file
  // the other stages and mends write)
  "12 November 2026, a sync and the project's own suites": {
    stage: dir => write(dir, ".github/workflows/suites-staged.yml", SUITE),
    after: dir => fs.rmSync(at(dir, ".github/workflows/suites-staged.yml"), { force: true }),
    mend: dir => write(dir, ".github/workflows/suites-staged.yml", SUITE.replace("      - 'core-manifest.md'\n", `      - 'core-manifest.md'\n${callers(project(dir)).map(f => `      - '${f}'\n`).join("")}`)),
  },
  "16 November 2026, a file for each role, and the script that says what to read": {
    asked: true,
    // (the manifest's "Paths:" line without the roles' folder, and AGENTS.md without the builder's file; the mend adds both)
    stage: dir => {
      write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Paths:.*?)roles\/, /m, "$1"));
      write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace(/^@core\/roles\/builder\.md[ \t]*\r?\n/m, ""));
    },
    mend: dir => {
      const manifest = read(dir, "core-manifest.md"), agents = read(dir, "AGENTS.md");
      if (!/^Paths:.*\broles\//m.test(manifest)) write(dir, "core-manifest.md", manifest.replace(/^(Paths:.*?floor\/, (?:modules\/, )?)/m, "$1roles/, "));
      if (!/^@core\/roles\/builder\.md[ \t]*$/m.test(agents)) write(dir, "AGENTS.md", agents.replace(/^(@core\/floor\/security\.md[ \t]*\r?\n)/m, "$1@core/roles/builder.md\n"));
    },
  },
  "16 November 2026, the rules in folders that say who reads them or when": {
    asked: true,
    // (a rule file that names the core's files where they stood, two of them now one file, and a rule that left its file for another, the
    // copies config with the old folder's pattern alone, the manifest's line with the old folders, and a dated record
    // that names an old path and is left as it stands; the mend names each by the path the step words)
    stage: dir => {
      write(dir, "AGENTS.md", `${read(dir, "AGENTS.md").replace("@core/roles/shared/work-flow.md", "@core/modules/work-flow.md\n@core/modules/git.md").replace("core/tools/other-builders.md", "core/modules/other-builders.md")}\nWho builds: \`core/modules/roles.md\`, "The builders".\n`);
      // (a dated record of the project's own, which names an old path and stays as it stands)
      write(dir, "docs/records/2026-01-05.md", "# 5 January 2026\n\nRead that day: `core/modules/git.md`.\n");
      write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Paths:.*?)tasks\/, tools\/, /m, "$1"));
      write(dir, "checks/copies.json", read(dir, "checks/copies.json").split(`${MOVED_GLOB}, ${MOVED_GLOBS}`).join(MOVED_GLOB));
    },
    mend: dir => {
      const map = moved(at(dir, "core")), names = Object.keys(map).sort((a, b) => b.length - a.length);
      // (what a file at an old path says stands elsewhere than the rest of it is named there first, as the step words it)
      const apart = Object.entries(moved.apart(at(dir, "core"))).flatMap(([old, parts]) => parts.map(a => [`\`core/${old}\`, "${a.lead}"`, `\`core/${a.to}\`, "${a.lead}"`]));
      for (const f of project(dir).files.filter(f => !f.startsWith("core/") && /\.(?:md|json|ya?ml|mjs|cjs|js|ts|sh|txt|toml)$/.test(f))) {
        if (f.startsWith("docs/records/")) continue;
        const text = read(dir, f), next = names.reduce((t, old) => t.split(`core/${old}`).join(`core/${map[old].endsWith("/") ? `${map[old]}input.md` : map[old]}`), apart.reduce((t, [was, now]) => t.split(was).join(now), text)).split(`${MOVED_GLOB}, ${MOVED_GLOBS}`).join(MOVED_GLOB).split(MOVED_GLOB).join(`${MOVED_GLOB}, ${MOVED_GLOBS}`);
        // (two lines that now pull in the one file are one line)
        const once = next.split("\n").filter((l, i, all) => !(l === all[i - 1] && /^(@|#\[\[file:)/.test(l))).join("\n");
        if (once !== text) write(dir, f, once);
      }
      const manifest = read(dir, "core-manifest.md"), want = /^Paths: .*$/m.exec(read(dir, "core/setup/template/core-manifest.md.tmpl"))[0];
      if (!/^Paths:.*\btasks\/.*\btools\//m.test(manifest)) write(dir, "core-manifest.md", manifest.replace(/^Paths: .*$/m, want));
    },
  },
  "16 November 2026, the agent tools' files read for copies and pointers": {
    asked: true,
    // (a rule file of Antigravity's that repeats a line of AGENTS.md and points at a file that is not there; the mend,
    // as the step words it, points it at one that is, then lists the copies with --tools, the starter kit's entry
    // files' among them where the baseline was written before the check read them)
    stage: dir => {
      const line = read(dir, "AGENTS.md").split(/\r?\n/).filter(l => !/^[#@|]/.test(l) && !l.includes("](") && l.split(/\s+/).length >= 14).sort((a, b) => b.length - a.length)[0];
      write(dir, STAGED, `# Staged\n\n${line}\n\nAs \`docs/staged-nowhere.md\` says.\n`);
      spawnSync("git", ["add", STAGED], { cwd: dir });
    },
    after: dir => {
      spawnSync("git", ["rm", "-q", "-f", "--cached", "--ignore-unmatch", STAGED], { cwd: dir });
      fs.rmSync(at(dir, STAGED), { force: true });
      copies(dir, "--write");
    },
    mend: dir => {
      if (fs.existsSync(at(dir, STAGED))) {
        write(dir, STAGED, read(dir, STAGED).replace("docs/staged-nowhere.md", "AGENTS.md"));
        spawnSync("git", ["add", STAGED], { cwd: dir });
      }
      copies(dir, "--tools");
    },
  },
  "16 November 2026, checks once a pull request is ready": {
    // (the call to the copy check skips its job on a draft, its trigger left as it was; the mend, as the step words it,
    // lists the trigger's types with ready_for_review)
    stage: dir => write(dir, ".github/workflows/core.yml", read(dir, ".github/workflows/core.yml").replace(/, ready_for_review\]/, "]")
      .replace(/^(jobs:\r?\n {2}[\w-]+:(\r?\n))(?! {4}if:)/m, (job, _, eol) => `${job}    if: \${{ !github.event.pull_request.draft }}${eol}`)),
    mend: dir => {
      const text = read(dir, ".github/workflows/core.yml");
      write(dir, ".github/workflows/core.yml", /^ {4}types: \[/m.test(text) ? text.replace(/^( {4}types: \[[^\]\r\n]*)\]/m, "$1, ready_for_review]")
        : text.replace(/^( {2}pull_request:(\r?\n))/m, (on, _, eol) => `${on}    types: [opened, reopened, synchronize, ready_for_review]${eol}`));
    },
  },
  "16 November 2026, a new package looked up": {
    // (a project that runs the exact-versions and NuGet checks from a workflow of its own, without either lookup; its
    // workflow runs no licence or agent-tools script, whose own steps a workflow running them beside these would answer)
    stage: dir => write(dir, ".github/workflows/packages-own.yml", "name: packages-own\n\non:\n  pull_request:\n\njobs:\n  packages:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/exact-versions.mjs checks/licences.json\n      - run: node core/scripts/nuget.mjs checks/licences.json --packages packages\n"),
    mend: dir => write(dir, ".github/workflows/packages-own.yml", read(dir, ".github/workflows/packages-own.yml").replace("    steps:\n", "    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs checks/licences.json --nuget\n      - run: node core/scripts/lookup.mjs checks/licences.json\n")),
  },
  "17 November 2026, the checks as one job": {
    // (the call to core.yml folds the description check and leaves the copies checks out, their own call taken out too;
    // the mend, as the step words it, passes core.yml their config and marks)
    stage: dir => {
      const call = read(dir, ".github/workflows/core.yml").replace(/^ {6}(copies|sizes|description): .*\r?\n/gm, "");
      write(dir, ".github/workflows/core.yml", /^ {4}with:/m.test(call) ? call.replace(/^( {4}with:\r?\n)/m, "$1      description: true\n")
        : call.replace(/^( {4}uses: \S+\/\.github\/workflows\/core\.yml@\S+.*\r?\n)/m, "$1    with:\n      description: true\n"));
      for (const f of ["copies.yml", "pr-description.yml"]) fs.rmSync(at(dir, `.github/workflows/${f}`), { force: true });
    },
    mend: dir => write(dir, ".github/workflows/core.yml", read(dir, ".github/workflows/core.yml").replace(/^( {4}with:\r?\n)/m, "$1      copies: checks/copies.json\n      sizes: checks/sizes.json\n")),
  },
  "16 November 2026, a project in several repositories": {
    asked: true,
    // (a list of modules written before the module came, which neither takes it nor leaves it out; the mend leaves it out
    // with its reason, as the step words it for a project in one repository)
    stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/`repositories\.md`, /g, "").replace(/^Not taken: .*`repositories\.md`.*\r?\n/m, "")),
    mend: dir => {
      const manifest = read(dir, "core-manifest.md"), reason = "`repositories.md` (one repository, which no library carries the core into)";
      write(dir, "core-manifest.md", /^Not taken: /m.test(manifest) ? manifest.replace(/^(Not taken: .*?)\.?$/m, `$1, ${reason}.`) : manifest.replace(/^(Floor: .*)$/m, `$1\nNot taken: ${reason}.`));
    },
  },
  "17 November 2026, packages from the registry, the week's wait and pinned downloads": {
    // (an .npmrc that keeps install scripts off and that stood without the week's wait; the mend adds the line the step words)
    stage: dir => {
      const file = licenceConfig(project(dir)), config = JSON.parse(read(dir, file));
      write(dir, "stage-wait/.npmrc", "ignore-scripts=true\n");
      write(dir, file, `${JSON.stringify({ ...config, ignoreScriptsIn: [...(config.ignoreScriptsIn ?? []), "stage-wait/.npmrc"] }, null, 2)}\n`);
    },
    mend: dir => write(dir, "stage-wait/.npmrc", `${read(dir, "stage-wait/.npmrc")}min-release-age=7\n`),
  },
  "17 November 2026, what the project would be built on today": {
    // (a record that stood before the rule, argued on none of its lines; the mend writes the record as the step words
    // it, argued in full, so the records' check passes the pull request that adds it)
    stage: dir => {
      const file = where(read(dir, "core-manifest.md"));
      write(dir, file, `${(fs.existsSync(at(dir, file)) ? read(dir, file) : "# Choices\n").replace(/\n*$/, "\n")}\n## Choice: one language\n\n- Reopens it: a test takes over a minute.\n`);
    },
    mend: dir => {
      const file = where(read(dir, "core-manifest.md"));
      write(dir, file, `${(fs.existsSync(at(dir, file)) ? read(dir, file) : "# Choices\n").replace(/\n*$/, "\n")}\n## Choice: the project's foundations, judged again as if written today\n\n- Looked for: none the list lacked, in the registry and on the web.\n- The blind pick: the same stack.\n- The judgment: it stands; staying is the answer.\n- The suggestion: #1\n- Reopens it: a need in numbers the stack misses.\n`);
    },
  },
  "18 November 2026, a project's own rules and what holds them": {
    asked: true,
    // (a project with no list of what holds its own rules; the mend runs the command the step words, which writes it)
    stage: dir => fs.rmSync(at(dir, "checks/holders.json"), { force: true }),
    mend: dir => {
      const r = spawnSync(process.execPath, ["core/scripts/holders.mjs", "--own", "--write"], { cwd: dir, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`holders.mjs --own --write: ${r.stderr}`);
    },
  },
  "17 November 2026, the packages the copy carries": {
    // (a suite of the project's own that runs on a change to its code or to the core's scripts, and not on one to the
    // packages they run; the mend adds that folder to its filter)
    stage: dir => write(dir, ".github/workflows/scripts-staged.yml", SCRIPTS),
    after: dir => fs.rmSync(at(dir, ".github/workflows/scripts-staged.yml"), { force: true }),
    mend: dir => write(dir, ".github/workflows/scripts-staged.yml", SCRIPTS.replace("      - 'core/scripts/**'\n", "      - 'core/scripts/**'\n      - 'core/third-party/**'\n")),
  },
};
