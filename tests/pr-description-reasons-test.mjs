// Checks the line "Reasons read:" (scripts/pr-reasons.mjs): asked of a pull request that adds a line under the manifest's "Differences". Split from pr-description-test.mjs (#888); run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-reasons-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { differencesAdded, reasonsMend } from "../scripts/pr-reasons.mjs";
import { scratchDir, projectOf } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

// the line "Reasons read:", asked of a pull request that adds a line under the manifest's "Differences" (#756)
{
  const tmp = scratchDir("pr-description-reasons-");
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...a) => execFileSync("git", a, { cwd: tmp, env, stdio: ["ignore", "pipe", "pipe"] });
  const manifest = (...lines) => `# Core manifest\r\n\r\n## Differences\r\n\r\n${lines.join("\r\n")}\r\n\r\n## Slots\r\n\r\n- a slot: its row\r\n`;
  const commit = text => { if (text === null) fs.rmSync(path.join(tmp, "core-manifest.md"), { force: true }); else fs.writeFileSync(path.join(tmp, "core-manifest.md"), text); git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", "x"); };
  git("init", "-q");
  commit(null); commit(null);
  ok(differencesAdded(tmp).length === 0, "a head with no manifest adds no difference");
  commit(manifest("None."));
  ok(differencesAdded(tmp).length === 0, "a first manifest whose \"Differences\" says None adds none");
  commit(manifest("- `core/tasks/x.md`, \"A rule\": here it is so, on the owner's word."));
  const one = differencesAdded(tmp);
  ok(one.length === 1 && one[0].startsWith("- `core/tasks/x.md`"), "a line added under \"Differences\" is read, lines that end both ways");
  commit(manifest("- `core/tasks/x.md`, \"A rule\": here it is so, on the owner's word.", "- a second") .replace("## Slots\r\n\r\n- a slot: its row", "## Slots\r\n\r\n- a slot: another row"));
  ok(differencesAdded(tmp).join() === "- a second", "only the lines the change adds are read, and none under another heading");
  commit(manifest("- a second"));
  ok(differencesAdded(tmp).length === 0, "a difference taken out asks nothing");
  commit(null); commit(manifest("- a first difference"));
  ok(differencesAdded(tmp).join() === "- a first difference", "where the base holds no manifest, each difference of the head's is added");
  git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "no parent");
  ok(differencesAdded(tmp) === null, "with no base to read against, nothing is asked");
  ok(reasonsMend("No line.", []) === null && reasonsMend("No line.", null) === null, "a pull request that adds no difference is asked nothing");
  ok(reasonsMend("x\n Reasons read: core archive 161 and #156; its reason does not hold here, since this project has no players.\n", ["- a"]) === null, "a line \"Reasons read:\" with what was read passes, whatever its words");
  const mend = reasonsMend("x\nReasons read:\n", ["- `core/tasks/x.md`, a difference"]);
  ok(mend !== null && mend.includes("core/tasks/x.md") && mend.includes("reasons.mjs") && mended(`FAIL ${mend}`, { from: projectOf() }) && reasonsMend("x", ["- a"]) !== null && !/[\r\u001b]/u.test(reasonsMend("x", ["- a\r::error::x\u001b[2J"])) && reasonsMend("x", ["- a"], "vendor/core/").includes("`node vendor/core/scripts/reasons.mjs "), "an empty line, or none, fails, naming the difference (with no control character of the project's text) and the script that prints its reasons where the copy stands, with the mend");
}
process.exit(failed ? 1 : 0);
