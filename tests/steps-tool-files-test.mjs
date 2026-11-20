// Tests the reader of the step of the agent tools' files (step-checks-tool-files.mjs, with steps.mjs): where the copies or
// pointer check cannot run to its verdict the step is not read, never done, and what its answer is kept by. On the projects
// the starter kit of this commit writes in a scratch folder. Node's own modules and git.
//
//   node tests/steps-tool-files-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { toolFilesRead, toolFilesState } from "../scripts/step-checks-tool-files.mjs";
import { STEPS, Unread, project } from "../scripts/steps.mjs";
import { READ_MOST } from "../scripts/own-files.mjs";
import { STAGES } from "../scripts/steps-stage.mjs";
import { kitIn } from "../scripts/steps-kit.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-files-");
const kit = kitIn(tmp);
// (the starter kit's npm project, every step done as the kit writes it)
const lockProject = kit("an-npm-project", { packages: "." });
const dirs = { "an-npm-project": lockProject };
// (the step of the agent tools' files taken out of it and mended, as the main test's loop over the steps leaves a project: its
// copies check's baseline written, which the cases of that step read among the files whose change asks a new run)
const tools = "16 November 2026, the agent tools' files read for copies and pointers";
STAGES[tools].stage(lockProject); STAGES[tools].mend(lockProject); STAGES[tools].after?.(lockProject);
execFileSync("git", ["add", "-A"], { cwd: lockProject });
const submoduleKit = kit("a-submodule-carried-project", { packages: "." }, { at: "lib/core/", library: "lib/", submodule: true });

