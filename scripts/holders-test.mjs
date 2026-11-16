// Tests rules.mjs (what counts as a rule, and its text) and holders.mjs (what holds each, and what it fails), on
// rule files and holders written in a scratch folder, and on the core's own. Its tests workflow runs it on every pull
// request here. Node's own modules.
//
//   node scripts/holders-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { counts, holders, report } from "./holders.mjs";
import { mended } from "./mend.mjs";
import { fingerprint, rules, rulesOf } from "./rules.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "holders-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

// ---- what counts as a rule ----
const text = [
  "# A module", "", "Read when needed.", "",
  "**1. A rule of a paragraph.**", "- Its first point.", "- **A rule inside it:** said here.", "  - and its own point.", "",
  "Running text with **bold** inside opens nothing.", "",
  "**2. The next one,** said in one line.", "",
  "1. **Numbered** and its text", "   on two lines.", "   - **Its own item,** indented.", "2. **The second numbered.**", "",
  "```", "**Not a rule** in a fence.", "```", "",
  "- **A last item** (core archive 1).",
].join("\n");
const r = rulesOf("modules/x.md", text);
ok(JSON.stringify(r.map(x => x.lead)) === JSON.stringify(["1. A rule of a paragraph", "A rule inside it", "2. The next one", "Numbered", "Its own item", "The second numbered", "A last item"]),
  "a rule is each paragraph or item that opens with a bold lead, its stop or colon left out; none in running text or a fence", JSON.stringify(r.map(x => x.lead)));
ok(r[0].text.includes("and its own point") && r[0].text.includes("Running text") && !r[0].text.includes("2. The next one"), "a paragraph's rule runs to the next paragraph that opens one, its items in it");
ok(r[1].text === "- **A rule inside it:** said here.\n  - and its own point.", "an item's rule holds the lines indented under it, and stops at the next item at its depth", r[1].text);
ok(r[3].text.includes("on two lines") && r[3].text.includes("Its own item") && !r[3].text.includes("The second"), "a numbered item holds its own items");
ok(fingerprint("a  rule\nsaid") === fingerprint("a rule said") && fingerprint("a rule") !== fingerprint("a rules"), "a fingerprint changes with a word, not with spacing");
const mine = rules(root);
ok(mine.length > 100 && new Set(mine.map(x => x.key)).size === mine.length, `the core's floor and modules hold ${mine.length} rules, no two named alike`);
ok(rules(root, { agents: true }).some(x => x.key === "AGENTS.md: Nothing locks a project"), "with agents, the core's own AGENTS.md is read too");

// ---- what holds each, and what fails ----
const project = (holdersJson, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(tmp, "p-"));
  fs.mkdirSync(path.join(dir, "modules")); fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "modules", "x.md"), text);
  fs.writeFileSync(path.join(dir, "scripts", "a-check.mjs"), "");
  fs.writeFileSync(path.join(dir, "scripts", "holders.json"), typeof holdersJson === "string" ? holdersJson : JSON.stringify({ holders: holdersJson }));
  for (const [f, t] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), t);
  return dir;
};
const aCase = { name: "a-case", holds: ["modules/x.md: The second numbered", "modules/x.md: A last item"], inPart: ["modules/x.md: A last item"] };
const good = holders(project({ "modules/x.md: 1. A rule of a paragraph": "check: scripts/a-check.mjs", "modules/x.md: A rule inside it": ["check: GitHub's ruleset, in part", "audit, in part"], "modules/x.md: Numbered": "describes", "modules/x.md: Its own item": "audit" }), [aCase]);
const c = counts(good);
ok(!good.wrong.length && c.check === 1 && c.case === 1 && c.audit === 1 && c.part === 2 && c.describes === 1 && JSON.stringify(c.none) === JSON.stringify(["modules/x.md: 2. The next one"]),
  "each rule is counted by its holders, a staged case's own among them; one held only in part counts as in part; one with none is listed", JSON.stringify({ ...c, wrong: good.wrong }));
const hooked = counts(holders(project({ "modules/x.md: 1. A rule of a paragraph": "check: scripts/work-saved.sh, in part", "modules/x.md: A rule inside it": ["check: scripts/helper-call.mjs", "describes"], "modules/x.md: Numbered": ["check: scripts/work-saved.sh", "check: scripts/a-check.mjs, in part"] }, { "scripts/work-saved.sh": "", "scripts/helper-call.mjs": "" }), []));
ok(JSON.stringify(hooked.hooked) === JSON.stringify(["modules/x.md: 1. A rule of a paragraph", "modules/x.md: A rule inside it"]) && hooked.none.includes("modules/x.md: A rule inside it") && hooked.check === 0 && hooked.part === 1,
  "a rule whose only holders are hooks is listed as held by none, and one a check holds beside a hook is counted by the check (modules/tools.md)", JSON.stringify(hooked));
const bad = holders(project({ "modules/x.md: Gone": "check: scripts/a-check.mjs", "modules/x.md: Numbered": "check: scripts/missing.mjs", "modules/x.md: A last item": "case: a-case", "modules/x.md: The second numbered": "reviews" }), []);
ok(bad.wrong.length === 4 && bad.wrong.every(w => /Mend: /.test(w)), "a key that names no rule, a check not there, a staged case named here and a holder in no form each fail, saying the mend", bad.wrong.join("\n"));
ok(holders(project("{ not json"), []).wrong.length === 1, "holders.json that cannot be read fails");
ok(report(root).length >= 1 && /^- Of \d+ rules/.test(report(root)[0]), "the state report's lines begin with the counts");

// ---- the core's own, and the script as a check ----
const own = spawnSync(process.execPath, [path.join(root, "scripts", "holders.mjs")], { encoding: "utf8" });
ok(own.status === 0 && !own.stderr, "the core's own holders.json names only rules that stand, and checks that are there", own.stderr);
const failing = project({ "modules/x.md: Gone": "audit" });
fs.mkdirSync(path.join(failing, "scripts", "staged"));
for (const f of ["holders.mjs", "rules.mjs", "started.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(failing, "scripts", f));
fs.writeFileSync(path.join(failing, "scripts", "staged.mjs"), "export const CASES = [];\n");
const run = spawnSync(process.execPath, [path.join(failing, "scripts", "holders.mjs")], { encoding: "utf8" });
ok(run.status === 1 && mended(`${run.stdout}${run.stderr}`), "where holders.json is wrong the check fails, each failure saying its mend", `${run.stdout}${run.stderr}`);

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
