// Tests that a tree that passed is not run again (scripts/select-passed.mjs, select.mjs's --passed; tasks/tests.md; #457):
// a push that merges a pull request's head, in a scratch repository, and the one question asked of the host, here a local
// server standing in for it: which check's run counts, which of two runs decides (#733), and what the run takes where the
// host cannot be asked. Split from the selection's test (select-test.mjs; #943). Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/select-passed-test.mjs
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { passedWhole } from "../scripts/select-passed.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/select.mjs", import.meta.url));

// ---- a scratch repository: a project of one source file and its test, and a base the pull requests branch from ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "select-passed-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
put("src/tool.js", "export const tool = 2;\n"); put("test/run.test.js", "import '../src/tool.js';\n");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src", "test"], tests: ["test/"] }));
put("README.md", "# Project\n");
git("init", "-q", "-b", "main");
git("add", "-A"); git("commit", "-q", "-m", "base");
const envFile = path.join(dir, "env");
let r;

// ---- a tree that passed is not run again (#457): a push that merges a pull request's head ----
// (a branch off main that changes a file no reader reads, so its run selected the whole suite, merged with a merge
// commit; `merged` makes it, `moved` moves main first, so the head is not up to date)
const merged = ({ moved = false, file = "README.md" } = {}) => {
  git("checkout", "-q", "-b", `pr${++n}`, "main");
  put(file, `# changed ${n}\n`); git("add", "-A"); git("commit", "-q", "-m", `change ${n}`);
  git("checkout", "-q", "main");
  if (moved) { put(`docs/other${n}.md`, "moved\n"); git("add", "-A"); git("commit", "-q", "-m", `main moved ${n}`); }
  git("merge", "-q", "--no-ff", "-m", `merge ${n}`, `pr${n}`);
  return git("rev-parse", "HEAD^2").trim();
};
let n = 0;
const passedHere = async (asked, selects = () => ({ all: true })) => { const was = process.cwd(); process.chdir(dir); try { return await passedWhole({ check: "tests", selects, asked }); } finally { process.chdir(was); } };
const yes = async () => true;
let head = merged();
let p = await passedHere(async (sha, check) => sha === head && check === "tests");
ok(p.none === true && p.why.includes(head.slice(0, 12)), "a merge whose tree is its head's, whose change selects the whole suite and whose check passed on that head selects nothing", JSON.stringify(p));
p = await passedHere(async () => "a run of it did not pass");
ok(p.all === true && /did not pass on the merged head .*a run of it did not pass/.test(p.why), "a check that did not pass on the head runs the whole suite, saying why", p.why);
p = await passedHere(yes, () => ({ all: false, tests: ["test/run.test.js"] }));
ok(p.all === true && /selected 1 tests, not the whole suite/.test(p.why), "a pull request whose run selected some tests only runs the whole suite here", p.why);
merged({ moved: true });
p = await passedHere(yes);
ok(p.all === true && /held another tree: it was not up to date/.test(p.why), "a head that was not up to date with main runs the whole suite", p.why);
put("CHANGES.md", "a commit straight on main\n"); git("add", "-A"); git("commit", "-q", "-m", "no merge");
p = await passedHere(yes);
ok(p.all === true && /merges no two commits/.test(p.why), "a commit that merges nothing, as a squash or a rebase makes, runs the whole suite", p.why);

// (from the command line: the host asked with the token, a test server standing in for it)
head = merged();
const asks = [];
const server = http.createServer((req, res) => {
  asks.push({ url: req.url, auth: req.headers.authorization });
  const ok2 = req.url.startsWith(`/repos/moss/bark/commits/${head}/check-runs?check_name=tests&`);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ check_runs: ok2 ? [...before, { id: 9, name: "tests", status: "completed", conclusion: state, app: { slug: app }, started_at: "2026-11-19T10:00:00Z" }] : [] }));
});
// (`before`: an older run of the check on the same head, as a draft's gate leaves one; #733)
let state = "success", app = "github-actions", before = [];
await new Promise(done => server.listen(0, "127.0.0.1", done));
const host = { GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_REPOSITORY: "moss/bark", GH_TOKEN: "pretend" };
const runLive = (args, env) => new Promise(done => {
  const c = spawn(process.execPath, [script, ...args], { cwd: dir, env: { ...process.env, SELECT_BASE: "", GITHUB_ENV: "", GITHUB_STEP_SUMMARY: "", ...env } });
  let out = ""; c.stdout.on("data", d => { out += d; }); c.stderr.on("data", d => { out += d; }); c.on("close", status => done({ status, out }));
});
fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && /The selection: none of \d+ tests: the merged head/.test(r.out) && fs.readFileSync(envFile, "utf8") === "RUN=none\n" && asks.at(-1)?.auth === "Bearer pretend",
  "on a push, given --passed, it asks the host with the token, and where the check passed on the merged head it writes \"none\" for the steps after it, never an empty list a runner would read as every test", `${r.out}\n${fs.readFileSync(envFile, "utf8")}`);
app = "another-app"; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /no run of it by GitHub Actions/.test(r.out), "a check of that name another app posted, passed or not, says nothing of the suite: the whole suite runs", r.out);
app = "github-actions"; state = "failure"; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /did not pass on the merged head/.test(r.out), "where the check failed there, the whole suite runs", r.out);
state = "success"; before = [{ id: 3, name: "tests", status: "completed", conclusion: "failure", app: { slug: "github-actions" }, started_at: "2026-11-19T09:00:00Z" }]; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=none\n", "a draft's failed gate before the run that passed on the same head is read as the older: its newest run decides (#733)", r.out);
state = "failure"; before = [{ id: 3, name: "tests", status: "completed", conclusion: "success", app: { slug: "github-actions" }, started_at: "2026-11-19T09:00:00Z" }]; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /its newest run did not pass/.test(r.out), "and a pass before a newer run that failed is no pass: the whole suite runs", r.out);
before = []; state = "success";
fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GH_TOKEN: "", GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /no repository or token/.test(r.out), "with no token, the host is not asked and the whole suite runs", r.out);
server.close();

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
