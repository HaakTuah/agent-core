// Checks that each job of the core's workflows that runs the upgrade test installs every package of the core's, the
// parser's among them, before it (#903: the release workflow's Windows run of the upgrade test failed on 19 November
// 2026 for want of the parser's packages, which the steps it reads load). Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/release-install-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../scripts/parse-yaml.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${!cond && detail ? `\n     ${detail}` : ""}`); if (!cond) failed++; };
const wfDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");

const jobs = ["tests.yml", "release.yml"].flatMap(f => Object.entries(parseYaml(fs.readFileSync(path.join(wfDir, f), "utf8")).jobs).map(([name, j]) => ({ name: `${f}/${name}`, steps: j.steps ?? [] })));
const at = (j, re) => j.steps.findIndex(s => re.test(String(s.run ?? "").trim()));
const short = jobs.filter(j => at(j, /tests\/upgrade-test\.mjs/) >= 0 && !(at(j, /^node scripts\/install\.mjs all\b/) >= 0 && at(j, /^node scripts\/install\.mjs all\b/) < at(j, /tests\/upgrade-test\.mjs/))).map(j => j.name);
ok(jobs.filter(j => at(j, /tests\/upgrade-test\.mjs/) >= 0).length >= 2 && !short.length, "each job that runs the upgrade test installs every package of the core's, the parser's among them, in a step before it (#903)", short.join(", "));

process.exit(failed ? 1 : 0);
