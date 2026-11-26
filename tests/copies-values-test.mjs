// Checks the copies check's part for a value written out in two files (scripts/copies-values.mjs, run by
// scripts/copies.mjs; #1139): what a pin and a pattern are, and, in a small project made for it, that a value a pull
// request writes into a second file of the project's own fails saying its mend, while one the base held, one moved,
// one a sync adds to the core's files, one the config says, and those of the files left out are not failed. On Linux
// and on Windows. Git and Node's own modules only.
//
//   node tests/copies-values-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { pinsIn, patternsIn, widens } from "../scripts/copies-values.mjs";
import { MARK } from "../scripts/core-owned.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${detail.replaceAll("\n", "\n     ")}`); } };

// ---- what a value is ----
// (made-up hashes, built when the test runs: no pin of anything real)
const hex = (seed, n) => Array.from({ length: n }, (_, i) => "0123456789abcdef"[(seed * 7 + i * 5) % 16]).join("");
const SHA = hex(1, 40), DIGEST = hex(2, 64), OTHER = hex(3, 40);
const pins = text => [...pinsIn(text).keys()];
ok(pins(`a ${SHA} b\nsum=${DIGEST}`).join() === [SHA, DIGEST].join(), "a commit hash and a SHA-256 standing alone are pins");
ok(pins(`x ${SHA.toUpperCase()}`).join() === SHA, "a pin is read in lower case, so one written in capitals is the same value");
ok(!pins(`${SHA}a`).length && !pins(`${DIGEST}${DIGEST}`).length && !pins(`id_${SHA}`).length && !pins(hex(4, 50)).length,
  "a run of another length, or one joined to a letter, a digit or _, is no pin");
ok(!pins("1".repeat(40)).length, "a run of digits alone is a number, no pin");
ok(!pins(`      - uses: actions/checkout@${SHA} # v7\n  uses: "o/r/.github/workflows/x.yml@${OTHER}"\n- uses: docker://alpine@sha256:${DIGEST}`).length,
  "a pin after `uses: <action>@`, which the host asks of each workflow, is not read");
ok(pins(`run: echo ${SHA}\n  ref: ${OTHER}`).length === 2, "a pin anywhere else in a workflow is read");

ok(widens("/^\\.github\\/workflows\\/[^/]+\\.ya?ml$/u") && widens("/a\\d{2}b/") && widens("/(one|two) words here/"), "a pattern with a class, a quantifier, a class escape or an alternation matches more than one text");
ok(!widens("/^was not read, so taken as billed\\.$/u") && !widens("/holds no `checks\\/shape\\.json`/u"), "one of plain text, escapes and anchors alone matches one text: wording, not read");
const LONG = "/^(?:node_modules\\/)+[\\w.-]+\\/package\\.json$/u";
const patterns = (text, file = "a.mjs") => [...patternsIn(text, file).keys()];
ok(patterns(`const a = ${LONG};\nconst b = /[a-z]+/u;\nconst s = "${LONG.replaceAll("\\", "\\\\")}";\n// ${LONG}\n`).join() === LONG,
  "a regular expression literal of 30 characters or more is a pattern; a shorter one, and the same text in a string or a comment, are not");
ok(patterns(`const x = <div>{1}</div>;\nconst r = ${LONG};\n`, "a.jsx").join() === LONG, "a file of JSX is read with its elements");

// ---- the check, in a project ----
const here = fileURLToPath(new URL("../scripts/", import.meta.url));
const dir = scratchDir("copies-values-test-");

