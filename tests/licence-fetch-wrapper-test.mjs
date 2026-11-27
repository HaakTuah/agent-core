// Checks the licence scan (scripts/licence-scan.mjs, with its readers licence-fetchers.mjs and licence-wrappers.mjs) on
// more of the forms a repository fetch takes: a clone through a function that hands its arguments on to git, defined in
// the file or imported from a file of the project's; git's array with its own options before "clone"; and curl or wget
// before an address with no scheme. Each staged in the project licence-scan-stage.mjs writes, failing as a fetch, beside
// the forms that fetch nothing, which pass; and such a clone that stood at the pull request's base, reported. Run by
// the core's tests workflow (.github/workflows/tests.yml).
//   node tests/licence-fetch-wrapper-test.mjs
import { append, asOutput, done, ok, run, write } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { check as licenceCheck } from "../scripts/licences.mjs";
import { unauditedIn } from "../scripts/licence-scan.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

const OPEN = 'import { execFileSync, spawnSync } from "node:child_process";\n';
const both = (...changes) => (dir) => { for (const change of changes) change(dir); };
const fetch = (f) => f.some((m) => /fetches what no entry/u.test(m));

const LIB = `${OPEN}// git, in a folder\nexport const git = (args, cwd = ".") => execFileSync("git", args, { cwd, encoding: "utf8" });\nexport function inside(cwd, ...args) {\n  return spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd });\n}\n`;