// the agent tools' files step: where the copies or pointer check cannot run to its verdict, it is not read, never done
{
  const step = STEPS.find(s => s.lead === "16 November 2026, the agent tools' files read for copies and pointers"), d = dirs["an-npm-project"];
  const unread = () => { try { step.check(project(d)); return ""; } catch (e) { return e instanceof Unread ? e.message : `${e}`; } };
  const cfg = path.join(d, "checks/copies.json"), was = fs.readFileSync(cfg, "utf8");
  fs.writeFileSync(cfg, "{ not json");
  let said = unread();
  fs.writeFileSync(cfg, was);
  ok(/the copies check did not run to its verdict on checks\/copies\.json/.test(said), "where the copies check stops before its verdict, the step is not read", said);
  for (const script of ["copies.mjs", "pointers.mjs"]) {
    const at = path.join(d, "core/scripts", script);
    fs.renameSync(at, `${at}.away`);
    said = unread();
    fs.renameSync(`${at}.away`, at);
    ok(said === `no copy of ${script} to run`, `with no copy of ${script}, the step is not read`, said);
  }
  if (process.platform !== "win32") {
    const outside = path.join(tmp, "copies-outside.json");
    fs.writeFileSync(outside, was); fs.rmSync(cfg); fs.symlinkSync(outside, cfg);
    said = unread();
    fs.rmSync(cfg); fs.writeFileSync(cfg, was);
    ok(/the copies check's config `checks\/copies\.json` is no regular file of the project's own/.test(said), "a copies config whose link leads out of the project is not handed to the check", said);
  }
  ok(step.check(project(d)) === null, "and with each put back, the starter kit's project has nothing to list", step.check(project(d)) ?? "");
  if (process.platform !== "win32") {
    // (a tracked link to a file git does not track: what the step says follows that file, read through the link)
    fs.mkdirSync(path.join(d, "notes"), { recursive: true });
    fs.writeFileSync(path.join(d, "notes/g.md"), "# G\n\nAs `docs/nowhere-g.md` says.\n");
    fs.symlinkSync("../../notes/g.md", path.join(d, ".kiro/steering/g.md"));
    execFileSync("git", ["add", ".kiro/steering/g.md"], { cwd: d });
    const before = step.check(project(d)) ?? "";
    fs.writeFileSync(path.join(d, "notes/g.md"), "# G\n\nAs `AGENTS.md` says.\n");
    const after = step.check(project(d));
    execFileSync("git", ["rm", "-q", "-f", ".kiro/steering/g.md"], { cwd: d }); fs.rmSync(path.join(d, "notes"), { recursive: true });
    ok(before.includes(".kiro/steering/g.md:3") && after === null, "a broken pointer in a tool's file that links to a file git does not track is named, and once that file is mended, no longer", `${before}\n${after}`);
    // (a tracked link to a device, or to a file outside the project, is never opened: the step reads on)
    fs.symlinkSync("/dev/zero", path.join(d, "zero")); fs.symlinkSync(path.join(tmp, "copies-outside.json"), path.join(d, "outside.json"));
    execFileSync("git", ["add", "zero", "outside.json"], { cwd: d });
    const linked = step.check(project(d));
    execFileSync("git", ["rm", "-q", "-f", "zero", "outside.json"], { cwd: d });
    ok(linked === null, "a tracked link to a device or to a file outside the project is never opened, and the step reads on", `${linked}`);
  }
  // (what the step's cache is keyed by, #812: the files the two checks read, and no other; a change to a file they read asks
  // a new run, and one to a file they do not, in the work tree or staged, leaves the state as it was and the checks' words
  // the same, run again to see it)
  {
    const state = () => toolFilesState(project(d)).key, said = () => { const p = project(d), { config } = toolFilesState(p); return toolFilesRead(p, config) ?? ""; };
    const original = f => fs.readFileSync(path.join(d, f), "utf8"), put = (f, text) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), text); };
    const stage = f => execFileSync("git", ["add", "--", f], { cwd: d }), unstage = f => execFileSync("git", ["rm", "-q", "-f", "--cached", "--", f], { cwd: d });
    const flows = fs.readdirSync(path.join(d, ".github/workflows")).filter(f => f.endsWith(".yml"));
    const base = state(), words = said();
    const changed = (f, text = `${original(f)}\n`) => { const was = original(f); put(f, text); const now = state(); put(f, was); return now !== base; };
    const unread = [".claude/settings.json", "checks/licences.json", `.github/workflows/${flows[0]}`, "checks/sizes.json"];
    ok(flows.length > 0 && unread.every(f => !changed(f)), "a change to a workflow, a setting or a config of another check, which neither check reads, leaves the state of the project as it was", unread.filter(f => changed(f)).join(", "));
    const copies = unread.map(original);
    unread.forEach(f => put(f, `${original(f)}\n`));
    const staged = unread.map(f => { stage(f); return state() === base; });
    unread.forEach((f, i) => { put(f, copies[i]); stage(f); });
    ok(staged.every(Boolean) && state() === base && said() === words, "nor does the same change staged, and the checks run again say what they said", `${staged}`);
    const reads = ["AGENTS.md", "core-manifest.md", "docs/PROGRESS.md", "core/scripts/guards.mjs", "checks/copies.json", "checks/copies-baseline.json", ".kiro/steering/core.md"];
    const restaged = f => {
      const [mode, sha] = execFileSync("git", ["ls-files", "-s", "--", f], { cwd: d, encoding: "utf8" }).split(/\s/u), was = original(f);
      put(f, `${was}\n`); stage(f); const now = state(); put(f, was);
      execFileSync("git", ["update-index", "--cacheinfo", `${mode},${sha},${f}`], { cwd: d });
      return now !== base;
    };
    ok(reads.every(f => changed(f)) && reads.every(restaged), "a change to a rule file, a Markdown file, a file of the copy of the core, the config or its baseline asks a new run, in the work tree or staged", reads.filter(f => !changed(f) || !restaged(f)).join(", "));
    // (with an answer to keep: a broken pointer in a tool's file is named, a change to a file the checks do not read leaves
    // the state and the words as they were, and mending the pointer changes both)
    const n = ".kiro/steering/n.md";
    put(n, "# N\n\nAs `docs/nowhere-n.md` says.\n"); stage(n);
    const asked = said(), held = state();
    unread.forEach(f => put(f, `${original(f)}\n`));
    const kept = state() === held && said() === asked;
    unread.forEach((f, i) => put(f, copies[i]));
    put(n, "# N\n\nAs `AGENTS.md` says.\n");
    const mended = said(), moved = state() !== held;
    unstage(n); fs.rmSync(path.join(d, n));
    ok(asked.includes(n) && kept && mended === "" && moved, "a change to a file the checks do not read leaves the state and the words of a step that has something to list as they were, and mending what it lists changes both", `${asked}\n${kept} ${mended} ${moved}`);
    // (what the config names, what SECURITY.md lists and what a tool's folder holds is read, and what they leave out is not:
    // each scene adds its files, changes the config or SECURITY.md, and says which of its files moves the state)
    const config = original("checks/copies.json"), spec = JSON.parse(config), security = original("SECURITY.md");
    const listed = (...more) => security.replace("`docs/threat-model.md`;", `\`docs/threat-model.md\`${more.map(f => `, \`${f}\``).join("")};`);
    // (a glob among the rule files is no tracked file, which the pointer check fails on without a verdict: such scenes run no check)
    const scene = (files, { config: change = {}, security: more = [], run: runs = true } = {}) => {
      Object.keys(files).forEach(f => put(f, files[f]));
      put("checks/copies.json", `${JSON.stringify({ ...spec, ...change })}\n`); put("SECURITY.md", listed(...more));
      [...Object.keys(files), "checks/copies.json", "SECURITY.md"].forEach(stage);
      const named = state(), moves = Object.keys(files).filter(f => { put(f, `${files[f]}${files[f]}`); const now = state(); put(f, files[f]); return now !== named; });
      const run = runs ? said() : words;
      Object.keys(files).forEach(f => { unstage(f); fs.rmSync(path.join(d, f)); });
      put("checks/copies.json", config); put("SECURITY.md", security); stage("checks/copies.json"); stage("SECURITY.md");
      return { moves: moves.join(","), run };
    };
    const code = scene({ "app/a.txt": "a\n", "app/b.txt": "b\n" }, { config: { code: ["app/a.txt"] } });
    const prose = scene({ "notes/p.txt": "p\n", "notes/q.dat": "q\n" }, { config: { prose: [...spec.prose, "notes/*.txt"] } });
    const named = scene({ "data/r.txt": "r\n", "data/s.dat": "s\n" }, { security: ["data/*.txt"], run: false });
    const unlisted = scene({ "data/r.txt": "r\n" }, { config: { proseFromSecurity: false }, security: ["data/*.txt"], run: false });
    const literal = scene({ "checks/rule.dat": "r\n" }, { config: { proseFromSecurity: false }, security: ["checks/rule.dat"] });
    // (a ":!" in one list leaves out only what that list read: copies.mjs lists the code and the prose each by itself)
    const apart = scene({ "src/a.js": "a\n", "vendor/lib.js": "v\n" }, { config: { code: ["src/", ":!vendor/lib.js"], prose: [...spec.prose, "vendor/"] }, run: false });
    const only = scene({ "src/b.js": "b\n", "vendor/c.js": "c\n" }, { config: { code: [":!vendor/"], prose: ["docs/*.md"] }, run: false });
    const tools = scene({ ".kiro/agents/x.json": "{}\n", ".agent/rules": "r\n", ".kiro/other.json": "{}\n" });
    ok(code.moves === "app/a.txt" && prose.moves === "notes/p.txt" && named.moves === "data/r.txt" && unlisted.moves === "" && literal.moves === "checks/rule.dat" && tools.moves === ".kiro/agents/x.json,.agent/rules" && apart.moves === "src/a.js,vendor/lib.js" && only.moves === "src/b.js",
      "a file the config's code or prose names, one SECURITY.md lists (a glob only where the config reads its list as prose), a rule file it names and a file in an agent tool's folder is read, and a file they leave out is not",
      JSON.stringify([code, prose, named, unlisted, literal, tools, apart, only].map(x => x.moves)));
    ok([code, prose, named, unlisted, literal, tools, apart, only].every(x => x.run === words), "and the checks, run again with such files held, say what they said", [code, prose, named, unlisted, literal, tools, apart, only].map(x => x.run).join("\n"));
    // (what the old key held, still held: a library's submodule that moves on, and a file in a tool's folder too big to be read,
    // which the checks read all the same, staged)
    const inLib = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: path.join(submoduleKit, "lib"), stdio: "ignore" });
    const before = toolFilesState(project(submoduleKit)).key;
    fs.writeFileSync(path.join(submoduleKit, "lib/moved.txt"), "moved\n"); inLib("add", "-A"); inLib("commit", "-q", "-m", "moved");
    const big = ".kiro/agents/big.json";
    put(big, "{}\n"); stage(big);
    const small = state();
    fs.writeFileSync(path.join(d, big), Buffer.alloc(READ_MOST + 1, 32)); stage(big);
    const large = state();
    fs.writeFileSync(path.join(d, big), Buffer.alloc(READ_MOST + 1, 33)); stage(big);
    const edited = state();
    unstage(big); fs.rmSync(path.join(d, big));
    ok(toolFilesState(project(submoduleKit)).key !== before && small !== large && large !== edited, "a submodule that moved, and a staged change to a tool's file past what is read, ask a new run", `${toolFilesState(project(submoduleKit)).key !== before} ${small !== large} ${large !== edited}`);
    // (git's own files that change what a check lists)
    const git = [".gitattributes", ".gitmodules"].map(f => { put(f, "\n"); stage(f); const was = state(); put(f, "# x\n"); const now = state(); unstage(f); fs.rmSync(path.join(d, f)); return was !== now; });
    ok(git.every(Boolean), "a change to .gitattributes or .gitmodules asks a new run", `${git}`);
    // (where the rule files cannot be read, no file is left out)
    put("SECURITY.md", security.replace(/\*\*the rule files:\*\*/u, "**the files of rules:**"));
    const whole = state(), flow = `.github/workflows/${flows[0]}`;
    put(flow, `${original(flow)}\n`); const every = state() !== whole;
    put(flow, copies[2]); put("SECURITY.md", security);
    ok(every && state() === base, "where the project's rule files cannot be read, every file counts as read", `${every}`);
  }
}


done("steps-tool-files");
