// Tests the screen checks' baseline (scripts/screens.mjs): the config and the findings it refuses, what is new against
// the baseline and what a listed entry covers, a check that reports against one that binds, each check's own mend (a
// game's checks too), each of the module's checks (scripts/screens-checks.mjs) named in the config and failing a new
// finding with the mend that list gives it, an entry mended but still listed, the baseline lowered only on the screens
// run, and whole runs in a scratch repository: no config, the first baseline, a new finding failing with its mend, an
// entry that joins the baseline against the base, one of a check the base did not turn on, a base that is no commit, a
// baseline moved, a config taken out, one the base's manifest named taken out with its row, and a path outside the
// project. Each failure is read for its mend (mend.mjs). Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/screens-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { lowered, parseConfig, parseFound, rewritten, verdict, where } from "../scripts/screens.mjs";
import { CHECKS, MENDS } from "../scripts/screens-checks.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/screens.mjs", import.meta.url));
const refused = read => { try { read(); return ""; } catch (e) { return `FAIL: ${e.message}`; } };

// ---- the config ----
const config = checks => JSON.stringify({ baseline: "checks/screens-baseline.json", checks });
for (const [what, text] of Object.entries({
  "no JSON": "{", "no checks": JSON.stringify({ baseline: "b.json" }), "a baseline outside": JSON.stringify({ baseline: "../b.json", checks: {} }),
  "an unknown key": JSON.stringify({ baseline: "b.json", checks: {}, tool: "x" }), "an unknown check": config({ beauty: "binds" }), "an unknown mode": config({ values: "fails" }),
})) ok(mended(refused(() => parseConfig(text, "checks/screens.json"))), `the config is refused, with its mend: ${what}`, refused(() => parseConfig(text, "c")));
const c = parseConfig(config({ values: "binds", rendered: "reports" }), "checks/screens.json");
ok(c.checks.get("values") === "binds" && c.checks.get("rendered") === "reports" && !c.checks.has("timing"), "the config's checks, each with its mode; one not named is off");
ok(where("| *screen checks* | `checks/ui.json`, run by `npm run shots` |") === "checks/ui.json" && where("") === "checks/screens.json", "the config is the one the manifest's row names, else the kit's path");

// ---- what was found ----
const found = (screens, f) => JSON.stringify({ screens, found: f });
for (const [what, text] of Object.entries({
  "no screens": JSON.stringify({ found: {} }), "an unknown check": found(["home"], { "beauty: home: x": true }),
  "a screen not run": found(["home"], { "values: settings: #f00": true }), "no detail": found(["home"], { "values: home": true }),
  "a count of nought": found(["home"], { "values: home: #f00": { count: 0 } }),
})) ok(mended(refused(() => parseFound(text, "found.json", c))), `the findings are refused, with their mend: ${what}`, refused(() => parseFound(text, "f", c)));
const f = parseFound(found(["home", "cart"], { "values: home: #f00 in the button": true, "rendered: cart: contrast of the total": { count: 2 }, "timing: home: load": true }), "found.json", c);
ok(f.found.size === 2 && f.off === 1, "a finding of a check the config leaves off is not read, only counted");

