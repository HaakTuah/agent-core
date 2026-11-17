// Tests of the code scan (code-scan.mjs): the engine's fetch, held to its wheel's digest with nothing taken from a wheel
// that is not it, and from a wheel only the engine's plain files; and, where this system has a build of the engine and
// PyPI's file host answers, the engine itself, fetched as a session's set-up fetches it, on samples written here, each
// line a planted weakness (BAD) or a safe look-alike (SAFE), in JavaScript, TypeScript, C# and Python: every planted
// one found and no look-alike, by the core's own rules (code-scan.yml); then the scan of a pull request in a scratch
// repository, failing a finding on a line it adds with its mend, passing one its description lists as a false alarm,
// reporting one that stood before, and silenced by no comment in the code. On Linux and on Windows. Git and Node's own
// modules; the network for the engine's wheel.
//
//   node tests/code-scan-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, tally, zip } from "../scripts/scratch-core.mjs";
import { VERSION, WHEELS, engineAt, engineFiles, falseAlarms, fetchEngine, hostScans, scan, system, wheelAddress } from "../scripts/code-scan.mjs";

const { ok, done } = tally();
const tmp = scratchDir("code-scan-test-");
const SCRIPT = fileURLToPath(new URL("../scripts/code-scan.mjs", import.meta.url));
const throws = fn => { try { fn(); return false; } catch { return true; } };
const BIN = `semgrep-${VERSION}.data/purelib/semgrep/bin/`;
const answer = bytes => async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes });

// which wheel a system takes, and where it is
ok(system("linux", "x64", "2.39") === "linux-x64" && system("linux", "arm64", null) === "linux-arm64-musl" && system("win32", "x64") === "win32-x64" && system("darwin", "x64") === "darwin-x64",
  "a system is named by platform and architecture, and on Linux by whether its C library is glibc");
ok(Object.values(WHEELS).every(([at, , sum]) => /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{60}$/u.test(at) && /^[0-9a-f]{64}$/u.test(sum)) && !WHEELS["darwin-x64"] && !WHEELS["win32-arm64"],
  "each wheel is named by its path on PyPI's file host and its SHA-256, and there is none for an Intel Mac or Windows on arm64");
ok(wheelAddress(WHEELS["win32-x64"]).startsWith("https://files.pythonhosted.org/packages/8e/8e/") && wheelAddress(WHEELS["win32-x64"]).endsWith(`semgrep-${VERSION}-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-win_amd64.whl`),
  "a wheel's address is PyPI's file host's, over HTTPS");

// the engine's files out of a wheel: its plain files under bin/, never a Python file, a name that climbs, or none
const engine = [[`${BIN}semgrep-core`, "engine"], [`${BIN}libs/libz.so.1`, "a library", false], [`${BIN}__init__.py`, "python"], ["semgrep/__main__.py", "python"]];
const took = engineFiles(zip(engine), "linux");
ok(took.map(f => f.name).join(" ") === "semgrep-core libs/libz.so.1" && took[0].bytes.toString() === "engine", "the engine and its libraries are taken from the wheel's bin folder, deflated or stored, and nothing else");
ok(engineFiles(zip([[`${BIN}semgrep-core.exe`, "engine"]]), "win32").length === 1 && throws(() => engineFiles(zip([[`${BIN}semgrep-core`, "engine"]]), "win32")), "on Windows the engine is semgrep-core.exe, and a wheel without it holds no engine");
for (const name of ["../x", "libs/../../x", "a/b/c", ".hidden", "libs/.x", "x\\y"]) ok(throws(() => engineFiles(zip([...engine, [`${BIN}${name}`, "x"]]), "linux")), `a wheel naming ${name} under its bin folder is refused whole`);
ok(throws(() => engineFiles(zip([[`${BIN}README`, "x"]]), "linux")) && throws(() => engineFiles(Buffer.from("not a zip"), "linux")), "a wheel with no engine, or no zip, is refused");

