// The tests a pull request runs (tasks/tests.md, "A pull request runs the tests its change can reach"; #275), for
// every project that takes the core: what select-reach.mjs, beside this file, selects of the files the pull request
// changes against its base, said on the job's summary too. This is the command: it reads the base, the config and the
// tests that failed last time, asks for the selection, and writes what it chose; where the shape check's config cannot be
// read, no base is told (on main, on a schedule, before a release) or the files the change holds, or the project's files
// all together, are more than the readers take in time (hurry.mjs), the whole suite runs.
//
// A tree that passed is not run again (tasks/tests.md; #457): on a push, given --passed and the name of the check that
// gates the tests, where HEAD merges a pull request's head whose tree it holds (the head was up to date), the change it
// brings selects the whole suite, as that pull request's run selected it, and the check passed on that head, nothing is
// selected (select-passed.mjs). Where any of that cannot be told (no merge of two, a tree that differs, a selection, no
// answer from the host, a check not passed), the whole suite runs. The check's runs are asked of GitHub (GITHUB_API_URL,
// the repository GITHUB_REPOSITORY names), with the token GH_TOKEN holds, which needs to read checks and nothing more, and
// only those GitHub Actions posted count. That the head held the default branch is read from the tree, never assumed:
// floor rule 12 lets a pull request merge without being brought up to date where users get a release.
//
//   node core/scripts/select.mjs [<config>] [--failed <file>] [--env <NAME>] [--passed <check>]
//       with SELECT_BASE the pull request's base (origin/main, fetched; or HEAD^1 of the merge a pull request's run
//       checks out): prints what it selected and why; --failed names a file of the tests that failed last time, one
//       path a line; --env appends NAME=" <test> <test> " (or NAME=all) to the file GITHUB_ENV names, for the steps
//       that follow, or NAME=none where nothing is selected; --passed, on a push alone (no SELECT_BASE), names the check
//       whose pass on the merged head lets the run select nothing. Reads only, but for those two files and that one question to the host; git and Node's own
//       modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreItself } from "./core-path.mjs";
import { asText, loggedAlone } from "./guards.mjs";
import { Late, hurry } from "./hurry.mjs";
import { notLinked, parseConfig, standing, survey, where } from "./shape.mjs";
import { selection } from "./select-reach.mjs";
import { copyOf, pinsOnly } from "./select-copy.mjs";
import { git, passedWhole } from "./select-passed.mjs";
import { started } from "./started.mjs";

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
const PLAIN = /^[\w@+.,=-][\w@+./,=-]*$/u;


const pick = ({ reach, scripts, unsure }) => ({ reach, scripts, unsure });
// The conftest.py files git holds that the config's pathspecs leave out: pytest runs them all the same.
const unreadConftests = texts => git(["ls-files", "-z", "--", ":(glob)**/conftest.py"]).split("\0").filter(f => f && !(f in texts));

// A file's text at the base, or null where it was not there.
function textAt(base, file) {
  try { return git(["show", `${base}:${file}`]); } catch { return null; }
}

// The paths a pull request changes against its base, renames as a path gone and a path added.
const changedSince = base => git(["diff", "-z", "--name-only", "--no-renames", base, "HEAD"]).split("\0").filter(Boolean);

function readFailed(file) {
  if (!file) return [];
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : refuse(`there is no file at ${file}`, "name with --failed a file of the tests that failed last time, one path a line, or leave --failed out");
  return text.split(/\r?\n/u).map(l => l.trim()).filter(Boolean);
}

function said(s, total) {
  if (s.all) return [`The selection: the whole suite, ${total} tests: ${s.why}.`];
  if (s.none) return [`The selection: none of ${total} tests: ${s.why}.`];
  const lines = [`The selection: ${s.tests.length} of ${total} tests, those the change can reach.`];
  for (const t of s.tests) lines.push(`  ${t}: ${s.why.get(t)}`);
  return lines;
}

// The words after the config: { "--failed", "--env", "--passed" }, each where given.
function options(rest, self) {
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!["--failed", "--env", "--passed"].includes(rest[i]) || rest[i + 1] === undefined) refuse(`the selection does not know ${rest.slice(i).join(" ")}`, `run node ${self} [<config>] [--failed <file>] [--env <NAME>] [--passed <check>]`);
    opts[rest[i]] = rest[i + 1];
  }
  if (opts["--env"] !== undefined && !/^[A-Z_][A-Z0-9_]*$/u.test(opts["--env"])) refuse(`--env ${JSON.stringify(opts["--env"]).slice(0, 40)} is no name of a variable`, "name it in capitals, digits and _, as RUN");
  if (opts["--env"] !== undefined && !process.env.GITHUB_ENV) refuse("--env was given and GITHUB_ENV names no file", "run it as a step of a workflow, or leave --env out");
  if (opts["--passed"] !== undefined && !/^[\w .()/-]{1,100}$/u.test(opts["--passed"])) refuse(`--passed ${JSON.stringify(opts["--passed"]).slice(0, 40)} is no name of a check`, "name the check that gates the tests on a pull request, as its job is named, such as tests");
  return opts;
}

