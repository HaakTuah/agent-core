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
]) {
  const f = run(change);
  ok(!fetch(f), `passes ${what}`, f.join("\n"));
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
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

done();