// ---- the verdict ----
const both = () => new Set(["values", "rendered"]);
const base = { listed: new Map([["rendered: cart: contrast of the total", { count: 3 }]]), grown: {}, checks: both() };
let v = verdict({ config: c, at: "c.json", self: "screens.mjs", found: f, baseline: base });
ok(v.fail.length === 1 && v.fail[0].includes("values: home") && mended(v.fail.join("\n")) && v.said.length === 0, "a new finding of a check that binds fails, with its mend; a listed one that shrank does not", v.fail.join("\n"));
v = verdict({ config: parseConfig(config({ values: "reports", rendered: "reports" }), "c"), at: "c.json", self: "s", found: f, baseline: base });
ok(v.fail.length === 0 && v.said.length === 1, "a new finding of a check that reports is said and fails nothing");
const grew = parseFound(found(["cart"], { "rendered: cart: contrast of the total": { count: 4 } }), "f", c);
ok(verdict({ config: c, at: "c", self: "s", found: grew, baseline: base }).said.length === 1, "a listed entry that grows is new");
const other = parseFound(found(["home"], { "rendered: home: contrast of the total": { count: 1 } }), "f", c);
ok(verdict({ config: c, at: "c", self: "s", found: other, baseline: base }).said.length === 1, "an entry of another screen covers nothing, though that screen was not run");
const joined = { listed: new Map([...base.listed, ["values: home: #f00 in the button", true]]), grown: {}, checks: both() };
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: joined, base: { name: "origin/main", listed: base.listed, checks: both() } });
ok(v.fail[0]?.includes("only shrinks") && v.fail[1] === "  values: home: #f00 in the button" && mended(v.fail.join("\n")), "an entry that joins the baseline against the base fails, with its mend", v.fail.join("\n"));
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: { ...joined, grown: { "values: home: #f00 in the button": "the button's red is the brand's, which the direction keeps" } }, base: { name: "origin/main", listed: base.listed, checks: both() } });
ok(v.fail.length === 0, "one given its reason under \"grown\" joins");
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: joined, base: { name: "origin/main", listed: base.listed, checks: new Set(["rendered"]) } });
ok(v.fail.length === 0, "an entry of a check the base had not listed joins freely: the check reads more, and what stood is listed", v.fail.join("\n"));

const stale = { listed: new Map([["values: home: #f00 in the button", true], ["values: cart: #0f0", true]]), grown: {}, checks: both() };
v = verdict({ config: c, at: "c", self: "s", found: parseFound(found(["home"], {}), "f", c), baseline: stale });
ok(v.fail[0]?.includes("--write") && v.fail.includes("  values: home: #f00 in the button") && !v.fail.includes("  values: cart: #0f0") && mended(v.fail.join("\n")), "a listed entry of a binding check that a run of its screen no longer finds fails until --write lowers the baseline; one of a screen not run stays", v.fail.join("\n"));
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: base });
ok(v.fail[0]?.includes("from the one system the direction names"), "a new finding's mend is its check's own, which a session acts on with no rule file open", v.fail[0]);
// (each check of the list, turned on to bind, fails a new finding with the list's own mend for it)
for (const check of CHECKS) {
  const one = parseConfig(config({ [check]: "binds" }), "c");
  const got = verdict({ config: one, at: "c", self: "s", found: parseFound(found(["home"], { [`${check}: home: x`]: true }), "f", one), baseline: { listed: new Map(), grown: {}, checks: new Set([check]) } });
  ok(got.fail.length === 1 && got.fail[0].includes(`Mend: ${MENDS[check]};`) && MENDS[check].split(" ").length > 10 && mended(got.fail[0]), `the ${check} check fails a new finding with its own mend from the list, a sentence a session acts on`, got.fail.join("\n"));
}
ok(CHECKS.join() === "values,rendered,pictures,timing,console,settings,first-choice", "the list holds the module's seven checks, in its order", CHECKS.join());

const game = parseConfig(config({ settings: "binds" }), "c");
v = verdict({ config: game, at: "c", self: "s", found: parseFound(found(["options"], { "settings: options: text size lost on reopening": true }), "f", game), baseline: { listed: new Map(), grown: {}, checks: new Set(["settings"]) } });
ok(v.fail.length === 1 && v.fail[0].includes("keep it when the product is closed and opened again") && mended(v.fail[0]), "a game's settings check: a setting missing or lost fails with its own mend", v.fail.join("\n"));
const first = parseConfig(config({ "first-choice": "binds" }), "c");
v = verdict({ config: first, at: "c", self: "s", found: parseFound(found(["start"], { "first-choice: start: past its target": true }), "f", first), baseline: { listed: new Map(), grown: {}, checks: new Set(["first-choice"]) } });
ok(v.fail.length === 1 && v.fail[0].includes("the first real choice the finding names") && v.fail[0].includes("Teaching has an order") && mended(v.fail[0]), "a game's first-choice check: the first real choice past its target fails with its own mend", v.fail.join("\n"));