// the fetch: a wheel whose digest is not the pin's, a system with no build, an error from the host; nothing is placed
{
  const dir = path.join(tmp, "fetched");
  const wrong = await fetchEngine(dir, { sys: "linux-x64", get: answer(zip(engine)), root: tmp });
  ok(/^NOT FETCHED: .*SHA-256 is [0-9a-f]{64}, not 0eb6/u.test(wrong) && !fs.existsSync(dir) && !fs.readdirSync(tmp).some(n => n.startsWith("fetched")), "a wheel whose SHA-256 is not the pin's is refused, and nothing of it is written", wrong);
  const none = await fetchEngine(dir, { sys: "darwin-x64", get: () => { throw new Error("no fetch was due"); }, root: tmp });
  ok(/^NOT FETCHED: .*no build of its engine for darwin-x64/u.test(none) && !fs.existsSync(dir), "a system with no build fetches nothing and says so", none);
  const gone = await fetchEngine(dir, { sys: "linux-x64", get: async () => ({ ok: false, status: 404 }), root: tmp });
  ok(/^NOT FETCHED: .*answered 404/u.test(gone) && !fs.existsSync(dir), "a host that answers an error leaves nothing and says so", gone);
  const big = await fetchEngine(dir, { sys: "linux-x64", get: answer(Buffer.alloc((128 << 20) + 1)), root: tmp });
  ok(/^NOT FETCHED: .*weighs more than/u.test(big) && !fs.existsSync(dir), "a wheel past its bound is refused before its digest is read", big);
}

// what a description lists as false alarms, and whether the host scans a project
ok([...falseAlarms("Scan false alarm: `src/a.js:12`, a fixed list\n- Scan false alarm: `b.py:3`, why\nscan false alarm: `c.cs:1`\nSee Scan false alarm: `d.js:4`")].join(" ") === "src/a.js:12 b.py:3",
  "a false alarm is a line of its own, opening \"Scan false alarm:\" with its place in backticks");
