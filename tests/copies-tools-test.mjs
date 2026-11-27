// Checks the copies check (scripts/copies.mjs) on the files an agent tool takes its instructions from (#405),
// in a small project made for it: a copy the pull request's base held there is noted and fails nothing until --tools
// lists it, and with no base each is noted; one the base did not hold fails, as does a baseline that lists one; a
// file whose link leads out of the project is not read, and one whose name holds a line break is named on one line.
// On Linux and on Windows. Git and Node's own modules only.
//
//   node tests/copies-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${detail.replaceAll("\n", "\n     ")}`); } };
const here = fileURLToPath(new URL("../scripts/", import.meta.url));
const SAID = "every pull request is reviewed in the background while the next task goes on without waiting for it";
const OTHER = "a release is cut only on the word of the owner and never by the choice of a session alone";
const dir = scratchDir("copies-tools-test-");
try {
  const put = (f, body) => { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); };
  const g = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const commit = what => { g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", what); return g("rev-parse", "HEAD").trim(); };
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["copies.mjs", "whole-output.mjs", "blobs.mjs", "guards.mjs", "rule-files.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "mend.mjs", "yaml-keys.mjs", "packages.mjs", "schemas.mjs", "core-owned.mjs", "copies-values.mjs", "code-shape-lexer.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "core/scripts", f));
  fs.cpSync(path.join(here, "schemas"), path.join(dir, "core/scripts/schemas"), { recursive: true });
  fs.cpSync(path.join(here, "..", ".packages"), path.join(dir, "core/.packages"), { recursive: true, filter: parserLeftOut });
  fs.copyFileSync(path.join(here, "..", ".gitignore"), path.join(dir, "core/.gitignore")); // (the copy's own: the installed packages, each install's, are no file of the project's)
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
  // (a copy whose every place is an entry file the core writes whole, as the starter kit writes them, is the kit's own
  // text: noted, failing nothing, though the base did not hold it; #1083)
  const KIT = "a file added to those lines is added here in the same pull request as the core asks";
  put(".kiro/steering/core.md", `# The core, for Kiro\n\n${KIT}.\n`);
  put(".agents/rules/core.md", `# The core, for Antigravity\n\n${KIT}.\n`);
  g("add", "-A");
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && /^note a copy in the core's own files, as the starter kit writes them: [^\n]*\.kiro\/steering\/core\.md[^\n]*the core's text, failing nothing$/m.test(r.out), "a copy between two entry files the core writes whole, which the base did not hold, is noted as the kit's text and fails nothing", r.out);
  g("rm", "-q", "-f", ".kiro/steering/core.md", ".agents/rules/core.md");
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

  // (the packages the core installs beside its copy are no code of the project's, and git does not track them: a
  // pattern that reaches them reads none)
  const block = `${Array.from({ length: 10 }, (_, i) => `const value${i} = compute(${i}, "a string long enough to make the run count");`).join("\n")}\n`;
  put("core/.packages/node_modules/a/dist/one.js", block); put("core/.packages/node_modules/a/dist/two.js", block);
  put("checks/code.json", `${JSON.stringify({ baseline: "checks/code-baseline.json", code: ["*.js"], prose: [], proseFromSecurity: false })}\n`);
  g("add", "-A");
  const code = (...flags) => { const c = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/code.json", ...flags], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "" } }); return { status: c.status, out: `${c.stdout}${c.stderr}` }; };
  code("--first");
  const first = JSON.parse(fs.readFileSync(path.join(dir, "checks/code-baseline.json"), "utf8"));
  r = code();
  ok(r.status === 0 && !/node_modules/.test(r.out) && !Object.keys(first.windows ?? {}).length, "a pattern of the project's that reaches the packages the core installs beside its copy reads none of them, though they hold a copy", r.out);
  put("src/one.js", block); put("src/two.js", block);
  g("add", "-A");
  r = code();
  ok(r.status === 1 && /^FAIL: a new copy: src\/(one|two)\.js/m.test(r.out) && !/node_modules/.test(r.out), "while the same copy in the project's own files fails", r.out);
  g("rm", "-q", "-f", "-r", "src", "checks/code.json");
  fs.rmSync(path.join(dir, "core/.packages/node_modules/a"), { recursive: true, force: true });
  fs.rmSync(path.join(dir, "checks/code-baseline.json"));

  // (against the base, the config is held to every file the base's read, an agent tool's among them)
  const cfgWas = fs.readFileSync(path.join(dir, "checks/copies.json"), "utf8");
  put("checks/copies.json", `${JSON.stringify({ baseline: "checks/copies-baseline.json", prose: ["AGENTS.md", "SECURITY.md", "docs/a.md"], proseFromSecurity: false })}\n`);
  r = check({ COPIES_BASE: written });
  put("checks/copies.json", cfgWas);
  ok(r.status === 1 && mended(r.out) && /reads 1 files fewer than [0-9a-f]{40}'s config read: \.kiro\/steering\/own\.md \(prose\)/.test(r.out), "a config that stops reading an agent tool's file the base's read fails, saying its mend", r.out);

  // (hostile files in a tool's folder, each read as text and failing nothing: one empty, one of bytes that are no
  // text, one line of two million characters, markup; and a base that is no commit, or reads as an option to git)
  put(".agents/rules/empty.md", "");
  fs.writeFileSync(path.join(dir, ".agents/rules/bytes.md"), Buffer.from([0, 255, 1, 254, 0, 10, 0]));
  put(".agents/rules/long.md", `${"x".repeat(2_000_000)}\n`);
  put(".agents/rules/markup.md", "<script>alert(1)</script> <img src=x onerror=alert(1)> ::error::markup\n");
  g("add", "-A");
  r = check({ COPIES_BASE: written });
  ok(r.status === 0 && !/::error::/.test(r.out), "an agent tool's file that is empty, of bytes, of one very long line or of markup is read as text and fails nothing", r.out);
  for (const bad of ["no-such-branch", "--output=x"]) {
    r = check({ COPIES_BASE: bad });
    ok(r.status === 1 && mended(r.out) && /^FAIL: COPIES_BASE .* is not a commit here\. Mend: fetch it/m.test(r.out) && !fs.existsSync(path.join(dir, "x")), `a base that is no commit (${bad}) fails, saying to fetch it, and is never read as an option`, r.out);
  }
  g("rm", "-q", "-f", ".agents/rules/empty.md", ".agents/rules/bytes.md", ".agents/rules/long.md", ".agents/rules/markup.md");

  // (a file in a tool's folder whose link leads out of the project is not read)
  if (process.platform !== "win32") {
    const away = scratchDir("copies-tools-away-");
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
    ok(r.status === 1 && /^FAIL: a new copy: .*x%0A: :error: :y\.md/m.test(r.out) && !/::/.test(r.out), "a file in a tool's folder whose name holds a line break is named on one line, escaped, each \"::\" broken", r.out);
    g("rm", "-q", "-f", odd);
    // (a tool's file that is a link inside the project is read through it, at the base as in the work tree)
    fs.symlinkSync("../../docs/a.md", path.join(dir, ".kiro/steering/link.md"));
    const linked = commit("a steering file that is a link to docs/a.md");
    r = check({ COPIES_BASE: linked });
    ok(r.status === 0 && !/link\.md/.test(r.out), "a tool's file that is a link inside the project is read once, as the file it leads to, at the base and in the work tree: no copy of it", r.out);
    r = check({ COPIES_BASE: base });
    ok(r.status === 0 && !/link\.md/.test(r.out), "and so against a base that did not hold it", r.out);
    // (a link to a folder in a tool's folder is no file of it; a link through a linked folder is read through both)
    fs.symlinkSync("../../docs", path.join(dir, ".kiro/steering/docs"));
    fs.symlinkSync("docs", path.join(dir, "docsl"));
    put("docs/b.md", `# More\n\n${SAID}.\n`);
    fs.symlinkSync("../../docsl/b.md", path.join(dir, ".kiro/steering/through.md"));
    const through = commit("a link to a folder, and one through a linked folder");
    r = check({ COPIES_BASE: through });
    ok(r.status === 0 && !/EISDIR/.test(r.out) && /not yet in the baseline: .*through\.md.*the pull request's base held it/.test(r.out), "a link to a folder in a tool's folder is passed over, and a file reached through a linked folder is read through it at the base too", r.out);
    // (of the code and prose a config names, a tracked link that leads out of the project, to a device, to a folder or
    // nowhere, and a file past the bound, are unread and counted; a link inside the project is read once)
    const away0 = scratchDir("copies-tools-out-");
    try {
      const words = "each of these words stands in a file that lies outside the project and is never read here";
      fs.writeFileSync(path.join(away0, "out.md"), `${words}.\n${words}.\n`);
      put("src/a.js", Array.from({ length: 12 }, (_, i) => `export const value${i} = "${Array.from({ length: 24 }, (_, k) => `w${i}x${k}`).join(" ")}";`).join("\n"));
      put("notes/a.md", `# Notes\n\n${OTHER}.\n`);
      for (const [to, f] of [["/dev/zero", "src/zero.js"], ["/proc/self/fd/1", "src/out.js"], ["../notes", "src/dir"], ["gone.js", "src/gone.js"], [path.join(away0, "out.md"), "notes/out.md"], ["a.md", "notes/link.md"], ["../src/a.js", "notes/code.md"]]) fs.symlinkSync(to, path.join(dir, f));
      fs.symlinkSync("a.js", path.join(dir, "src/b.js"));
      put("notes/big.md", `${OTHER}.\n`.repeat(100000));
      put("checks/odd.json", `${JSON.stringify({ baseline: "checks/odd-baseline.json", code: ["src"], prose: ["notes"], proseFromSecurity: false })}\n`);
      put("checks/odd-baseline.json", `${JSON.stringify({ windows: {}, values: {} })}\n`);
      g("add", "-A");
      const odd = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/odd.json"], { cwd: dir, encoding: "utf8", timeout: 60000, env: { ...process.env, COPIES_BASE: "" } });
      const said = `${odd.stdout}${odd.stderr}`;
      ok(odd.status === 0 && /^note 6 of the files the config names are not read: /mu.test(said) && !said.includes("outside the project") && !/new copy/u.test(said),
        "a tracked link that leads out of the project, to a device, a folder or nowhere, and a file past the bound are unread and counted, and a link inside the project is read once, as the file it leads to", said);
    } finally { fs.rmSync(away0, { recursive: true, force: true }); }
  }
  // (with the core's packages not installed, its shape is left unchecked, said as a warning, and a config the check
  // cannot read still fails with its mend: Codex's and the fallback reviewer's reviews of 95abcdb)
  {
    const packages = path.join(dir, "core/.packages/node_modules"), aside = `${packages}-aside`;
    fs.renameSync(packages, aside);
    try {
      const unchecked = text => { put("checks/raw.json", text); const c = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/raw.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "" } }); return { status: c.status, out: `${c.stdout}${c.stderr}` }; };
      const bad = ["null", "[]", '{"code":["docs"]}', '{"baseline":5}'].map(unchecked), odd = unchecked('{"baseline":"checks/raw-baseline.json","code":[{"toString":1},5,""],"prose":"docs","proseFromSecurity":"no"}');
      ok(bad.every(r => r.status === 1 && mended(r.out) && /^FAIL: the config is not a JSON object that names its "baseline"\./m.test(r.out) && /::warning::The config's shape was not checked/.test(r.out) && !/TypeError/.test(r.out)),
        "with the packages not installed, a config that is no object, or names no baseline, fails with its mend, the shape's warning said", bad.map(r => r.out).join("\n"));
      ok(!/TypeError|at file:/.test(odd.out) && /::warning::The config's shape was not checked/.test(odd.out) && !/AGENTS\.md/.test(odd.out), "and lists of the wrong shape are read as no paths, and a proseFromSecurity that is not true reads no rule file, never crashing", odd.out);
    } finally { fs.renameSync(aside, packages); }
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
process.exit(failed ? 1 : 0);
