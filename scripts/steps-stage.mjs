// For the tests alone (steps-test.mjs and upgrade-test.mjs, beside this file): for each step steps.mjs reads with a
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
import { MOVED_GLOB, MOVED_GLOBS, callers, moved, project } from "./steps.mjs";

const at = (dir, f) => path.join(dir, f);
const read = (dir, f) => fs.readFileSync(at(dir, f), "utf8");
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(at(dir, f)), { recursive: true }); fs.writeFileSync(at(dir, f), text); };
const SLOTS = /^(\| Slot \| Here \|\r?\n\| --- \| --- \|\r?\n)/m;

const PIN = "0".repeat(40);
const NUGET = `name: nuget\n\non:\n  pull_request:\n\njobs:\n  nuget:\n    uses: ${CORE}/.github/workflows/nuget.yml@${PIN}\n    with:\n      config: checks/licences.json\n`;

// (a suite of the project's own whose path filter leaves the copy and the manifest out, as it was told, and not the
// files that hold only calls to the core's workflows, whose pins a sync moves)
const SUITE = "name: suites-staged\n\non:\n  pull_request:\n    paths-ignore:\n      - 'core/**'\n      - 'core-manifest.md'\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo the suite\n";

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
      write(dir, ".github/workflows/licences-own.yml", "name: licences-own\n\non:\n  pull_request:\n\njobs:\n  licences:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/licences.mjs checks/licences.json\n      - run: node core/scripts/agent-tools.mjs checks/licences.json\n");
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
      if (!fs.existsSync(at(dir, ".github/workflows/nuget.yml"))) write(dir, ".github/workflows/nuget.yml", NUGET);
      const config = JSON.parse(read(dir, "checks/licences.json"));
      config.nuget ??= { ships: [], tools: [] };
      config.nuget.ships = [...(config.nuget.ships ?? []), "stage/packages.lock.json"];
      write(dir, "checks/licences.json", `${JSON.stringify(config, null, 2)}\n`);
    },
  },
  "13 November 2026, the NuGet check fails from the first day": {
    stage: dir => write(dir, ".github/workflows/nuget-staged.yml", `${NUGET.replace("name: nuget", "name: nuget-staged")}      advisory: true\n`),
    mend: dir => write(dir, ".github/workflows/nuget-staged.yml", read(dir, ".github/workflows/nuget-staged.yml").replace(/^      advisory: true\r?\n/m, "")),
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
    stage: dir => {
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
};
