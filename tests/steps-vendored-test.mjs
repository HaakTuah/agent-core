// Tests steps.mjs on projects the starter kit of this commit writes in a scratch folder with the core's copy at a path of
// its own (#628) or carried by a library or a submodule: the steps read each at the copy's path, a submodule that
// carries no core is none of a project's own files, and the kit's configs name the copy where it stands (#918).
// Node's own modules and git.
//
//   node tests/steps-vendored-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { kits, plan } from "../scripts/converge.mjs";
import { heldKitIn } from "../scripts/steps-kit.mjs";
import { STEPS, configs, notDone, project, report } from "../scripts/steps.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-vendored-");
const kit = heldKitIn(tmp, ok);

// (the same projects with the copy at another path, and the starter kit's own folder names read from it: #628)
const vendored = {};
for (const [name, o, at] of [["a-vendored-npm-project", { packages: "." }, "vendor/core/"], ["a-vendored-dotnet-game", { nuget: "src", game: true }, "third_party/the-core/"]]) vendored[name] = kit(name, o, { at });
// (the configs the kit writes leave out and name the copy at the manifest's path, which the fresh comparison above reads: #918)
for (const [name, at] of [["a-vendored-npm-project", "vendor/core/"], ["a-vendored-dotnet-game", "third_party/the-core/"]]) {
  const shape = fs.readFileSync(path.join(vendored[name], "checks/shape.json"), "utf8"), copies = fs.readFileSync(path.join(vendored[name], "checks/copies.json"), "utf8");
  ok(shape.includes(`":!${at}"`) && !/":!core\//u.test(shape) && copies.includes(`"${at}floor/*.md"`) && !/"core\//u.test(copies), `${name}: the starter kit's shape and copies configs leave out and name the copy where the manifest says it stands`, `${shape}\n${copies}`);
}
// (the one process finds the core's part of each rule file where the copy stands at another path, and writes none again:
// its marks name no path the kit's text is moved with; #1083)
for (const [name, dir] of Object.entries(vendored)) {
  const p = project(dir), { kit } = kits(p, null), { write } = plan(p, kit);
  const again = write.filter(w => w.to === "AGENTS.md" || w.to === "CLAUDE.md").map(w => w.to);
  ok(!again.length, `${name}: the one process finds the core's part of AGENTS.md and CLAUDE.md at the copy's path, and writes neither again`, again.join(", "));
}
// (the steps that read a project's own run of the core's scripts read it at the copy's path: a mutation tool's strength
// check, and the selection of the tests a change can reach with the name of the check that gates a tree that passed)
{
  const dir = vendored["a-vendored-npm-project"], manifest = path.join(dir, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  const strong = STEPS.find(s => s.lead === "16 November 2026, how strong the tests are"), passed = STEPS.find(s => s.lead.endsWith("a tree that passed is not run again"));
  const flow = path.join(dir, ".github/workflows/strength.yml"), select = path.join(dir, ".github/workflows/select.yml");
  fs.writeFileSync(manifest, was.replace(/^\| \*mutation tool\* \|.*$/m, "| *mutation tool* | `node vendor/core/scripts/mutate.mjs --report {report} {lines}` |"));
  const said = body => { fs.writeFileSync(flow, `name: strength\non:\n  pull_request:\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n${body}`); return notDone(dir, [strong])[0]?.mend ?? null; };
  const bare = said("      - run: node vendor/core/scripts/strength.mjs\n"), runs = said("      - run: node vendor/core/scripts/strength.mjs\n        env:\n          STRENGTH_BASE: origin/main\n");
  ok(runs === null && bare?.includes("`node vendor/core/scripts/strength.mjs`"), "a workflow that runs the strength check at the copy's path with its base reads done, and the mend asks for the step at that path", `${bare}\n${runs}`);
  fs.writeFileSync(select, "name: select\non:\n  push:\n  pull_request:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node vendor/core/scripts/select.mjs --env RUN\n");
  const selected = notDone(dir, [passed])[0]?.mend ?? null;
  ok(selected?.includes(".github/workflows/select.yml") && selected.includes("its job `t`"), "a selection run at the copy's path, with no check named that a tree passed, is found", selected);
  fs.writeFileSync(manifest, was); fs.rmSync(flow); fs.rmSync(select);
}
// (a submodule of the project that carries no core is none of its own files: a project with one reads as it did)
{
  const dir = kit("a-project-with-another-submodule", { packages: "." }, { held: false }), other = path.join(dir, "third");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "App.csproj"), "<Project />\n");
  const g = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "protocol.file.allow=always", ...args], { cwd, stdio: "ignore" });
  g(other, "init", "-q", "-b", "main"); g(other, "add", "-A"); g(other, "commit", "-q", "-m", "other");
  g(dir, "submodule", "add", "-q", `${other.replace(/\\/g, "/")}-origin.git`, "third");
  ok(!project(dir).files.some(f => f.startsWith("third/")) && !notDone(dir).length, "the files of a submodule that carries no core are not the project's own, and no step reads it", report(notDone(dir)));
}
// (a core a library carries, its files committed in the project: the library's own manifest pins it, and the floor's own
// copy stands beside it until every tool has passed the staged cases)
kit("a-library-carried-project", { packages: "." }, { at: "lib/core/", library: "lib/" });
kit("a-submodule-carried-project", { packages: "." }, { at: "lib/core/", library: "lib/", submodule: true });

done("steps-vendored");
