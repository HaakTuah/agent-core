// Checks the helper hook (helper-call.mjs, beside this file): which calls it refuses, and that it runs as the hook runs
// it. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/helper-call-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defines, refusal } from "./helper-call.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const agent = (tool_input, tool_name = "Agent") => ({ hook_event_name: "PreToolUse", tool_name, tool_input });
const whole = { description: "x", prompt: "y", subagent_type: "general-purpose", model: "sonnet", effort: "medium" };

ok(refusal(agent(whole)) === "" && refusal(agent({ ...whole, effort: "xhigh" })) === "" && refusal(agent(whole, "Task")) === "", "a call with both goes on, at any effort but max, under the tool's old name too");
ok(/no model\b/u.test(refusal(agent({ ...whole, model: undefined }))) && /no effort\b/u.test(refusal(agent({ ...whole, effort: "" }))) && /no model and no effort/u.test(refusal(agent({ prompt: "y" }))), "a call without a model, without an effort or without both is refused, and told which");
ok(/max/u.test(refusal(agent({ ...whole, effort: "max" }))) && /max/u.test(refusal(agent({ ...whole, effort: " MAX " }))), "the effort max is refused");
ok(refusal(agent({ prompt: "y", subagent_type: "fork" })) === "", "a fork goes on: it runs on its caller's model and effort");
const own = type => type === "poller";
ok(refusal(agent({ prompt: "y", subagent_type: "poller" }), own) === "" && refusal(agent({ prompt: "y", subagent_type: "general-purpose" }), own) !== "" && refusal(agent({ prompt: "y" }), own) !== "", "a helper of a type the project defines goes on without them; another type, or none, does not");
const project = fs.mkdtempSync(path.join(os.tmpdir(), "helper-call-"));
fs.mkdirSync(path.join(project, ".claude", "agents"), { recursive: true });
fs.writeFileSync(path.join(project, ".claude", "agents", "poller.md"), "---\nname: poller\nmodel: haiku\n---\n");
fs.writeFileSync(path.join(project, "secret.md"), "x");
ok(defines(project, "poller") && !defines(project, "Explore") && !defines(project, "../../secret") && !defines(project, "") && !defines(project, undefined) && !defines(project, "plugin:poller"), "the project defines a type by a file of its name among its agents; a path or a plugin's type is none of its own");
ok(refusal(agent({ command: "ls" }, "Bash")) === "" && refusal({}) === "" && refusal(null) === "" && refusal(agent(null)) === "" && refusal(agent("x")) === "", "another tool's call, and input of no known shape, go on");
ok(refusal(agent({ ...whole, model: 5, effort: ["high"] })) !== "", "a model or an effort that is no text counts as left out");

const file = fileURLToPath(new URL("./helper-call.mjs", import.meta.url)), text = fs.readFileSync(file, "utf8");
const run = (args, input) => spawnSync(process.execPath, args, { input, encoding: "utf8" });
const bad = JSON.stringify(agent({ prompt: "y" })), good = JSON.stringify(agent(whole));
ok(run([file], bad).status === 2 && /no model and no effort/u.test(run([file], bad).stderr) && run([file], good).status === 0, "as a file: exit 2 with the reason on stderr, exit 0 where the call goes on");
ok(run(["--input-type=module", "-e", text], bad).status === 2 && run(["--input-type=module", "-e", text], good).status === 0, "given as text with no file, as the hook runs main's copy: the same");
const env = { ...process.env, CLAUDE_PROJECT_DIR: project }, typed = JSON.stringify(agent({ prompt: "y", subagent_type: "poller" }));
ok(spawnSync(process.execPath, [file], { input: typed, encoding: "utf8", env }).status === 0 && spawnSync(process.execPath, [file], { input: bad, encoding: "utf8", env }).status === 2, "run in a project, it lets that project's own type through and no other");
fs.rmSync(project, { recursive: true, force: true });
ok(run([file], "not json").status === 0 && run([file], "").status === 0 && run([file], "[1]").status === 0, "input that is not a hook's JSON is let through");
process.exit(failed ? 1 : 0);