v = verdict({ config: c, at: "c", self: "s", found: f, baseline: { ...base, checks: new Set(["rendered"]) } });
ok(v.fail.length === 1 && v.fail[0].includes("never listed what the values check finds") && mended(v.fail[0]), "a check turned on that the baseline has never listed fails, with its mend, and its findings are not read as new", v.fail.join("\n"));
const partial = parseFound(found(["home"], { "values: home: #f00 in the button": true }), "f", c);
ok(mended(refused(() => rewritten({ ...base, checks: new Set(["rendered"]) }, c, partial, "s"))), "--write refuses to list a check from a run that did not cover every screen, with its mend");
const whole = parseFound(JSON.stringify({ screens: ["home", "cart"], all: true, found: { "values: home: #f00 in the button": true, "values: cart: #0f0": true } }), "f", c);
const rw = rewritten({ ...base, checks: new Set(["rendered"]) }, c, whole, "s");
ok(rw.checks.has("values") && rw.listed.has("values: cart: #0f0") && rw.listed.has("values: home: #f00 in the button") && !rw.listed.has("rendered: cart: contrast of the total"), "--write lists a newly turned-on check from a run over every screen, and lowers the rest", JSON.stringify([...rw.listed.keys()]));

const widened = { listed: new Map([["values: home: #f00 in the button", true]]), grown: {}, checks: both() };
const counted = parseFound(found(["home"], { "values: home: #f00 in the button": { count: 100 } }), "f", c);
v = verdict({ config: c, at: "c", self: "s", found: counted, baseline: widened, base: { name: "origin/main", listed: new Map([["values: home: #f00 in the button", { count: 1 }]]), checks: both() } });
ok(v.fail[0]?.includes("only shrinks") && v.fail.includes("  values: home: #f00 in the button") && mended(v.fail.join("\n")), "a count the base listed, listed as true, joins the baseline against the base, since true covers any count", v.fail.join("\n"));
v = verdict({ config: c, at: "c", self: "s", found: counted, baseline: widened, base: { name: "origin/main", listed: widened.listed, checks: both() } });
ok(v.fail.length === 0, "a finding read as a count where the baseline lists true, as the base did, fails nothing: a tool that changes how it reports locks nothing", v.fail.join("\n"));

// ---- the baseline lowered ----
const listed = new Map([["rendered: cart: contrast of the total", { count: 3 }], ["rendered: cart: gone", true], ["values: about: #0f0", true]]);
const low = lowered(listed, f, c.checks);
ok(low.get("rendered: cart: contrast of the total").count === 2 && !low.has("rendered: cart: gone") && low.has("values: about: #0f0"), "--write lowers what was run and keeps what was not");
const valuesOff = parseConfig(config({ console: "reports" }), "c");
const offRun = parseFound(found(["home"], { "values: home: raw red": true }), "f", valuesOff);
const kept = rewritten({ listed: new Map([["values: home: raw red", true]]), grown: {}, checks: new Set(["values", "console"]) }, valuesOff, offRun, "s");
ok(kept.listed.has("values: home: raw red"), "--write keeps the entries of a check switched off, whose findings the run does not read");