// (a sync never fails here, so no file the kit writes that carries no mark of the core's may hold a pin: only the
// workflows, whose mark tells the core's from the project's, may)
const kit = fileURLToPath(new URL("../setup/template/", import.meta.url));
// (its placeholders rendered, the core's pin as a commit hash; the manifest alone names the pin, as the project's own)
const unmarked = fs.readdirSync(kit, { recursive: true }).filter(f => !/workflows|\.yml(\.tmpl)?$/u.test(f) && f !== "core-manifest.md.tmpl" && fs.statSync(path.join(kit, f)).isFile());
const rendered = f => fs.readFileSync(path.join(kit, f), "utf8").replaceAll("{{pin}}", SHA);
ok(unmarked.length > 0 && unmarked.every(f => !pins(rendered(f)).length), "no file the starter kit writes with no mark of the core's holds a pin, its placeholders rendered", unmarked.filter(f => pins(rendered(f)).length).join(", "));
try {
  const put = (f, body) => { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); };
  const drop = f => fs.rmSync(path.join(dir, f), { force: true });
  const g = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const commit = what => { g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", what); return g("rev-parse", "HEAD").trim(); };
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["copies.mjs", "copies-values.mjs", "code-shape-lexer.mjs", "whole-output.mjs", "blobs.mjs", "guards.mjs", "rule-files.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "yaml-keys.mjs", "packages.mjs", "schemas.mjs", "core-owned.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "core/scripts", f));
  fs.cpSync(path.join(here, "schemas"), path.join(dir, "core/scripts/schemas"), { recursive: true });
  fs.cpSync(path.join(here, "..", ".packages"), path.join(dir, "core/.packages"), { recursive: true, filter: parserLeftOut });
  fs.copyFileSync(path.join(here, "..", ".gitignore"), path.join(dir, "core/.gitignore"));
  const config = more => put("checks/copies.json", `${JSON.stringify({ baseline: "checks/copies-baseline.json", code: ["src/*.mjs", "core/scripts/*.mjs"], prose: [], tests: ["test/"], ...more })}\n`);
  config({});
  put("checks/copies-baseline.json", '{ "windows": {} }\n');
  // (the base: a pin in two files of the project's own and in the core's copy, which stood before the check came)
  put("src/fetch.mjs", `export const SUM = "${DIGEST}";\nexport const NAME = ${LONG};\n`);
  put("deploy.sh", `sum=${DIGEST}\n`);
  put("core/setup/pins.txt", `${SHA}\n`);
  put("src/use.mjs", `export const REF = "${SHA}";\n`);
  g("init", "-q");
  const base = commit("base");
  // (what a pull request holds is committed, so each run reads its files as git tracks them: staged here)
  const check = (env = {}) => {
    g("add", "-A");
    const r = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "", ...env } });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const STOOD = /^note 2 values stand in two files or more, as the pull request's base held them: each a debt to work down, failing nothing/m;
  let r = check();
  ok(r.status === 0 && /^note 2 values stand in two files or more, with no base to read against/m.test(r.out) && r.out.includes(`${DIGEST.slice(0, 12)}...: deploy.sh:1 and src/fetch.mjs:1`) && !r.out.includes(DIGEST)
    && /^ok {3}no value newly written twice/m.test(r.out), "with no base, each value written twice is noted, by file and line, and none fails", r.out);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && STOOD.test(r.out) && /^ok {3}no new copies/m.test(r.out), "what the pull request's base held is noted, and fails nothing", r.out);

  // (a pin written into one more file of the project's own fails, naming a file that held it, then its mend)
  put("ci/fetch.ps1", `$sum = "${DIGEST.toUpperCase()}"\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && mended(r.out) && /^FAIL: a value written twice: [0-9a-f]{12}\.\.\. stands in ci\/fetch\.ps1:1 and deploy\.sh:1 and src\/fetch\.mjs:1\. Mend: read the value from (deploy\.sh|src\/fetch\.mjs) \(import it, or read the file\), or say in checks\/copies\.json's "twice" why both must hold it$/m.test(r.out),
    "a pin the base held in two files, written into a third, fails with its mend, whatever its case", r.out);
  r = check();
  ok(r.status === 0, "with no base the same is only noted", r.out);
  drop("ci/fetch.ps1");
  put("src/again.mjs", `const ref = "${OTHER}";\n`);
  put("src/more.mjs", `const ref = "${OTHER}";\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && r.out.includes(`FAIL: a value written twice: ${OTHER.slice(0, 12)}... stands in src/again.mjs:1 and src/more.mjs:1`), "a new pin written into two files at once fails", r.out);
  drop("src/again.mjs"); drop("src/more.mjs");

  // (a pattern, the same)
  put("src/other.mjs", `const LEAD = 1;\nexport const PACKAGE = ${LONG};\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && mended(r.out) && r.out.includes(`FAIL: a value written twice: ${LONG} stands in src/fetch.mjs:2 and src/other.mjs:2. Mend: read the value from src/fetch.mjs`),
    "a pattern of a script written into another fails, naming the first, with its mend", r.out);
  drop("src/other.mjs");

  // (a pattern that holds an address's sign-in, made up and built from pieces, its "@" past where the value is cut short)
  const user = ["made", "up"].join("-"), pass = ["not", "a", "pass"].join("_"), padded = "a".repeat(80);
  const SIGNED = `/^https:\\/\\/${user}:${pass}${padded}@example\\.invalid\\/[a-z]+$/u`;
  put("src/signed.mjs", `export const A = ${SIGNED};\n`); put("src/signed-too.mjs", `export const B = ${SIGNED};\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && r.out.includes("FAIL: a value written twice: /^https:\\/\\/example\\.invalid") && !r.out.includes(user) && !r.out.includes(pass),
    "a value written twice is printed with its address's sign-in cut out before it is cut short", r.out.replaceAll(user, "<user>").replaceAll(pass, "<pass>"));
  drop("src/signed.mjs"); drop("src/signed-too.mjs");

  // (a value moved, from one file to another, passes: the places do not grow)
  fs.renameSync(path.join(dir, "deploy.sh"), path.join(dir, "release.sh"));
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && STOOD.test(r.out), "a value moved to another file passes", r.out);
  fs.renameSync(path.join(dir, "release.sh"), path.join(dir, "deploy.sh"));

  // (a sync: the core's copy, and a workflow the core writes whole with its mark, gain the value; none fails)
  put("core/setup/more-pins.txt", `${SHA}\n${DIGEST}\n`);
  put(".github/workflows/core.yml", `${MARK}\nname: core\njobs: {}\n# ${DIGEST}\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0, "a value the core's copy or a workflow the core writes whole gains fails nothing: a sync changes those alone", r.out);
  put(".github/workflows/own.yml", `name: own\njobs:\n  a:\n    steps:\n      - run: echo ${DIGEST}\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && /^FAIL: a value written twice: [0-9a-f]{12}\.\.\. stands in /m.test(r.out) && r.out.includes(".github/workflows/own.yml:5"), "one a workflow of the project's own gains fails", r.out);
  drop(".github/workflows/own.yml"); drop(".github/workflows/core.yml"); drop("core/setup/more-pins.txt");
  // (a file of a kind the kit writes whole but that carries no mark, the project's own settings, is read as the project's)
  put(".claude/settings.json", `{ "env": { "SUM": "${DIGEST}" } }\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && r.out.includes(".claude/settings.json:1"), "one the project's own settings gain fails: a file of a kind with no mark is the project's", r.out);
  drop(".claude/settings.json");

  // (what is not read: the tests the config lists, lock files, the dated records)
  put("test/fetch.test.mjs", `const SUM = "${DIGEST}";\nconst NAME = ${LONG};\n`);
  put("web/package-lock.json", `{ "integrity": "${DIGEST}" }\n`);
  put("archive/old.md", `${DIGEST}\n`);
  put("core/reports/old.md", `${DIGEST}\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && STOOD.test(r.out), "a value in the tests the config lists, a lock file or a dated record is not read", r.out);
  drop("test/fetch.test.mjs"); drop("web/package-lock.json"); drop("archive/old.md"); drop("core/reports/old.md");

  // (git's pathspec magic is kept: a glob in "code" is read, and one in "tests" left out)
  config({ code: [":(glob)src/*.mjs", "core/scripts/*.mjs"], tests: [":(glob)test/*.mjs"] });
  put("test/fetch.test.mjs", `const SUM = "${DIGEST}";\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && STOOD.test(r.out), "a test a glob of \"tests\" names is not read", r.out);
  drop("test/fetch.test.mjs");
  put("src/other.mjs", `export const PACKAGE = ${LONG};\n`);
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && r.out.includes(`${LONG} stands in src/fetch.mjs:2 and src/other.mjs:1`), "a pattern copied into a script a glob of \"code\" names fails", r.out);
  drop("src/other.mjs");
  config({});

  // (a value the config says is taken as said; one said that no longer stands twice is noted, to take out)
  put("ci/fetch.ps1", `$sum = "${DIGEST}"\n`);
  config({ twice: { [DIGEST.toUpperCase()]: "the deploy script and the CI's fetch run on machines that share no file" } });
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && /^ok {3}no value newly written twice \(a pin or a pattern; 1 said in checks\/copies\.json's "twice"\)$/m.test(r.out), "a value the config's \"twice\" says why both must hold is taken as said", r.out);
  drop("ci/fetch.ps1");
  put("deploy.sh", "sum=read-it\n");
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && r.out.includes(`note checks/copies.json's "twice" names ${DIGEST.slice(0, 12)}..., which no longer stands in two files`), "the config's own \"twice\" is no place of the value: one said, left in one file, is noted to take out", r.out);
  put("deploy.sh", `sum=${DIGEST}\n`);
  config({ twice: { [OTHER]: "said long ago" } });
  r = check({ COPIES_BASE: base });
  ok(r.status === 0 && r.out.includes(`note checks/copies.json's "twice" names ${OTHER.slice(0, 12)}..., which no longer stands in two files: take it out of "twice"`), "a value said that no longer stands twice is noted, failing nothing", r.out);
  // (a config git does not list yet, named by another spelling of the project's folder than git's root, as Windows' short
  // names are of its long ones (RUNNER~1): its own exclusion still points inside the project, not above it; #1224)
  const spelled = path.join(path.dirname(dir), `${path.basename(dir)}-link`);
  try {
    fs.symlinkSync(dir, spelled, process.platform === "win32" ? "junction" : "dir");
    g("rm", "-q", "--cached", "checks/copies.json");
    const s = spawnSync(process.execPath, ["core/scripts/copies.mjs", path.join(spelled, "checks/copies.json")], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: base } });
    ok(s.status === 0 && !/outside repository|could not read the values/.test(`${s.stdout}${s.stderr}`), "a config git does not list, named through another spelling of the project's folder, is excluded from the values by its path inside the project", `${s.stdout}${s.stderr}`);
    g("add", "-A");
  } catch (e) {
    ok(false, "a config named through another spelling of the project's folder could be tried", String(e.message));
  } finally { fs.rmSync(spelled, { recursive: true, force: true }); }
  // (a pathspec git cannot read fails with its mend, never a stack)
  config({ tests: [":(bogus)test/"] });
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && mended(r.out) && /^FAIL: git could not read the values checks\/copies\.json names: /m.test(r.out) && !/\n {4}at /u.test(r.out), "a pathspec git cannot read fails with its mend", r.out);
  config({ twice: { [OTHER]: "" } });
  r = check({ COPIES_BASE: base });
  ok(r.status === 1 && mended(r.out) && /"twice"/.test(r.out), "a reason left empty fails the config's shape, with its mend", r.out);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
