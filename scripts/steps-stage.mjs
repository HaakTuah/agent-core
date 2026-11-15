// For the tests alone (steps-test.mjs and upgrade-test.mjs, beside this file): for each step steps.mjs reads with a
// check, how a project that missed it holds it (`stage`, written into the project at `dir`) and its mend as the step
// words it (`mend`), so that a test can take a step out of a synced project, see the sync report exactly that, and
// see the mend as written make it done. A step with a check and no entry here fails steps-test.mjs. Node's own modules.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";

const at = (dir, f) => path.join(dir, f);
const read = (dir, f) => fs.readFileSync(at(dir, f), "utf8");
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(at(dir, f)), { recursive: true }); fs.writeFileSync(at(dir, f), text); };
const SLOTS = /^(\| Slot \| Here \|\r?\n\| --- \| --- \|\r?\n)/m;

const PIN = "0".repeat(40);
const NUGET = `name: nuget\n\non:\n  pull_request:\n\njobs:\n  nuget:\n    uses: ${CORE}/.github/workflows/nuget.yml@${PIN}\n    with:\n      config: checks/licences.json\n`;

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
};