// ---- whole runs ----
const dir = scratchDir("screens-test-");
try {
  const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: dir, stdio: "pipe" });
  const run = (args, env = {}) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, SCREENS_BASE: "", ...env } }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
  git("init", "-q", "-b", "main");
  fs.writeFileSync(path.join(dir, "found.json"), found(["home"], { "values: home: #f00 in the button": true }));
  let r = run(["found.json"]);
  ok(r.code === 0 && r.out.includes("no screen check is on"), "with no config every check is off, and nothing fails", r.out);
  fs.mkdirSync(path.join(dir, "checks"));
  fs.writeFileSync(path.join(dir, "checks/screens.json"), config({ values: "binds" }));
  r = run(["found.json"]);
  ok(r.code === 1 && mended(r.out, { from: dir }), "a config with no baseline fails, with its mend", r.out);
  fs.writeFileSync(path.join(dir, "checks/screens.json"), JSON.stringify({ baseline: "checks/screens/baseline.json", checks: { values: "binds" } }));
  r = run(["found.json", "--first"]);
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("every screen"), "--first refuses a run that did not cover every screen, with its mend", r.out);
  fs.writeFileSync(path.join(dir, "found.json"), JSON.stringify({ screens: ["home"], all: true, found: { "values: home: #f00 in the button": true } }));
  r = run(["found.json", "--first"]);
  ok(r.code === 0 && fs.existsSync(path.join(dir, "checks/screens/baseline.json")), "--first makes the baseline's folder where it is missing", r.out);
  fs.rmSync(path.join(dir, "checks/screens"), { recursive: true });
  fs.writeFileSync(path.join(dir, "checks/screens.json"), config({ values: "binds" }));
  r = run(["found.json", "--first"]);
  ok(r.code === 0 && fs.existsSync(path.join(dir, "checks/screens-baseline.json")), "--first writes the first baseline", r.out);
  r = run(["found.json"]);
  ok(r.code === 0, "what the baseline lists fails nothing", r.out);
  git("add", "-A"); git("commit", "-qm", "base");
  fs.writeFileSync(path.join(dir, "found.json"), found(["home"], { "values: home: #f00 in the button": true, "values: home: 13px in the title": true }));
  r = run(["found.json"]);
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("13px"), "a new finding fails, with its mend", r.out);
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ checks: ["values"], listed: { "values: home: #f00 in the button": true, "values: home: 13px in the title": true } }));
  r = run(["found.json"], { SCREENS_BASE: "main" });
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("only shrinks"), "a finding put in the baseline by hand fails against the base, with its mend", r.out);
  r = run(["found.json"], { SCREENS_BASE: "origin/nowhere" });
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("is not a commit"), "a base that is no commit here fails, with its mend, never skipping the comparison", r.out);
  fs.renameSync(path.join(dir, "checks/screens-baseline.json"), path.join(dir, "checks/moved.json"));
  fs.writeFileSync(path.join(dir, "checks/screens.json"), JSON.stringify({ baseline: "checks/moved.json", checks: { values: "binds" } }));
  r = run(["found.json"], { SCREENS_BASE: "main" });
  ok(r.code === 1 && r.out.includes("only shrinks"), "a baseline moved to a new path is still read against the base's own", r.out);
  fs.rmSync(path.join(dir, "checks/screens.json"));
  r = run(["found.json"], { SCREENS_BASE: "main" });
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("is gone"), "a config the base holds may not be taken out, with its mend", r.out);
  git("checkout", "-q", "-b", "custom"); fs.writeFileSync(path.join(dir, "checks/custom.json"), config({ values: "binds" }));
  fs.writeFileSync(path.join(dir, "core-manifest.md"), "## Slots\n| Slot | Here |\n| --- | --- |\n| *screen checks* | `checks/custom.json` |\n");
  git("add", "-A"); git("commit", "-qm", "custom");
  fs.rmSync(path.join(dir, "checks/custom.json")); fs.rmSync(path.join(dir, "core-manifest.md"));
  r = run(["found.json"], { SCREENS_BASE: "custom" });
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("checks/custom.json is gone"), "a config the base's manifest named, taken out with its row, fails, with its mend", r.out);
  fs.writeFileSync(path.join(dir, "checks/screens.json"), "{ not a config");
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ checks: ["values"], listed: { "values: home: #f00 in the button": true } }));
  git("add", "-A"); git("commit", "-qm", "broken"); git("branch", "broken");
  fs.writeFileSync(path.join(dir, "checks/screens.json"), config({ values: "binds" }));
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ checks: ["values"], listed: { "values: home: #f00 in the button": true, "values: home: 13px in the title": true } }));
  r = run(["found.json"], { SCREENS_BASE: "broken" });
  ok(r.code === 1 && r.out.includes("only shrinks"), "a config the base held that does not read as one lets nothing join freely", r.out);
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ listed: { "values: home: #f00 in the button": true } }));
  fs.writeFileSync(path.join(dir, "checks/screens.json"), config({ values: "binds" }));
  git("add", "-A"); git("commit", "-qm", "no checks key"); git("branch", "nokey");
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ checks: ["values"], listed: { "values: home: #f00 in the button": true, "values: home: 13px in the title": true } }));
  r = run(["found.json"], { SCREENS_BASE: "nokey" });
  ok(r.code === 1 && r.out.includes("only shrinks"), "a base baseline with no \"checks\" counts its config's checks as listed, so nothing joins freely", r.out);
  r = run(["../found.json"]);
  ok(r.code === 1 && mended(r.out, { from: dir }) && r.out.includes("not inside the project"), "a config or file of findings outside the project is refused, with its mend", r.out);
  r = run(["found.json", "--bogus"]);
  ok(r.code === 1 && mended(r.out, { from: dir }), "an unknown argument fails, with its mend", r.out);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
