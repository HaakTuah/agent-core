// Checks the copies check (copies.mjs, beside this file) on the files an agent tool takes its instructions from (#405),
// in a small project made for it: a copy the pull request's base held there is noted and fails nothing until --tools
// lists it, and with no base each is noted; one the base did not hold fails, as does a baseline that lists one; a
// file whose link leads out of the project is not read, and one whose name holds a line break is named on one line.
// On Linux and on Windows. Git and Node's own modules only.
//
//   node scripts/copies-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${detail.replaceAll("\n", "\n     ")}`); } };
const here = fileURLToPath(new URL(".", import.meta.url));
const SAID = "every pull request is reviewed in the background while the next task goes on without waiting for it";
const OTHER = "a release is cut only on the word of the owner and never by the choice of a session alone";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "copies-tools-test-"));
try {
  const put = (f, body) => { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); };
  const g = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const commit = what => { g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", what); return g("rev-parse", "HEAD").trim(); };
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["copies.mjs", "guards.mjs", "rule-files.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "yaml-keys.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "core/scripts", f));
  put("AGENTS.md", `# A project\n\n${SAID}.\n`);
  put("SECURITY.md", "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/a.md`;\n");
  put("docs/a.md", `# Developing\n\n${OTHER}.\n`);
  put("checks/copies.json", `${JSON.stringify({ baseline: "checks/copies-baseline.json", code: [], prose: [], proseFromSecurity: true })}\n`);
  // (the project as it stood before the check read its agent tools' files: an old copy of its own listed, and a
  // steering file that repeats AGENTS.md, which the baseline, written before, does not list)
  const LISTED = "the tests a change can reach are run on each pull request and the whole suite on main";
  put("AGENTS.md", `# A project\n\n${SAID}.\n\n${LISTED}.\n`);
  put("docs/a.md", `# Developing\n\n${OTHER}.\n\n${LISTED}.\n`);
  g("init", "-q"); g("add", "-A");
  spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", "--first"], { cwd: dir });
  put(".kiro/steering/own.md", `# Steering\n\n${SAID}.\n`);
  const base = commit("base");
  const check = (env = {}, ...flags) => {
    const r = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", ...flags], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "", ...env } });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const OLD = /^note an old copy in an agent tool's file, not yet in the baseline: (AGENTS\.md:3-3 and \.kiro\/steering\/own\.md:3-3|\.kiro\/steering\/own\.md:3-3 and AGENTS\.md:3-3) /m;
  const NOTED = /^ok {3}no new copies \(1 old ones, listed in checks\/copies-baseline\.json, to be removed; 1 in an agent tool's files, noted above\)$/m;
  let r = check();
  ok(r.status === 0 && OLD.test(r.out) && NOTED.test(r.out) && /with no base to read against, so it fails nothing; list it with node core\/scripts\/copies\.mjs checks\/copies\.json --tools/.test(r.out), "with no base, a copy in an agent tool's file is noted, with how to list it, and fails nothing", r.out);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && OLD.test(r.out) && NOTED.test(r.out) && /the pull request's base held it, so it fails nothing/.test(r.out), "one the pull request's base held is noted, and fails nothing", r.out);

  // (a copy the base did not hold fails, in a tool's folder or GEMINI.md, and so does an old one copied once more)
  put(".agents/rules/new.md", `# A rule\n\n${OTHER}.\n`);
  g("add", "-A");
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && mended(r.out) && /^FAIL: a new copy: (\.agents\/rules\/new\.md:3-3 and docs\/a\.md:3-3|docs\/a\.md:3-3 and \.agents\/rules\/new\.md:3-3) .*Mend: keep it in the one place/m.test(r.out) && OLD.test(r.out), "a copy the base did not hold fails, saying its mend, while the old one is still noted", r.out);
  g("rm", "-q", "-f", ".agents/rules/new.md");
  put("GEMINI.md", `# Gemini\n\n${SAID}.\n`);
  g("add", "-A");
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && /^FAIL: a new copy: .*GEMINI\.md:3-3/m.test(r.out), "an old copy that spreads to one more place fails", r.out);
  g("rm", "-q", "-f", "GEMINI.md");

  // (--tools lists them, and the baseline may grow by those alone against the base)
  r = check({}, "--tools");
  const listed = JSON.parse(fs.readFileSync(path.join(dir, "checks/copies-baseline.json"), "utf8")).windows;
  ok(r.status === 0 && Object.keys(listed).length > 0 && Object.values(listed).every(n => n === 2) && /the copies in an agent tool's files listed/.test(r.out), "--tools lists in the baseline each window of the copy in an agent tool's file, in as many places as it stands", r.out);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && !/not yet in the baseline/.test(r.out) && /no new copies \(2 old ones/.test(r.out), "and against the base, whose baseline lists none, the baseline that lists what stood there passes, the copy no longer noted", r.out);
  const written = commit("the copies in an agent tool's files listed");
  r = check({ COPIES_BASE: written });
  ok(r.status === 0 && !/not yet in the baseline/.test(r.out), "and once it stands on the base, it passes there too", r.out);

  // (a baseline that lists a copy the base did not hold fails, though --tools wrote it)
  put(".agents/rules/new.md", `# A rule\n\n${OTHER}.\n`);
  g("add", "-A");
  check({}, "--tools");
  r = check({ COPIES_BASE: written });
  ok(r.status === 1 && mended(r.out) && /^FAIL: checks\/copies-baseline\.json adds or raises \d+ windows against [0-9a-f]{40}, and the baseline only shrinks\. Mend: /m.test(r.out), "a baseline that lists a copy in an agent tool's file the base did not hold fails, saying its mend", r.out);
  g("checkout", "-q", "--", "checks/copies-baseline.json");
  g("rm", "-q", "-f", ".agents/rules/new.md");

  // (a config that reads no rule files reads no tool's file either)
  put("checks/prose.json", `${JSON.stringify({ baseline: "checks/copies-baseline.json", prose: ["AGENTS.md"], proseFromSecurity: false })}\n`);
  const prose = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/prose.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "" } });
  ok(!/agent tool's file|own\.md/.test(`${prose.stdout}${prose.stderr}`), "a config that reads no rule files reads no agent tool's file either", `${prose.stdout}${prose.stderr}`);
  fs.rmSync(path.join(dir, "checks/prose.json"));

  // (a file in a tool's folder whose link leads out of the project is not read)
  if (process.platform !== "win32") {
    const away = fs.mkdtempSync(path.join(os.tmpdir(), "copies-tools-away-"));
    try {
      fs.writeFileSync(path.join(away, "out.md"), `# Out\n\n${OTHER}.\n`);
      fs.symlinkSync(path.join(away, "out.md"), path.join(dir, ".kiro/steering/out.md"));
      g("add", "-A");
      r = check({ COPIES_BASE: written });
      ok(r.status === 0 && !/out\.md/.test(r.out), "a file in a tool's folder whose link leads out of the project is not read", r.out);
    } finally { fs.rmSync(away, { recursive: true, force: true }); }
    // (a name that holds a line break, which a log could read as a command of its own, is printed on one line)
    const odd = ".agents/rules/x\n::error::y.md";
    put(odd, `# Odd\n\n${OTHER}.\n`);
    g("add", "-A");
    r = check({ COPIES_BASE: written });
    ok(r.status === 1 && /^FAIL: a new copy: .*x%0A::error::y\.md/m.test(r.out) && !/^::error::/m.test(r.out), "a file in a tool's folder whose name holds a line break is named on one line, escaped", r.out);
    g("rm", "-q", "-f", odd);
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
process.exit(failed ? 1 : 0);
