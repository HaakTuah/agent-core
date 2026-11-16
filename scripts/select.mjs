// The tests a pull request runs (modules/tests.md, "A pull request runs the tests its change can reach"; #275), for
// every project that takes the core: of the files the pull request changes against its base, each test that can reach
// one, with the tests it adds or changes, those that failed last time (`--failed`), and those the project names as its
// proof that behaviour was kept, which are never selected out. What it ran is said, on the job's summary too.
//
// A test reaches a file where the file lies on the test's imports, followed from file to file (the shape check's
// readers: shape.mjs, beside this file, dynamic imports among them), or where a file of JavaScript or TypeScript on that
// way names it, outside a comment, by its name ("scripts/build.mjs", as a script is started by its path). A test the
// config's "select.whole" names reaches every file (one that copies or runs the whole project). It never guesses: where
// a changed file is no code the readers read and no test, a file that is gone, or anything the config does not name
// under "select.none" (the files no test reads), the whole suite runs, and so it does where no base is told (on main, on
// a schedule, before a release) and where the shape check's config cannot be read. A fault the whole suite finds that
// the selection left out is a fault of this map, mended at once.
//
// The config is the shape check's (shape.mjs, where()): its "code", "tests", "aliases" and "select" ({ "proof",
// "whole", "none" }, each git pathspecs).
//
//   node core/scripts/select.mjs [<config>] [--failed <file>] [--env <NAME>]
//       with SELECT_BASE the pull request's base (origin/main, fetched; or HEAD^1 of the merge a pull request's run
//       checks out): prints what it selected and why; --failed names a file of the tests that failed last time, one
//       path a line; --env appends NAME=" <test> <test> " (or NAME=all) to the file GITHUB_ENV names, for the steps
//       that follow. Reads only, but for those two files; git and Node's own modules.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODE } from "./code-shape.mjs";
import { notLinked, parseConfig, standing, survey, where } from "./shape.mjs";
import { started } from "./started.mjs";

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
const git = args => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const PLAIN = /^[\w@+.,=-][\w@+./,=-]*$/u;
const escaped = s => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

// One part of a pathspec with wildcards, as a regular expression: "*" any run, "?" one character, "[...]" one of a
// set ("[!...]" one not in it), anything else itself.
const wild = p => (p === "*" ? ".*" : p === "?" ? "." : /^\[!?[^\]]+\]$/u.test(p) ? `[${p.startsWith("[!") ? "^" : ""}${p.slice(p.startsWith("[!") ? 2 : 1, -1).replace(/[\\\]^]/gu, "\\$&")}]` : escaped(p));

