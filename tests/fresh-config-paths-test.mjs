// Tests fresh.mjs with kit-paths.mjs (#1361, point 5) on projects the starter kit of this commit writes in a scratch
// folder, each a git repository with nothing committed, whose checks' configs stand where their calls name them, not
// where the kit writes them: the calls and text that name them no difference, public or private, the NuGet check's own
// config on the lines that pass it, and what such a project lacks still listed at its own paths. Node's own modules and
// git.
//
//   node tests/fresh-config-paths-test.mjs
import fs from "node:fs";
import path from "node:path";
import { differences, fresh } from "../scripts/fresh.mjs";
import { heldKitIn } from "../scripts/steps-kit.mjs";
import { project } from "../scripts/steps.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const kit = heldKitIn(scratchDir("fresh-config-paths-"), ok);
let found;

for (const priv of [false, true]) {
  const name = priv ? "a-private-moved-project" : "a-moved-project", dir = kit(name, { packages: ".", nuget: ".", ...(priv ? { private: true } : {}) }, { held: false });
  const at = f => path.join(dir, f), read = f => fs.readFileSync(at(f), "utf8");
  const rewrite = (f, edit) => fs.writeFileSync(at(f), edit(read(f)));
  fs.writeFileSync(at("package-lock.json"), "{}\n");
  fs.mkdirSync(at("config"));
  for (const f of fs.readdirSync(at("checks")).filter(n => n !== "holders.json" && n !== "core-reading.json")) fs.renameSync(at(`checks/${f}`), at(`config/${f}`));
  // (a public project's NuGet check is called with a file of its own; a private one's licence check reads the NuGet
  // check's, which core.yml's one job passes, so it stays one file)
  if (!priv) {
    const { nuget, ...licences } = JSON.parse(read("config/licences.json"));
    fs.writeFileSync(at("config/licences.json"), JSON.stringify(licences, null, 2));
    fs.writeFileSync(at("config/nuget.json"), JSON.stringify({ nuget }, null, 2));
  }
  const moved = t => t.replace(/checks\/(?!holders|core-reading)/g, "config/");
  for (const f of fs.readdirSync(at(".github/workflows"))) rewrite(`.github/workflows/${f}`, t => (f === "nuget.yml" ? moved(t).replace("config: config/licences.json", "config: config/nuget.json") : moved(t)));
  for (const f of ["core-manifest.md", "SECURITY.md", "config/copies.json", "config/licences.json", "config/shape.json"]) rewrite(f, moved);
  rewrite("core-manifest.md", t => t.replace("| *size marks* |", "| *shape check* | `core/scripts/shape.mjs` with `config/shape.json` |\n| *size marks* |"));
  const pm = project(dir);
  found = differences(pm, fresh(pm));
  ok(!found.length, `${name}: its checks' configs moved to config/${priv ? "" : ", the NuGet check's to a file of its own,"} with the calls and text that name them: no difference`, found.join("\n"));
  // (a config lost from where the calls name it, and, in a private project, core.yml's one job without its sizes, which
  // then reads the marks from the manifest's slot: each listed at the project's path)
  fs.rmSync(at("config/shape-baseline.json"));
  if (priv) rewrite(".github/workflows/core.yml", t => t.replace(/^\s*sizes: .*\n/m, ""));
  const pl = project(dir);
  found = differences(pl, fresh(pl));
  ok(found.length === (priv ? 2 : 1) && found.includes("config/shape-baseline.json: missing (the starter kit writes it today)") && (!priv || found.includes(".github/workflows/core.yml: lacks the line \"sizes: config/sizes.json\"")),
    `${name}: a config lost, and a call's line lost, are still listed, at the project's paths`, found.join("\n"));
}

done("fresh-config-paths");