// (hostile descriptions: nothing, the wrong type, markup, a path, a number out of range, too long; none lists a finding
// it does not name exactly, and none takes long)
{
  const t0 = Date.now();
  const long = `${"Scan false alarm: `".repeat(200000)}x`;
  ok(falseAlarms(undefined).size === 0 && falseAlarms(null).size === 0 && falseAlarms(42).size === 0 && falseAlarms({ toString: () => "Scan false alarm: `a.py:1`" }).size === 1 && falseAlarms("").size === 0,
    "a description that is nothing, or no text, lists no false alarm, and one is read as text");
  ok([...falseAlarms("<b>Scan false alarm: `a.py:1`</b>\nScan false alarm: `<script>`\nScan false alarm: `a.py:1x`")].length === 0, "markup around or in the line lists nothing");
  ok([...falseAlarms("Scan false alarm: `../../etc/passwd:1`\nScan false alarm: `a.py:99999999999999999999999`")].join(" ") === "../../etc/passwd:1 a.py:99999999999999999999999", "a path or a number out of range is listed only as written, matching no finding a file inside the project gives");
  ok(falseAlarms(long).size === 0 && Date.now() - t0 < 2000, "a description far past any real one is read in time, and lists nothing");
}
{
  const p = path.join(tmp, "host"); fs.mkdirSync(path.join(p, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(p, ".github", "workflows", "codeql.yml"), "# uses: owner/core/.github/workflows/codeql.yml@x (a comment)\njobs: {}\n");
  const before = hostScans(p);
  fs.writeFileSync(path.join(p, ".github", "workflows", "text.yml"), "jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: |\n          uses: owner/core/.github/workflows/codeql.yml@main\n");
  const inText = hostScans(p);
  fs.writeFileSync(path.join(p, ".github", "workflows", "scan.yaml"), "jobs:\n  analyze:\n    uses: owner/core/.github/workflows/codeql.yml@0123456789abcdef0123456789abcdef01234567\n");
  ok(!before && !inText && hostScans(p) && !hostScans(tmp), "the host scans a project where a job of a workflow calls the core's codeql.yml, not where a comment or a step's text only names it");
  const skipped = await fetchEngine(path.join(tmp, "not-fetched"), { sys: "linux-x64", get: () => { throw new Error("no fetch was due"); }, root: p });
  ok(/not fetched: a workflow calls the core's codeql\.yml/u.test(skipped) && !fs.existsSync(path.join(tmp, "not-fetched")), "where the host's CodeQL scans the project, nothing is fetched", skipped);
}

// the engine itself, where this system has a build and the host answers
const fetched = await fetchEngine(engineAt(path.join(os.tmpdir(), `code-scan-test-engine-${VERSION}`)), { root: tmp });
const dir = engineAt(path.join(os.tmpdir(), `code-scan-test-engine-${VERSION}`));
if (!/^semgrep /u.test(fetched)) {
  console.log(`skip the engine's own cases: ${fetched}`);
  ok(!WHEELS[system()] || /NOT FETCHED/u.test(fetched), "where the engine cannot be had, the fetch says why");
} else {
  ok(true, `the engine is fetched and runs here, on ${system()}: ${fetched}`);
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
  // a pull request: one line it adds is a weakness, one hidden behind a comment, one listed as a false alarm
  fs.appendFileSync(path.join(repo, "tasks.py"), "def added(name):\n    os.system(\"rm \" + name)  # nosemgrep\ndef listed(n):\n    os.popen(\"ls \" + n)\n");
  // (files named so that git would quote them in a diff's header, or so that they read as an option)
  const ODD = ["ünï.py", "-x.py", ...(process.platform === "win32" ? [] : ['a "q" b.py'])]; // (Windows takes no quote in a name)
  for (const odd of ODD) fs.writeFileSync(path.join(repo, odd), "import os\ndef go(arg):\n    os.system(\"ls \" + arg)\n");
  try { fs.symlinkSync("tasks.py", path.join(repo, "link.py")); } catch { /* (no links made here, as on Windows without the right) */ }
  git("add", "-A"); git("commit", "-q", "-m", "change");
  const run = (args, body = "") => spawnSync(process.execPath, [SCRIPT, ...args, "--engine", dir], { cwd: repo, encoding: "utf8", env: { ...env, PR_BODY: body } });
  const failing = run(["--base", "HEAD~1"]);
  const out = failing.stdout + failing.stderr;
  ok(failing.status === 1 && /FAIL: tasks\.py:\d+: a parameter reaches a shell command \(py-command\), which this change brings/u.test(out) && mended(out), "a weakness the change brings fails, saying its mend", out);
  ok((out.match(/^FAIL: tasks\.py:/gmu) ?? []).length === 2, "a comment in the code silences no finding", out);
  ok(ODD.every(f => out.includes(`FAIL: ${f}:3:`)), "a file whose name git quotes, or that reads as an option, is scanned, its finding failing", out);
  ok(/reported, not failed: \[id\]\.ts:2:/u.test(out) && !out.includes("FAIL: [id].ts"), "a file whose name is a pattern to git is read by its name alone, and a finding that stood in it, its line's comment changed, is reported, not failed", out);
  ok(!linked || out.includes("FAIL: handler.py:3:"), "a link the change makes a file is scanned, its finding failing", out);
  ok(/reported, not failed: new\.py:4: .* which stood before this change/u.test(out) && !out.includes("FAIL: new.py"), "a file the change renames, its finding unchanged, is known by its name at the base: reported, not failed", out);
  ok(out.includes("FAIL: flow.js:5:"), "input the change brings to a sink whose line it leaves as it was fails: the base held no such finding", out);
  ok(/reported, not failed: tasks\.py:5: .* which stood before this change/u.test(out) && !/^FAIL: (web|Handlers)/mu.test(out), "a weakness on a line that stood before is reported, and passes", out);
  ok(!/link\.py/u.test(out), "a file that is a link is not read", out);
  const listedAll = [...out.matchAll(/^FAIL: (.+?:\d+): /gmu)].map(m => `Scan false alarm: \`${m[1]}\`, invented for the test`).join("\n");
  const explained = run(["--base", "HEAD~1"], listedAll);
  ok(explained.status === 0 && /passed: tasks\.py:\d+: .* listed in the description as a false alarm/u.test(explained.stdout), "a finding the description lists as a false alarm passes, said so", explained.stdout + explained.stderr);
  const host = path.join(repo, ".github", "workflows"); fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, "codeql.yml"), "jobs:\n  a:\n    uses: owner/core/.github/workflows/codeql.yml@main\n");
  const added = run(["--base", "HEAD~1"]);
  ok(added.status === 1 && !/not run/u.test(added.stdout), "a call to codeql.yml the change adds does not switch the scan off: the base's workflows are read", added.stdout);
  const hosted = run([]);
  ok(hosted.status === 0 && /not run: a workflow calls the core's codeql\.yml/u.test(hosted.stdout), "where the host's CodeQL scans the project, the scan does not run, and says so", hosted.stdout);
  fs.rmSync(host, { recursive: true });
  const none = spawnSync(process.execPath, [SCRIPT, "--base", "HEAD~1", "--engine", path.join(tmp, "no-engine")], { cwd: repo, encoding: "utf8", env });
  ok(none.status === 0 && /did not run: Semgrep's engine is not in .* it decides nothing/u.test(none.stdout), "with no engine, the scan says it did not run and decides nothing", none.stdout);
}

// (the samples' digest is never a wheel's: what the fetch holds the wheel to is only the pin)
ok(createHash("sha256").update(zip(engine)).digest("hex") !== WHEELS["linux-x64"][2], "the test's own wheel is no pinned one");
done("the code scan");
