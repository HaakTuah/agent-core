// Checks the helper hook (helper-call.mjs, beside this file): which calls it refuses, that the same call made again
// goes on, and the hook's whole command in a repository whose main holds the script. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/helper-call-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND, defines, refusal, refusedBefore } from "./helper-call.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const agent = (tool_input, tool_name = "Agent", session_id = "s1") => ({ session_id, hook_event_name: "PreToolUse", tool_name, tool_input });
const whole = { description: "x", prompt: "y", subagent_type: "general-purpose", model: "sonnet", effort: "medium" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helper-call-test-"));

const why = (input, own) => refusal(input, own)?.why ?? "";
ok(refusal(agent(whole)) === null && refusal(agent({ ...whole, effort: "xhigh" })) === null && refusal(agent(whole, "Task")) === null, "a call with both goes on, at any effort but max, under the tool's old name too");
ok(/no model\b/u.test(why(agent({ ...whole, model: undefined }))) && /no effort\b/u.test(why(agent({ ...whole, effort: "" }))) && /no model and no effort/u.test(why(agent({ prompt: "y" }))) && refusal(agent({ prompt: "y" })).lacks, "a call without a model, without an effort or without both is refused, and told which");
ok(/max/u.test(why(agent({ ...whole, effort: "max" }))) && /max/u.test(why(agent({ ...whole, effort: " MAX " }))) && !refusal(agent({ ...whole, effort: "max" })).lacks, "the effort max is refused, and not as a field left out");
ok(refusal(agent({ prompt: "y", subagent_type: "fork" })) === null, "a fork goes on: it runs on its caller's model and effort");
const own = type => type === "poller";
ok(refusal(agent({ prompt: "y", subagent_type: "poller" }), own) === null && refusal(agent({ prompt: "y", subagent_type: "general-purpose" }), own) !== null && refusal(agent({ prompt: "y" }), own) !== null, "a helper of a type the project defines goes on without them; another type, or none, does not");
const project = path.join(tmp, "project");
fs.mkdirSync(path.join(project, ".claude", "agents"), { recursive: true });
fs.writeFileSync(path.join(project, ".claude", "agents", "poller.md"), "---\nname: poller\nmodel: haiku\neffort: low\n---\n");
fs.writeFileSync(path.join(project, "secret.md"), "x");
ok(defines(project, "poller") && !defines(project, "Explore") && !defines(project, "../../secret") && !defines(project, "") && !defines(project, undefined) && !defines(project, "plugin:poller"), "the project defines a type by a file of its name among its agents; a path or a plugin's type is none of its own");
ok(refusal(agent({ command: "ls" }, "Bash")) === null && refusal({}) === null && refusal(null) === null && refusal(agent(null)) === null && refusal(agent("x")) === null, "another tool's call, and input of no known shape, go on");
ok(refusal(agent({ ...whole, model: 5, effort: ["high"] })) !== null, "a model or an effort that is no text counts as left out");

const marks = path.join(tmp, "marks");
fs.mkdirSync(marks);
const one = agent({ prompt: "y" }), other = agent({ prompt: "z" });
ok(!refusedBefore(one, marks) && !refusedBefore(other, marks) && refusedBefore(one, marks) && !refusedBefore(one, marks) && refusedBefore(other, marks), "the same call made again goes on, once, each call by itself");
ok(!refusedBefore(agent({ prompt: "y" }, "Agent", "s2"), marks) && fs.readdirSync(marks).every(f => /^helper-call-s[12]-[0-9a-f]{32}$/u.test(f) && fs.statSync(path.join(marks, f)).size === 0), "another session's same call is its own, and a mark holds nothing of the call");
ok(refusedBefore(agent({ prompt: "y" }, "Agent", "../x"), marks) && refusedBefore(agent({ prompt: "y" }, "Agent", undefined), marks) && refusedBefore(one, path.join(tmp, "none")), "a session it cannot name, or a mark it cannot keep, is never held");
const swapped = agent({ description: "d", prompt: "p", nested: { a: 1, b: [2, { c: 3, d: 4 }] } }, "Agent", "s3"), same = agent({ nested: { b: [2, { d: 4, c: 3 }], a: 1 }, prompt: "p", description: "d" }, "Agent", "s3");
ok(!refusedBefore(swapped, marks) && refusedBefore(same, marks), "the same call with its fields in another order is the same call");
const late = agent({ prompt: "late" }, "Agent", "s4"), t0 = Date.now();
ok(!refusedBefore(late, marks, t0) && !refusedBefore(late, marks, t0 + 660_000) && refusedBefore(late, marks, t0 + 1000), "a refusal more than ten minutes old lets nothing through: the call is refused afresh, and goes on when made again after that");
const planted = agent({ prompt: "planted" }, "Agent", "s5"), target = path.join(tmp, "target");
fs.writeFileSync(target, "keep");
ok(!refusedBefore(planted, marks) && (() => { const mark = path.join(marks, fs.readdirSync(marks).find(f => f.startsWith("helper-call-s5-"))); fs.unlinkSync(mark); fs.symlinkSync(target, mark); return !refusedBefore(planted, marks) && fs.readFileSync(target, "utf8") === "keep" && fs.lstatSync(mark).isFile(); })(), "a link planted where a mark belongs lets nothing through and is never written through");

const file = fileURLToPath(new URL("./helper-call.mjs", import.meta.url));
const env = { ...process.env, CLAUDE_PROJECT_DIR: project, TMPDIR: marks };
const run = (args, input) => spawnSync(args[0], args.slice(1), { input, encoding: "utf8", env });
const call = (session, tool_input) => JSON.stringify(agent(tool_input, "Agent", session));
const first = run([process.execPath, file], call("f1", { prompt: "y" }));
ok(first.status === 2 && /no model and no effort/u.test(first.stderr) && run([process.execPath, file], call("f1", { prompt: "y" })).status === 0 && run([process.execPath, file], call("f2", whole)).status === 0, "as a file: exit 2 with the reason on stderr, exit 0 for the same call again and for a call with both");
const max = call("f4", { ...whole, effort: "max" });
ok([1, 2, 3].every(() => run([process.execPath, file], max).status === 2), "the effort max is refused every time, the same call again too");
ok(run([process.execPath, file], call("f3", { prompt: "y", subagent_type: "poller" })).status === 0 && run([process.execPath, file], "not json").status === 0 && run([process.execPath, file], "").status === 0 && run([process.execPath, file], "[1]").status === 0, "run in a project, it lets that project's own type through; input that is not a hook's JSON is let through");
ok(JSON.parse(run([process.execPath, file, "--command"], "").stdout) === COMMAND && !COMMAND.includes("\n"), "--command prints the hook's command, one line, as a settings file holds it");

// the hook's whole command, as a shell runs it, in a repository whose main holds the script (and whose working tree
// holds another, which must not be the one that runs)
const repo = path.join(tmp, "repo"), bare = path.join(tmp, "bare");
const git = (cwd, args) => execFileSync("git", args, { cwd, stdio: "ignore" });
const commit = cwd => { git(cwd, ["init", "-q"]); git(cwd, ["add", "-A"]); git(cwd, ["-c", "user.email=a@b.example", "-c", "user.name=test", "commit", "-q", "-m", "x"]); git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]); };
fs.mkdirSync(path.join(repo, "core", "scripts"), { recursive: true });
fs.copyFileSync(file, path.join(repo, "core", "scripts", "helper-call.mjs"));
commit(repo);
fs.writeFileSync(path.join(repo, "core", "scripts", "helper-call.mjs"), "process.exit(0);\n");
fs.mkdirSync(bare);
fs.writeFileSync(path.join(bare, "README.md"), "x\n");
commit(bare);
const shell = { ...env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` };
const hook = (input, dir) => spawnSync("sh", ["-c", COMMAND], { input, encoding: "utf8", env: { ...shell, CLAUDE_PROJECT_DIR: dir } });
const refused = hook(call("h1", { prompt: "y" }), repo);
ok(refused.status === 2 && /no model and no effort/u.test(refused.stderr) && hook(call("h1", { prompt: "y" }), repo).status === 0 && hook(call("h2", whole), repo).status === 0, "the hook's command, whole, runs main's copy and not the working tree's: it refuses, lets the same call through again, and lets a call with both through");
ok(hook(call("h3", { prompt: "y" }), path.join(tmp, "nowhere")).status === 0 && hook(call("h4", { prompt: "y" }), project).status === 0 && hook(call("h5", { prompt: "y" }), bare).status === 0, "where there is no folder, no repository, or a main that holds no copy, the call goes on");
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