// The base SELECT_BASE names, checked to be a commit here; "" where none is told.
function baseOf() {
  const base = process.env.SELECT_BASE || "";
  let known = true;
  if (base) try { git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]); } catch { known = false; }
  if (base && (!/^\w[\w./^~-]*$/u.test(base) || !known)) refuse(`SELECT_BASE (${JSON.stringify(base).slice(0, 80)}) is no commit here`, "set it to the pull request's base, such as origin/main fetched first, or HEAD^1 of the merge a pull request's run checks out with two commits of history");
  return base;
}

// The shape check's config, or null where it is not there or cannot be read (the whole suite then runs).
function configOf(at) {
  try { return fs.existsSync(notLinked(at)) ? parseConfig(fs.readFileSync(at, "utf8"), at) : null; } catch { return null; }
}

// What the change from `from` selects, or the whole suite where the files it changes, or the project's files all
// together, are too many or too slow to read within the time rule 5 of SECURITY.md allows (hurry.mjs; #881, #962).
function selectedFrom(from, { now, config, failed }) {
  const changed = changedSince(from), watch = hurry({ files: new Set(changed) });
  try { return selection({ changed, texts: now.texts, tests: now.tests, ...pick(survey(now.texts, config, now.tests, watch)), unread: unreadConftests(now.texts), failed, config, watch, before: f => textAt(from, f), copy: copyOf(), pinned: pinsOnly(from, changed) }); }
  catch (e) { if (e instanceof Late) return { all: true, why: e.message, tests: [...now.tests].sort() }; throw e; }
}

// What a run takes, { all, why, tests }: the whole suite where the config cannot be read or no base is told, what the
// change from the base selects, or, on a push given --passed (`passed`), nothing where the merged tree passed whole.
async function chosen({ config, at, base, passed, select }) {
  if (passed !== undefined && base) refuse("--passed was given with SELECT_BASE: a pull request's run is never skipped", "give --passed only on a push to the default branch, with SELECT_BASE empty");
  if (!config) return { all: true, why: `the shape check's config (${at}) cannot be read, so what each test reaches cannot be told` };
  if (base) return select(base);
  if (passed === undefined) return { all: true, why: "no base is told (SELECT_BASE), as on main, on a schedule and before a release" };
  const s = await passedWhole({ check: passed, selects: () => select("HEAD^1") });
  return s.none ? { ...s, all: false, tests: [] } : s;
}

async function main(argv) {
  const self = path.relative(process.cwd(), fileURLToPath(import.meta.url)).replace(/\\/gu, "/");
  const named = argv[0] && !argv[0].startsWith("--") ? argv[0] : null, opts = options(named ? argv.slice(1) : argv, self);
  // (the core's own repository reads its slots from AGENTS.md, whatever manifest stands at its root: core-path.mjs)
  const rules = (coreItself(".") ? ["AGENTS.md"] : ["core-manifest.md", "AGENTS.md"]).find(f => fs.existsSync(f));
  const at = named ?? where(rules ? fs.readFileSync(rules, "utf8") : ""), base = baseOf(), config = configOf(at);
  const now = config ? standing(config) : null, failed = readFailed(opts["--failed"]);
  const s = await chosen({ config, at, base, passed: opts["--passed"], select: from => selectedFrom(from, { now, config, failed }) });
  // (a name the variable cannot hold as one word, a space or a line's end in it, runs the whole suite: no file's name
  // sets another variable for later steps)
  if (!s.all && s.tests.some(t => !PLAIN.test(t))) Object.assign(s, { all: true, why: "a test's file name holds what a list of names cannot (a space or a line's end)" });
  const lines = said(s, now ? now.tests.size : "all its");
  console.log(lines.map(asText).join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  // (nothing selected is "none", as everything is "all": a runner given an empty list would run every test)
  if (opts["--env"]) fs.appendFileSync(process.env.GITHUB_ENV, `${opts["--env"]}=${s.all ? "all" : s.none ? "none" : ` ${s.tests.join(" ")} `}\n`);
  return 0;
}

if (started(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${loggedAlone(e.message)}`); process.exitCode = 1; }
}