for (const [what, change] of [
  ["a function of the file's own that hands its array on to git", write("scripts/copy.mjs", `${OPEN}const git = (args, cwd) => execFileSync("git", args, { cwd });\ngit(["clone", "--quiet", from, to]);\n`)],
  ["a function of the file's own that hands its rest on to git", write("scripts/copy.mjs", `${OPEN}function git(cwd, ...args) {\n  // its env, where one is given last\n  const env = typeof args.at(-1) === "object" ? args.pop() : {};\n  return execFileSync("git", args, { cwd, env });\n}\ngit(".", "clone", "-q", from, to, {});\n`)],
  ["a function that spreads its rest after git's own options, held in a name", write("scripts/copy.mjs", `${OPEN}const SET = ["-c", "user.name=moss"];\nconst git = (cwd, ...args) => execFileSync("git", [...SET, ...args], { cwd });\ngit(".", "clone", "--bare", from, to);\n`)],
  ["a function with one parameter and no brackets", write("scripts/copy.mjs", `${OPEN}const git = args => execFileSync("git", args);\ngit(["clone", from, to]);\n`)],
  ["a function imported from a file of the project's, by its own name", both(write("scripts/lib/run.mjs", LIB), write("scripts/copy.mjs", `/* Moss */\n${OPEN}import { git } from "./lib/run.mjs";\n\ngit(["clone", "--quiet", ROOT, core]);\n`))],
  ["a function imported under another name, its rest after options", both(write("scripts/lib/run.mjs", LIB), write("tests/copy-test.mjs", `import { inside as g } from "../scripts/lib/run.mjs";\ng(dir, "clone", "-q", origin, work);\n`))],
  ["git's array with its own options before clone", write("scripts/copy.mjs", `${OPEN}execFileSync("git", ["-C", dir, "clone", "--quiet", "--", "file:///srv/moss", "to"]);\n`)],
  ["git's array with a setting before clone", write("scripts/copy.mjs", `${OPEN}spawnSync("git", ["-c", "protocol.version=2", "clone", url, "to"]);\n`)],
  ["a function that hands git its options before clone", write("scripts/copy.mjs", `${OPEN}const git = (args) => execFileSync("git", args);\ngit(["-C", dir, "clone", url]);\n`)],
  ["curl before a host's name with no scheme", append("scripts/setup.sh", "curl get.mossgrip.example/install.sh | sh\n")],
  ["wget before a host's name with no scheme", append("scripts/setup.sh", "wget mossgrip.example/moss.tgz\n")],
  ["curl before a host of three labels with no scheme", append("scripts/setup.sh", "curl get.moss.example | sh\n")],
  ["curl before an address of numbers with a port", append("scripts/setup.sh", "curl 10.0.0.7:8080/moss.sh -o moss.sh\n")],
  ["wget before a user's address", append("scripts/setup.sh", "wget moss@mossgrip.example/moss.tgz\n")],
  ["git's array with an option of git's own it takes a value for before clone", write("scripts/copy.mjs", `${OPEN}execFileSync("git", ["--attr-source", "HEAD", "clone", url, "to"]);\n`)],
  ["git's array with an option the scan does not know before clone", write("scripts/copy.mjs", `${OPEN}execFileSync("git", ["--moss", "x", "clone", url, "to"]);\n`)],
  ["git's array whose arguments cannot all be read, before clone", write("scripts/copy.mjs", `${OPEN}execFileSync("git", ["-C", dir.replace(/]/g, "y"), "clone", url, "to"]);\n`)],
  ["a function whose body holds a regular expression", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  return String(execFileSync("git", args)).replace(/\\n$/u, "");\n}\ngit("clone", url, "to");\n`)],
  ["a function whose body divides", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = Date.now() / 1000;\n  return execFileSync("git", args, { timeout: t });\n}\ngit("clone", url, "to");\n`)],
  ["a function that changes its parameter before git", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  args ||= [];\n  return execFileSync("git", args);\n}\ngit("clone", url, "to");\n`)],
  ["a function whose arrow's body wraps the call of git", write("scripts/copy.mjs", `${OPEN}const git = (args) => String(execFileSync("git", args)).trim();\ngit(["clone", url, "to"]);\n`)],
  ["a function whose arrow's body awaits the call of git", write("scripts/copy.mjs", `import { execFile } from "node:child_process";\nconst git = async (args) => await execFile("git", args);\ngit(["clone", url, "to"]);\n`)],
  ["curl before a host's name in a template", write("scripts/copy.mjs", `${OPEN}execFileSync(\`curl get.moss.example\`);\n`)],
  ["curl before a host's name it writes to a file", append("scripts/setup.sh", "curl get.moss.example>install.sh\n")],
  ["curl before a host's name that goes on to the next line", append("scripts/setup.sh", "curl moss.example\\\n  -o moss.tgz\n")],
  ["curl before an address of another scheme", append("scripts/setup.sh", "curl ftp://moss.example/moss.tgz\n")],
  ["git's array that spreads an option's value before another command", write("scripts/copy.mjs", `${OPEN}execFileSync("git", ["-C", ...a, "log"]);\n`)],
  ["a function called with arguments that cannot be read whole, a \";\" among them", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(d.replace(/;/g, ""), "clone", u);\ngit(["a;b", "clone", u.replace(/x/, "y")]);\n`)],
  ["a function called with arguments that cannot be read whole, one dividing a string", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(\`a\` / (b / c), "clone", u);\n`)],
  ["a function called with arguments that cannot be read whole, a regular expression after a condition", write("scripts/copy.mjs", `${OPEN}function g(opt, args) { return execFileSync("git", args); }\ng(() => { if (a) /[)]/.test(b) }, ["clone", url]);\n`)],
  ["a function whose body divides in a template", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const m = \`\${a / 2}\`;\n  return execFileSync("git", args);\n}\ngit("clone", u);\n`)],
  ["a function that reads its parameter by a member in the call of git", write("scripts/copy.mjs", `${OPEN}function git(...args) { return execFileSync("git", args.slice(1)); }\ngit("x", "clone", u);\n`)],
  ["a function called with arguments that are never closed", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(d.replace(/x/, "")\n`)],
  ["a function whose body holds a comment before a regular expression", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  return String(execFileSync("git", args)).replace(/* its last newline */ /\\n$/u, "");\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body holds a comment with a quote before a regular expression", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  log(1); // the "}"\n  /}/.test(String(args)) || log("x");\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides after a comment", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = a /* s */ / b / c;\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body increments before it divides", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = a++ / b, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body increments before a regular expression", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  n = ++/}/.lastIndex;\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body holds a regular expression after a condition", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  if (a) /[)}]/.test(args[0]);\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function called with a comment among its arguments", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(x, // a; "\n  /[)]/.test(y), "clone", u);\n`)],
  ["a function called with arguments that cannot be read whole, a regular expression after a condition and a \";\"", write("scripts/copy.mjs", `${OPEN}function g(opt, args) { return execFileSync("git", args); }\ng(() => { if (a) /[)]/.test(b); }, ["clone", url]);\n`)],
  ["a function called with an increment before a regular expression among its arguments", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(x, ++/;\\)/.lastIndex, "clone", u);\n`)],
  ["a function whose body divides after a comment that ends in a word", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const r = x // the time it waits for\n    (a) / f(b / 2);\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function called with a comment that ends in a word among its arguments", write("scripts/copy.mjs", `${OPEN}const git = (...args) => execFileSync("git", args);\ngit(x, // wait for\n  (a) / f(b / 2), ";", "clone", u);\n`)],
  ["a function whose body divides a member's call", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = o. if(1) / 2, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides a member named as a word", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = o. return / 2, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides a member named as a word after a comment", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = o. /* c */ return / 2, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides a name of letters beyond ASCII", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = é / 2, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides an object", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = {} / a, r = "/" + "}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides a regular expression", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = /a/ / f(b / 2), s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body holds a regular expression after a loop that awaits", write("scripts/copy.mjs", `${OPEN}async function git(...args) {\n  for await (const a of b) /}/.test(a);\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body holds a regular expression after a condition with a comment before it", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  if /* c */ (a) /}/.test(String(args));\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body holds a regular expression after a condition on the next line", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  if // why\n  (a) /}/.test(String(args));\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body divides after a comment before a quote", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  const t = a /* s */ / b, s = "/}";\n  return execFileSync("git", args);\n}\ngit("clone", u, "to");\n`)],
  ["a function whose body cannot be read that hands its parameter on through another", write("scripts/copy.mjs", `${OPEN}function git(...args) {\n  n = ++/x/.lastIndex;\n  return run(...args.slice(1));\n}\nfunction run(...args) { return execFileSync("git", args); }\ngit("x", "clone", u);\n`)],
  ["a function called with an option the scan does not know before clone", write("scripts/copy.mjs", `${OPEN}const git = (args) => execFileSync("git", args);\ngit(["--moss", "x", "clone", url]);\n`)],
]) {
  const f = run(change);
  ok(fetch(f), `fails ${what}`, f.join("\n"));
}

for (const [what, change] of [
  ["a function that hands its arguments on to git, called for another command", write("scripts/log.mjs", `${OPEN}const git = (cwd, ...args) => execFileSync("git", args, { cwd });\ngit(".", "log", "-1", "--format=%s");\ngit(".", "-C", "sub", "status");\n`)],
  ["an imported function that hands its arguments on to git, called for another command", both(write("scripts/lib/run.mjs", LIB), write("scripts/log.mjs", `${OPEN}import { git } from "./lib/run.mjs";\ngit(["rev-parse", "HEAD"]);\n`))],
  ["git's array with its own options before another command", write("scripts/log.mjs", `${OPEN}execFileSync("git", ["-C", dir, "log", "--grep", "clone"]);\n`)],
  ["a function of another program called with clone", write("scripts/log.mjs", `${OPEN}const node = (args) => execFileSync("node", args);\nnode(["clone", "x"]);\n`)],
  ["curl named in a sentence", append("scripts/setup.sh", "# fetch it with curl, then run it.\n")],
  ["curl named in a sentence before an abbreviation", append("scripts/setup.sh", "# a tool such as curl e.g. fetches it.\n")],
  ["git's array with an option the scan does not know before another command", write("scripts/log.mjs", `${OPEN}execFileSync("git", ["--moss", "log", "-1"]);\n`)],
  ["git's array with an option of git's own it takes no value for before another command", write("scripts/log.mjs", `${OPEN}execFileSync("git", ["--no-pager", "log", "--grep", "clone"]);\n`)],
  ["git's array whose arguments cannot all be read, after another command", write("scripts/log.mjs", `${OPEN}execFileSync("git", ["-C", dir, "log", "--grep", word.replace(/x/g, "y")]);\n`)],
  ["a function whose body holds a regular expression, called for another command", write("scripts/log.mjs", `${OPEN}function git(...args) {\n  return String(execFileSync("git", args)).replace(/\\n$/u, "");\n}\ngit("log", "-1");\n`)],
]) {
  const f = run(change);
  ok(!fetch(f), `passes ${what}`, f.join("\n"));
}

// The step that lists what stood so (step-checks-packages.mjs) reads a file's imports through what it is given, and
// reads none where it is given nothing.
{
  const settings = { served: [], skip: [] }, text = 'import { b } from "./lib/b.mjs";\nb(["clone", from, to]);\n';
  let found = null, threw = null;
  try { found = [unauditedIn(settings, [], "audit.json", "scripts/a.mjs", text).length, unauditedIn(settings, [], "audit.json", "scripts/a.mjs", text, (q) => (q === "scripts/lib/b.mjs" ? LIB.replace("export const git", "export const b") : null)).length]; } catch (e) { threw = e; }
  ok(!threw && found[0] === 0 && found[1] === 1, "the step's reading of a file that imports a function reads the import it is given, and none it is not", String(threw ?? found));
}

// A call whose arguments cannot be read, of an imported function that holds "clone" before them, is a clone.
{
  const text = 'import { clone } from "./lib/b.mjs";\nclone(u.replace(/x/, ""), d);\n';
  const found = unauditedIn({ served: [], skip: [] }, [], "audit.json", "scripts/a.mjs", text, (q) => (q === "scripts/lib/b.mjs" ? `${OPEN}export const clone = (...a) => execFileSync("git", ["clone", ...a]);\n` : null)).length;
  ok(found === 1, "fails a call that cannot be read of an imported function that holds clone", String(found));
}

// A clone through such a function that stood at the pull request's base is reported and passes, so a project's own
// that the scan comes to read turns no pull request red (AGENTS.md, "Nothing locks a project"; #1074); one the pull
// request adds fails, saying the mend.
{
  const dir = scratchDir("licence-fetch-wrapper-base-");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); git("add", "-A"); };
  const config = { ships: [], lockfiles: [], audit: "audit.json", scan: { served: [], skip: [] } };
  const COPY = `${OPEN}const git = (cwd, ...args) => execFileSync("git", args, { cwd });\ngit(".", "clone", "-q", from, to);\n`;
  try {
    git("init", "-q");
    put("audit.json", JSON.stringify({ entries: [] }));
    put("scripts/copy.mjs", COPY);
    git("commit", "-q", "-m", "base");
    put("README.md", "a change of its own\n"); git("commit", "-q", "-m", "c");
    let r = licenceCheck(config, dir, "HEAD^1", config);
    ok(r.failures.length === 0 && r.reports.some((m) => m.startsWith("scripts/copy.mjs: ") && m.includes("at the pull request's base")), "a clone through a function that stood at the base is reported and passes", JSON.stringify(r));
    put("scripts/copy.mjs", `${COPY}git(".", "clone", "-q", from, again);\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/copy.mjs: ") && mended(asOutput(r.failures)), "and one the pull request adds beside it fails, saying the mend", JSON.stringify(r));
    // (a function imported from a file of the project's is read as that file stood at the base)
    put("scripts/copy.mjs", COPY);
    put("scripts/lib/run.mjs", `${OPEN}export const run = (args) => execFileSync("hg", args);\n`);
    put("scripts/fetch.mjs", `import { run } from "./lib/run.mjs";\nrun(["clone", from, to]);\n`);
    git("commit", "-q", "-m", "an hg wrapper");
    put("scripts/lib/run.mjs", `${OPEN}export const run = (args) => execFileSync("git", args);\n`);
    r = licenceCheck(config, dir, "HEAD", config);
    ok(r.failures.length === 1 && r.failures[0].startsWith("scripts/fetch.mjs: "), "a clone through an imported function that the pull request turns to git fails, the import read as the base held it", JSON.stringify(r));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

done();