// Whether a path is one of git pathspecs': a plain one is the path or a folder above it, or, where it holds a
// wildcard, matches as git's default does ("*", "?" and "[...]", across folders too); one of ":(glob)" is a glob ("**" any
// folders, "*" within one); and ":!" or ":(exclude)" leaves out what it matches.
export function matcher(specs) {
  const one = spec => {
    const glob = spec.startsWith(":(glob)"), body = spec.replace(/^:\((glob|exclude)\)|^:!/u, "");
    if (!glob && /[*?[]/u.test(body)) { const re = new RegExp(`^${body.split(/(\*|\?|\[!?[^\]]+\])/u).map(wild).join("")}$`, "u"); return f => re.test(f); }
    if (!glob) { const plain = body.replace(/\/$/u, ""); return f => plain === "." || f === plain || f.startsWith(`${plain}/`); }
    const re = new RegExp(`^${body.split(/(\*\*\/|\*\*|\*)/u).map(p => (p === "**/" ? "(?:.*/)?" : p === "**" ? ".*" : p === "*" ? "[^/]*" : escaped(p))).join("")}$`, "u");
    return f => re.test(f);
  };
  const out = s => s.startsWith(":!") || s.startsWith(":(exclude)");
  const ins = specs.filter(s => !out(s)).map(one), outs = specs.filter(out).map(one);
  return f => ins.some(m => m(f)) && !outs.some(m => m(f));
}

// A file of JavaScript or TypeScript without its comments, as far as a line tells them: a line that opens with one, and
// one that ends a line after a space. What is left over names more, never less.
const uncommented = text => text.split("\n").filter(l => !/^\s*(\/\/|\/?\*)/u.test(l)).map(l => l.replace(/\s\/\/\s.*$/u, "")).join("\n");

// Each file's links to the others: its imports, and, from JavaScript or TypeScript, each file of code (no test) whose
// name it holds outside a comment.
export function links(texts, tests, reach) {
  const code = Object.keys(texts).filter(f => !tests.has(f));
  const named = code.map(f => [f, new RegExp(`(^|[^\\w-])${escaped(path.posix.basename(f))}(?![\\w-])`, "u")]);
  const out = new Map();
  for (const [file, text] of Object.entries(texts)) {
    const to = new Set(reach.get(file) ?? []);
    if (CODE.includes(path.posix.extname(file))) { const plain = uncommented(text); for (const [f, re] of named) if (f !== file && re.test(plain)) to.add(f); }
    out.set(file, to);
  }
  return out;
}

// The files each test reaches, the test itself among them.
export function reached(tests, linked) {
  const out = new Map();
  for (const t of tests) {
    const seen = new Set([t]), queue = [t];
    while (queue.length) for (const next of linked.get(queue.pop()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    out.set(t, seen);
  }
  return out;
}

// What a pull request runs: { all, why, tests }, `why` the reason for the whole suite, or for each test selected.
// `changed` the paths it changes (gone ones among them), `texts` and `tests` the project as the shape check reads it,
// `reach` its imports, `failed` the tests that failed last time, `config` the shape check's.
export function selection({ changed, texts, tests, reach, failed = [], config }) {
  const proof = matcher(config.select.proof), whole = matcher(config.select.whole), none = matcher(config.select.none), isTest = matcher(config.tests);
  const all = why => ({ all: true, why, tests: [...tests].sort() });
  const by = new Map(), add = (t, why) => { if (tests.has(t) && !by.has(t)) by.set(t, why); };
  const reaches = reached(tests, links(texts, tests, reach));
  for (const t of tests) if (proof(t)) add(t, "never selected out: the project's proof that behaviour was kept");
  for (const t of failed) add(t, "failed last time");
  for (const f of changed) {
    if (none(f)) continue;
    if (isTest(f) && tests.has(f)) add(f, "added or changed"); // (and, a helper among the tests, what imports it)
    if (isTest(f) && !(f in texts)) continue; // (a test taken out runs nothing)
    if (!(f in texts)) return all(`${f} is no code the readers follow, or is gone, so what reaches it cannot be told`);
    for (const [t, files] of reaches) if (files.has(f)) add(t, `reaches ${f}`);
    if (!isTest(f)) for (const t of tests) if (whole(t)) add(t, `reaches every file (${f})`); // (a test's own file is no file of the project's a whole run tests)
  }
  return { all: false, why: by, tests: [...by.keys()].sort() };
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
  const lines = [`The selection: ${s.tests.length} of ${total} tests, those the change can reach.`];
  for (const t of s.tests) lines.push(`  ${t}: ${s.why.get(t)}`);
  return lines;
}

// The words after the config: { "--failed", "--env" }, each where given.
function options(rest, self) {
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!["--failed", "--env"].includes(rest[i]) || rest[i + 1] === undefined) refuse(`the selection does not know ${rest.slice(i).join(" ")}`, `run node ${self} [<config>] [--failed <file>] [--env <NAME>]`);
    opts[rest[i]] = rest[i + 1];
  }
  if (opts["--env"] !== undefined && !/^[A-Z_][A-Z0-9_]*$/u.test(opts["--env"])) refuse(`--env ${JSON.stringify(opts["--env"]).slice(0, 40)} is no name of a variable`, "name it in capitals, digits and _, as RUN");
  if (opts["--env"] !== undefined && !process.env.GITHUB_ENV) refuse("--env was given and GITHUB_ENV names no file", "run it as a step of a workflow, or leave --env out");
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

function main(argv) {
  const self = path.relative(process.cwd(), fileURLToPath(import.meta.url)).replace(/\\/gu, "/");
  const named = argv[0] && !argv[0].startsWith("--") ? argv[0] : null, opts = options(named ? argv.slice(1) : argv, self);
  const rules = ["core-manifest.md", "AGENTS.md"].find(f => fs.existsSync(f));
  const at = named ?? where(rules ? fs.readFileSync(rules, "utf8") : ""), base = baseOf(), config = configOf(at);
  const now = config ? standing(config) : null, failed = readFailed(opts["--failed"]);
  const s = !config ? { all: true, why: `the shape check's config (${at}) cannot be read, so what each test reaches cannot be told` }
    : !base ? { all: true, why: "no base is told (SELECT_BASE), as on main, on a schedule and before a release" }
    : selection({ changed: changedSince(base), texts: now.texts, tests: now.tests, reach: survey(now.texts, config, now.tests).reach, failed, config });
  // (a name the variable cannot hold as one word, a space or a line's end in it, runs the whole suite: no file's name
  // sets another variable for the steps after it)
  if (!s.all && s.tests.some(t => !PLAIN.test(t))) Object.assign(s, { all: true, why: "a test's file name holds what a list of names cannot (a space or a line's end)" });
  const lines = said(s, now ? now.tests.size : "all its");
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  if (opts["--env"]) fs.appendFileSync(process.env.GITHUB_ENV, `${opts["--env"]}=${s.all ? "all" : ` ${s.tests.join(" ")} `}\n`);
  return 0;
}

if (started(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
