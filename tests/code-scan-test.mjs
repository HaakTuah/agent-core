// Tests of the code scan (code-scan.mjs) with the engine: where the engine installs from the core's
// .packages/requirements.txt (`install.mjs pypi`, with Python's pip and PyPI reachable), the engine itself, on
// samples written here, each line a planted weakness (BAD) or a safe look-alike (SAFE), in JavaScript, TypeScript, C#
// and Python: every planted one found and no look-alike, by the core's own rules (code-scan.yml); then the scan of a
// pull request in a scratch repository, failing a finding on a line it adds with its mend, passing one its description
// lists as a false alarm, reporting one that stood before, and silenced by no comment in the code. The scan's own
// logic that needs no engine is tests/code-scan-logic-test.mjs. On Linux and on Windows. Git and Node's own modules;
// Python's pip, and the engine's wheel from PyPI or, where CORE_WHEELS names a folder of them, from it.
//
//   node tests/code-scan-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { scan } from "../scripts/code-scan.mjs";

const { ok, done } = tally();
const tmp = scratchDir("code-scan-test-");
const SCRIPT = fileURLToPath(new URL("../scripts/code-scan.mjs", import.meta.url));

// the engine itself, installed from the core's .packages/requirements.txt as the scan's own step installs it
// (where the run's own set-up fetched the wheels beforehand, CORE_WHEELS names their folder and pip reads it alone, each
// wheel still held to its SHA-256 in the lock file; so a run with the network cut off installs the engine and runs its
// cases, never skips them: #772)
const wheels = process.env.CORE_WHEELS ? { PIP_NO_INDEX: "1", PIP_FIND_LINKS: process.env.CORE_WHEELS } : {};
const installed = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/install.mjs", import.meta.url)), "pypi"], { encoding: "utf8", env: { ...process.env, ...wheels } });
const dir = fileURLToPath(new URL("../.packages/pypi/semgrep/bin/", import.meta.url));
const engineHere = fs.existsSync(path.join(dir, `semgrep-core${process.platform === "win32" ? ".exe" : ""}`));
if (process.env.CORE_OFFLINE && (installed.status !== 0 || !engineHere)) {
  ok(false, "with the network cut off, the engine installs from the wheels the run's set-up fetched, and its cases run", `${installed.stderr || installed.stdout}\nMend: run \`bash scripts/test-downloads.sh wheels\` where the network is up and name the folder it prints in CORE_WHEELS (the tests workflow's step "The code scan's engine, its wheels fetched at their pins for its test" does)`);
} else if (installed.status !== 0 || !engineHere) {
  console.log(`skip the engine's own cases: ${(installed.stderr || installed.stdout).trim().split("\n").pop()}`);
  ok(installed.status !== 0 && /Mend: /u.test(installed.stderr), "where the engine cannot be installed, the install says why, and its mend", installed.stderr);
} else {
  ok(/installed from \.packages\/requirements\.txt into \.packages\/pypi\//u.test(installed.stdout), `the engine is installed and runs here, on ${process.platform}-${process.arch}`, installed.stdout);
  const SAMPLES = {
    "web.js": `const { exec, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const UPTIME = "uptime";
function routes(app, db) {
  app.get("/a", (req, res) => exec(\`ls \${req.query.dir}\`, () => res.end())); // BAD
  app.get("/b", (req, res) => { const name = req.query.name; const cmd = "rm " + name; exec(cmd); }); // BAD
  app.get("/c", (req, res) => res.send(String(eval(req.body.expr)))); // BAD
  app.get("/d", (req, res) => db.query("SELECT * FROM users WHERE id = " + req.params.id)); // BAD
  app.get("/e", (req, res) => fs.readFile(path.join(__dirname, req.query.f), () => {})); // BAD
  app.get("/f", (req, res) => { const q = \`SELECT * FROM t WHERE n='\${req.query.n}'\`; db.query(q); }); // BAD
  app.get("/g", (req, res) => fs.readFile(req.params.p, () => {})); // BAD
  app.get("/h", (req, res) => exec("ls -l", () => res.end())); // SAFE
  app.get("/i", (req, res) => execFile("ls", [req.query.dir])); // SAFE
  app.get("/j", (req, res) => db.query("SELECT * FROM users WHERE id = ?", [req.params.id])); // SAFE
  app.get("/k", (req, res) => { const c = "uptime"; exec(c); }); // SAFE
  app.get("/l", (req, res) => exec(UPTIME, () => res.end())); // SAFE
  app.get("/m", (req, res) => res.send("eval(" + "x)")); // SAFE
  app.get("/n", (req, res) => fs.readFile("config.json", () => {})); // SAFE
}
module.exports = routes;
`,
    "Handlers.cs": `using System.Diagnostics;
using System.Data.SqlClient;
using System.IO;
using System.Runtime.Serialization.Formatters.Binary;
public class Handlers {
  public void Run(string input) { Process.Start("cmd.exe", "/c " + input); } // BAD
  public void Run2(string input) { var cmd = "/c " + input; Process.Start("cmd.exe", cmd); } // BAD
  public void Find(string id, SqlConnection c) { new SqlCommand("SELECT * FROM t WHERE id = " + id, c).ExecuteReader(); } // BAD
  public void Find2(string id, SqlConnection c) { var q = $"SELECT * FROM t WHERE id = {id}"; new SqlCommand(q, c).ExecuteReader(); } // BAD
  public object Load(Stream s) { return new BinaryFormatter().Deserialize(s); } // BAD
  public string Read(string root, string name) { return File.ReadAllText(Path.Combine(root, name)); } // BAD
  public void Ok1(string id, SqlConnection c) { var k = new SqlCommand("SELECT * FROM t WHERE id = @id", c); k.Parameters.AddWithValue("@id", id); } // SAFE
  public void Ok2() { Process.Start("git", "status"); } // SAFE
  public void Ok3(SqlConnection c) { const string q = "SELECT 1"; new SqlCommand(q, c).ExecuteReader(); } // SAFE
  public string Ok4(string unused) { return File.ReadAllText("appsettings.json"); } // SAFE
  public void Ok5(string unused) { Process.Start("git", "log --oneline " + "-5"); } // SAFE
  public void Ok6(string text) { File.WriteAllText("output.txt", text); } // SAFE
}
`,
    "tasks.py": `import ast, os, pickle, subprocess
CMD = "uptime"
def run(arg):
    cmd = "ls " + arg
    subprocess.run(cmd, shell=True)  # BAD
def remove(name):
    os.system(f"rm {name}")  # BAD
def load(data):
    return pickle.loads(data)  # BAD
def find(cur, uid):
    cur.execute("SELECT * FROM t WHERE id = %s" % uid)  # BAD
def find2(cur, uid):
    q = "SELECT * FROM t WHERE id = " + uid
    cur.execute(q)  # BAD
def calc(expr):
    return eval(expr)  # BAD
def ok1(arg):
    subprocess.run(["ls", arg])  # SAFE
def ok2(cur, uid):
    cur.execute("SELECT * FROM t WHERE id = %s", (uid,))  # SAFE
def ok3(expr):
    return ast.literal_eval(expr)  # SAFE
def ok4():
    os.system(CMD)  # SAFE
def ok5(cur):
    q = "SELECT " + "1"
    cur.execute(q)  # SAFE
`,
  };
  SAMPLES["web.ts"] = SAMPLES["web.js"];
  const repo = path.join(tmp, "project");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...a) => execFileSync("git", a, { cwd: repo, env, encoding: "utf8" });
  fs.mkdirSync(repo);
  git("init", "-q"); git("commit", "-q", "--allow-empty", "-m", "base");
  for (const [f, text] of Object.entries(SAMPLES)) fs.writeFileSync(path.join(repo, f), text);
  git("add", "-A"); git("commit", "-q", "-m", "samples");
  const planted = new Set(), safe = new Set();
  for (const [f, text] of Object.entries(SAMPLES)) text.split("\n").forEach((l, i) => { if (/\bBAD\b/u.test(l)) planted.add(`${f}:${i + 1}`); if (/\bSAFE\b/u.test(l)) safe.add(`${f}:${i + 1}`); });
  // (with no base, every finding is reported: read here for what the rules find)
  const all = scan(repo, { dir });
  const found = new Set(all.lines.map(l => /^- reported: ([^:]+:\d+):/u.exec(l)?.[1]).filter(Boolean));
  const missed = [...planted].filter(k => !found.has(k)), alarms = [...found].filter(k => !planted.has(k));
  ok(!all.failed && missed.length === 0, `every planted weakness is found (${planted.size}, in JavaScript, TypeScript, C# and Python)`, `missed: ${missed.join(" ")}\n${all.lines.join("\n")}`);
  ok(alarms.length === 0, `no safe look-alike is flagged (${safe.size})`, `flagged: ${alarms.join(" ")}`);
  ok(!all.lines.some(l => l.includes("could not read")), "the engine reads every sample", all.lines.join("\n"));

  // (before the pull request: a file whose name is a pattern to git, with a weakness that stands, and a link)
  fs.writeFileSync(path.join(repo, "flow.js"), "const { exec } = require(\"child_process\");\nfunction route(app) {\n  app.get(\"/r\", (req, res) => {\n    const command = \"uptime\";\n    exec(command);\n  });\n}\n");
  fs.writeFileSync(path.join(repo, "[id].ts"), "export function h(req, res, db) {\n  db.query(\"SELECT \" + req.query.id); // old comment\n  return res;\n  // a note\n}\n");
  fs.writeFileSync(path.join(repo, "old.py"), "import os\n# a module of its own, moved whole\ndef moved(where):\n    os.system(\"ls -la \" + where)\n");
  let linked = false;
  try { fs.symlinkSync("tasks.py", path.join(repo, "handler.py")); linked = true; } catch { /* (no links made here, as on Windows without the right) */ }
  git("add", "-A"); git("commit", "-q", "-m", "more");
  fs.writeFileSync(path.join(repo, "[id].ts"), fs.readFileSync(path.join(repo, "[id].ts"), "utf8").replace("// a note", "// a note, changed").replace("// old comment", "// updated comment"));
  fs.writeFileSync(path.join(repo, "i.ts"), "export const a = 1;\nexport const b = 2;\n");
  git("mv", "old.py", "new.py");
  fs.writeFileSync(path.join(repo, "flow.js"), fs.readFileSync(path.join(repo, "flow.js"), "utf8").replace("\"uptime\"", "req.query.command"));
  if (linked) { fs.rmSync(path.join(repo, "handler.py")); fs.writeFileSync(path.join(repo, "handler.py"), "import os\ndef run(user_input):\n    os.system(user_input)\n"); }
  // (files the engine would leave out by itself: past its size limit, under tests/ or vendor/, or named by an ignore file)
  const WEAK = "import os\ndef far(arg):\n    os.system(\"ls \" + arg)\n";
  fs.mkdirSync(path.join(repo, "tests"), { recursive: true }); fs.mkdirSync(path.join(repo, "vendor"), { recursive: true });
  fs.writeFileSync(path.join(repo, "tests", "t.py"), WEAK.replace("far", "in_tests"));
  fs.writeFileSync(path.join(repo, "vendor", "v.py"), WEAK.replace("far", "vendored"));
  fs.writeFileSync(path.join(repo, "large.py"), `${WEAK.replace("far", "large")}# ${"x".repeat(1100000)}\n`);
  fs.writeFileSync(path.join(repo, "ignored.py"), WEAK.replace("far", "ignored"));
  fs.writeFileSync(path.join(repo, ".semgrepignore"), "ignored.py\nlarge.py\ntests/\nvendor/\n");
  // a pull request: one line it adds is a weakness, one hidden behind a comment, one listed as a false alarm
  fs.appendFileSync(path.join(repo, "tasks.py"), "def added(name):\n    os.system(\"rm \" + name)  # nosemgrep\ndef listed(n):\n    os.popen(\"ls \" + n)\n");
  // (files named so that git would quote them in a diff's header, or so that they read as an option)
  const ODD = ["ünï.py", "-x.py", ...(process.platform === "win32" ? [] : ['a "q" b.py'])]; // (Windows takes no quote in a name)
  for (const odd of ODD) fs.writeFileSync(path.join(repo, odd), "import os\ndef go(arg):\n    os.system(\"ls \" + arg)\n");
  try { fs.symlinkSync("tasks.py", path.join(repo, "link.py")); } catch { /* (no links made here, as on Windows without the right) */ }
  git("add", "-A"); git("commit", "-q", "-m", "change");
  const run = (args, body = "") => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env: { ...env, PR_BODY: body } });
  const failing = run(["--base", "HEAD~1"]);
  const out = failing.stdout + failing.stderr;
  ok(failing.status === 1 && /FAIL: tasks\.py:\d+: a parameter reaches a shell command \(py-command\), which this change brings/u.test(out) && mended(out), "a weakness the change brings fails, saying its mend", out);
  ok((out.match(/^FAIL: tasks\.py:/gmu) ?? []).length === 2, "a comment in the code silences no finding", out);
  ok(ODD.every(f => out.includes(`FAIL: ${f}:3:`)), "a file whose name git quotes, or that reads as an option, is scanned, its finding failing", out);
  ok(/reported, not failed: \[id\]\.ts:2:/u.test(out) && !out.includes("FAIL: [id].ts"), "a file whose name is a pattern to git is read by its name alone, and a finding that stood in it, its line's comment changed, is reported, not failed", out);
  ok(!linked || out.includes("FAIL: handler.py:3:"), "a link the change makes a file is scanned, its finding failing", out);
  ok(/reported, not failed: new\.py:4: .* which stood before this change/u.test(out) && !out.includes("FAIL: new.py"), "a file the change renames, its finding unchanged, is known by its name at the base: reported, not failed", out);
  ok(["tests/t.py:3", "vendor/v.py:3", "large.py:3", "ignored.py:3"].every(f => out.includes(`FAIL: ${f}:`)), "a file past the engine's size limit, under tests/ or vendor/, or named by an ignore file is scanned, its finding failing", out);
  ok(!/FAIL: [^:]+: the engine did not scan it/u.test(out), "every file the scan names to the engine is read", out);
  const unlisted = run(["--base", "HEAD~1"], "Scan unread: `large.py`, a table generated by a tool");
  ok(unlisted.stdout.includes("FAIL: large.py:3:") && /listed as unread, but the engine read it whole: large\.py; the listing excuses nothing there/u.test(unlisted.stdout), "a file the description lists as unread is scanned all the same: the listing excuses nothing the engine read", unlisted.stdout);
  ok(out.includes("FAIL: flow.js:5:"), "input the change brings to a sink whose line it leaves as it was fails: the base held no such finding", out);
  ok(/reported, not failed: tasks\.py:5: .* which stood before this change/u.test(out) && !/^FAIL: (web|Handlers)/mu.test(out), "a weakness on a line that stood before is reported, and passes", out);
  ok(!/link\.py/u.test(out), "a file that is a link is not read", out);
  const listedAll = [...out.matchAll(/^FAIL: (.+?:\d+): /gmu)].map(m => `Scan false alarm: \`${m[1]}\`, invented for the test`).join("\n");
  const explained = run(["--base", "HEAD~1"], listedAll);
  ok(explained.status === 0 && /passed: tasks\.py:\d+: .* listed in the description as a false alarm/u.test(explained.stdout), "a finding the description lists as a false alarm passes, said so", explained.stdout + explained.stderr);
  const host = path.join(repo, ".github", "workflows"); fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, "codeql.yml"), `jobs:\n  a:\n    uses: ${CORE}/.github/workflows/codeql.yml@${"1".repeat(40)}\n`);
  const added = run(["--base", "HEAD~1"]);
  ok(added.status === 1 && !/not run/u.test(added.stdout), "a call to codeql.yml the change adds does not switch the scan off: the base's workflows are read", added.stdout);
  const hosted = run([]);
  ok(hosted.status === 0 && /not run: a workflow calls the core's codeql\.yml/u.test(hosted.stdout), "where the host's CodeQL scans the project, the scan does not run, and says so", hosted.stdout);
  fs.rmSync(host, { recursive: true });
}

done("the code scan");
