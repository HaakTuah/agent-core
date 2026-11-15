// Tests the screen checks' baseline (screens.mjs, beside this file): the config and the findings it refuses, what is
// new against the baseline and what a listed entry covers, a check that reports against one that binds, the baseline
// lowered only on the screens run, and whole runs in a scratch repository: no config, the first baseline, a new
// finding failing with its mend, and an entry that joins the baseline against the base. Each failure is read for its
// mend (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/screens-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { lowered, parseConfig, parseFound, verdict, where } from "./screens.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("./screens.mjs", import.meta.url));
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
const base = { listed: new Map([["rendered: cart: contrast of the total", { count: 3 }]]), grown: {} };
let v = verdict({ config: c, at: "c.json", self: "screens.mjs", found: f, baseline: base });
ok(v.fail.length === 1 && v.fail[0].includes("values: home") && mended(v.fail.join("\n")) && v.said.length === 0, "a new finding of a check that binds fails, with its mend; a listed one that shrank does not", v.fail.join("\n"));
v = verdict({ config: parseConfig(config({ values: "reports", rendered: "reports" }), "c"), at: "c.json", self: "s", found: f, baseline: base });
ok(v.fail.length === 0 && v.said.length === 1, "a new finding of a check that reports is said and fails nothing");
const grew = parseFound(found(["cart"], { "rendered: cart: contrast of the total": { count: 4 } }), "f", c);
ok(verdict({ config: c, at: "c", self: "s", found: grew, baseline: base }).said.length === 1, "a listed entry that grows is new");
const other = parseFound(found(["home"], { "rendered: home: contrast of the total": { count: 1 } }), "f", c);
ok(verdict({ config: c, at: "c", self: "s", found: other, baseline: base }).said.length === 1, "an entry of another screen covers nothing, though that screen was not run");
const joined = { listed: new Map([...base.listed, ["values: home: #f00 in the button", true]]), grown: {} };
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: joined, base: { name: "origin/main", listed: base.listed } });
ok(v.fail[0]?.includes("only shrinks") && v.fail[1] === "  values: home: #f00 in the button" && mended(v.fail.join("\n")), "an entry that joins the baseline against the base fails, with its mend", v.fail.join("\n"));
v = verdict({ config: c, at: "c", self: "s", found: f, baseline: { ...joined, grown: { "values: home: #f00 in the button": "the button's red is the brand's, which the direction keeps" } }, base: { name: "origin/main", listed: base.listed } });
ok(v.fail.length === 0, "one given its reason under \"grown\" joins");

// ---- the baseline lowered ----
const listed = new Map([["rendered: cart: contrast of the total", { count: 3 }], ["rendered: cart: gone", true], ["values: about: #0f0", true]]);
const low = lowered(listed, f);
ok(low.get("rendered: cart: contrast of the total").count === 2 && !low.has("rendered: cart: gone") && low.has("values: about: #0f0"), "--write lowers what was run and keeps what was not");

// ---- whole runs ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "screens-test-"));
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
  ok(r.code === 1 && mended(r.out), "a config with no baseline fails, with its mend", r.out);
  r = run(["found.json", "--first"]);
  ok(r.code === 0 && fs.existsSync(path.join(dir, "checks/screens-baseline.json")), "--first writes the first baseline", r.out);
  r = run(["found.json"]);
  ok(r.code === 0, "what the baseline lists fails nothing", r.out);
  git("add", "-A"); git("commit", "-qm", "base");
  fs.writeFileSync(path.join(dir, "found.json"), found(["home"], { "values: home: #f00 in the button": true, "values: home: 13px in the title": true }));
  r = run(["found.json"]);
  ok(r.code === 1 && mended(r.out) && r.out.includes("13px"), "a new finding fails, with its mend", r.out);
  fs.writeFileSync(path.join(dir, "checks/screens-baseline.json"), JSON.stringify({ listed: { "values: home: #f00 in the button": true, "values: home: 13px in the title": true } }));
  r = run(["found.json"], { SCREENS_BASE: "main" });
  ok(r.code === 1 && mended(r.out) && r.out.includes("only shrinks"), "a finding put in the baseline by hand fails against the base, with its mend", r.out);
  r = run(["found.json", "--bogus"]);
  ok(r.code === 1 && mended(r.out), "an unknown argument fails, with its mend", r.out);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
