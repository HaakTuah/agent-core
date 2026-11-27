// The copies check's list of values written twice (#1139): the baseline's "values", which --first writes and --write
// lowers, each value two files of the project's own hold by its key to how many hold it, and the check against it, with a
// base and without, in a scratch project that copies the core's scripts the check runs. The values themselves, and the
// check before a list stands: copies-values-test.mjs. Node's own modules and git.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { keyOf } from "../scripts/copies-values.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${detail.replaceAll("\n", "\n     ")}`); } };
// (made-up values of each form: no real pin)
const made = (seed, n) => Array.from({ length: n }, (_, i) => "0123456789abcdef"[(seed * 7 + i * 5) % 16]).join("");
const [SHA, DIGEST, OTHER] = [made(1, 40), made(2, 64), made(3, 40)];
const SCRIPTS = ["copies.mjs", "copies-values.mjs", "code-shape-lexer.mjs", "whole-output.mjs", "blobs.mjs", "guards.mjs", "rule-files.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "mend.mjs", "yaml-keys.mjs", "packages.mjs", "schemas.mjs", "core-owned.mjs"];
const core = fileURLToPath(new URL("../", import.meta.url));
const dir = scratchDir("copies-values-list-test-");
const BASELINE = "checks/copies-baseline.json";

try {
  const put = (f, body) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); };
  const drop = f => fs.rmSync(path.join(dir, f), { force: true });
  const g = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const commit = what => { g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", what); return g("rev-parse", "HEAD").trim(); };
  // (the project: the core's copy of the scripts the check runs, and a pin in two files of the project's own, one in a
  // file of its own beside the core's copy)
  for (const f of SCRIPTS) put(`core/scripts/${f}`, fs.readFileSync(path.join(core, "scripts", f)));
  for (const [from, to, filter] of [["scripts/schemas", "core/scripts/schemas"], [".packages", "core/.packages", parserLeftOut], [".gitignore", "core/.gitignore"]]) fs.cpSync(path.join(core, from), path.join(dir, to), { recursive: true, filter });
  put("checks/copies.json", `${JSON.stringify({ baseline: BASELINE, code: ["src/*.mjs", "core/scripts/*.mjs"], prose: [], tests: ["test/"] })}\n`);
  put(BASELINE, '{ "windows": {} }\n');
  put("src/fetch.mjs", `export const SUM = "${DIGEST}";\n`);
  put("deploy.sh", `sum=${DIGEST}\n`);
  put("core/setup/pins.txt", `${SHA}\n`);
  put("src/use.mjs", `export const REF = "${SHA}";\n`);
  g("init", "-q");
  const run = (flag, env = {}) => {
    g("add", "-A");
    const s = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", ...(flag ? [flag] : [])], { cwd: dir, encoding: "utf8", env: { ...process.env, COPIES_BASE: "", ...env } });
    return { status: s.status, out: `${s.stdout}${s.stderr}` };
  };
  const baselineNow = () => JSON.parse(fs.readFileSync(path.join(dir, BASELINE), "utf8"));
  let r;
  const before = commit("before the list");
  r = run("--first");
  const list = baselineNow().values ?? {};
  ok(r.status === 0 && JSON.stringify(list) === JSON.stringify({ [keyOf(DIGEST)]: 2 }) && !fs.readFileSync(path.join(dir, BASELINE), "utf8").includes(DIGEST.slice(0, 16)),
    "--first, where the baseline holds no list, writes each value two files of the project's own hold, by a key that holds no pin whole, to how many such files hold it; one held once beside the core's is not listed", `${r.out}\n${JSON.stringify(baselineNow())}`);
  r = run("--first");
  ok(r.status === 1 && mended(r.out) && /lists its "values"/.test(r.out), "--first again fails, with its mend: the list is written once", r.out);
  r = run();
  ok(r.status === 0 && r.out.includes(`note 2 values stand in two files or more, as ${BASELINE} lists them`) && r.out.includes(`${SHA.slice(0, 12)}...: core/setup/pins.txt:1 and src/use.mjs:1`), "with the list and no base, what it lists, and a value held once beside the core's, is noted and fails nothing", r.out);
  r = run("", { COPIES_BASE: before });
  ok(r.status === 0, "the first list, against a base that held none, passes where it takes in only what the base held", r.out);
  put("ci/fetch.ps1", `$sum = "${DIGEST}"\n`);
  r = run("", { COPIES_BASE: before });
  ok(r.status === 1 && mended(r.out) && /^FAIL: a value written twice: [0-9a-f]{12}\.\.\. stands in ci\/fetch\.ps1:1 and /m.test(r.out), "a value written into one more file than the list says fails, with its mend", r.out);
  r = run();
  ok(r.status === 1 && mended(r.out), "and fails with no base too: the list, not the base, is the baseline", r.out);
  drop("ci/fetch.ps1");
  // (a first list that takes in a value the change itself wrote still fails, held to the base)
  put("src/again.mjs", `const ref = "${OTHER}";\n`); put("src/more.mjs", `const ref = "${OTHER}";\n`);
  fs.writeFileSync(path.join(dir, BASELINE), `${JSON.stringify({ ...baselineNow(), values: { ...list, [keyOf(OTHER)]: 2 } })}\n`);
  r = run("", { COPIES_BASE: before });
  ok(r.status === 1 && r.out.includes(`FAIL: a value written twice: ${OTHER.slice(0, 12)}... stands in src/again.mjs:1 and src/more.mjs:1`), "a first list that takes in a value its own change wrote twice fails all the same", r.out);
  const listedAt = commit("the list, with a value added");
  // (against a base that holds the list, an entry added or raised fails, with its mend)
  r = run("", { COPIES_BASE: listedAt });
  ok(r.status === 0, "a list as its base held it passes", r.out);
  drop("src/again.mjs"); drop("src/more.mjs");
  fs.writeFileSync(path.join(dir, BASELINE), `${JSON.stringify({ ...baselineNow(), values: list })}\n`);
  const lowered = commit("the list lowered");
  put("src/again.mjs", `const ref = "${OTHER}";\n`); put("src/more.mjs", `const ref = "${OTHER}";\n`);
  fs.writeFileSync(path.join(dir, BASELINE), `${JSON.stringify({ ...baselineNow(), values: { ...list, [keyOf(OTHER)]: 2, [keyOf(DIGEST)]: 3 } })}\n`);
  r = run("", { COPIES_BASE: lowered });
  ok(r.status === 1 && mended(r.out) && new RegExp(`^FAIL: ${BASELINE}'s "values" adds or raises 2 values against ${lowered}, and the list only shrinks\\. Mend: take it back as `, "m").test(r.out),
    "an entry the change adds to the list, or raises, against the base's list fails, with its mend", r.out);
  drop("src/again.mjs"); drop("src/more.mjs");
  fs.writeFileSync(path.join(dir, BASELINE), `${JSON.stringify({ ...baselineNow(), values: list })}\n`);
  // (a value read from one file now: the list fails until --write lowers it, and --write never adds one)
  put("deploy.sh", "sum=read-it\n");
  r = run("", { COPIES_BASE: lowered });
  ok(r.status === 1 && mended(r.out) && r.out.includes(`FAIL: ${BASELINE}'s "values" lists 1 value gone or in fewer files now. Mend: run node core/scripts/copies.mjs checks/copies.json --write`), "an entry whose value stands in fewer files fails, with the mend that lowers it", r.out);
  put("src/again.mjs", `const ref = "${OTHER}";\n`); put("src/more.mjs", `const ref = "${OTHER}";\n`);
  put("ci/fetch.ps1", `$sum = "${DIGEST}"\n`); put("ci/fetch-too.ps1", `$sum = "${DIGEST}"\n`);
  r = run("--write");
  ok(JSON.stringify(baselineNow().values) === JSON.stringify({ [keyOf(DIGEST)]: 2 }), "--write lowers an entry no further than what stands, and adds no value", JSON.stringify(baselineNow().values));
  drop("ci/fetch.ps1"); drop("ci/fetch-too.ps1");
  r = run("--write");
  ok(JSON.stringify(baselineNow().values) === JSON.stringify({}), "--write drops an entry whose value one file holds now", JSON.stringify(baselineNow().values));
  drop("src/again.mjs"); drop("src/more.mjs");
  r = run("", { COPIES_BASE: lowered });
  ok(r.status === 0, "the lowered list passes", r.out);
  // (a sync gains the value in the core's files alone: it fails nothing, with a base or without)
  put("core/setup/more-pins.txt", `${SHA}\n${DIGEST}\n`);
  r = run("", { COPIES_BASE: lowered });
  const synced = run();
  ok(r.status === 0 && synced.status === 0, "with the list, a value the core's copy gains beside one file of the project's own fails nothing", `${r.out}\n${synced.out}`);
  put("src/use-too.mjs", `export const REF = "${DIGEST}";\n`);
  r = run("", { COPIES_BASE: lowered });
  ok(r.status === 1 && mended(r.out) && r.out.includes("src/use-too.mjs:1"), "and one the change writes into a file of the project's own beside the core's, read against the base, fails", r.out);
  drop("src/use-too.mjs"); drop("core/setup/more-pins.txt");
  fs.writeFileSync(path.join(dir, BASELINE), `${JSON.stringify({ ...baselineNow(), values: { [keyOf(SHA)]: 0 } })}\n`);
  r = run();
  ok(r.status === 1 && mended(r.out) && /"values" is no object of keys/.test(r.out), "a list in no form it reads fails, with its mend", r.out);
  // (no baseline yet: --first writes the copies and the list together)
  drop(BASELINE); put("deploy.sh", `sum=${DIGEST}\n`);
  r = run("--first");
  ok(r.status === 0 && "windows" in baselineNow() && JSON.stringify(baselineNow().values) === JSON.stringify({ [keyOf(DIGEST)]: 2 }), "--first, with no baseline, writes the copies and the list of values in one", `${r.out}\n${JSON.stringify(baselineNow())}`);
  // (the manifest's pin of the core, which each sync moves, is not counted: a sync that moves it beside the same pin in
  // a file of the project's own fails nothing)
  drop(BASELINE); put("core-manifest.md", `Core: X at ${OTHER}, copied whole under core/.\n`); put("docs/notes.md", `We took the core at ${OTHER}.\n`);
  r = run("--first");
  ok(r.status === 0 && JSON.stringify(baselineNow().values) === JSON.stringify({ [keyOf(DIGEST)]: 2 }), "--first lists no pin the manifest's \"Core:\" line holds beside one file of the project's own", `${r.out}\n${JSON.stringify(baselineNow())}`);
  const pinned = commit("the list, beside the manifest's pin");
  put("core-manifest.md", `Core: X at ${SHA}, copied whole under core/.\n`); put("core/setup/new.txt", "x\n");
  r = run("", { COPIES_BASE: pinned });
  ok(r.status === 0, "a sync that moves the manifest's pin passes against a base with the list", r.out);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
