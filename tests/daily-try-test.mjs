// Tests of the daily try (scripts/daily-try.mjs; #1413, point 5): only the owner's own projects that take the core are
// found, a project of another owner never, in one order; each name is masked and never printed; each runner clones its
// one project alone, and keeps no sign-in; the projects' own code runs with none; each project's runs are read as the
// release's trial reads them; each runner's counts are read from its own log alone; and what is filed is counts and
// conclusions alone, one bug at a time; --green reads main from a work tree, and its step fails where it fails
// (#1544). On a stand-in for GitHub and scratch repositories; git and Node's own modules only.
//
//   node tests/daily-try-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { BARE, cloneLeg, green, holds, list, local, owned, runLeg, runLogged, tryOne } from "../scripts/daily-try.mjs";
import { LINE, OWNER, formed, gather } from "../scripts/daily-try-file.mjs";
import { COUNTS } from "../scripts/release-trial.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const tmp = scratchDir("daily-try-test-");
const git = (cwd, ...a) => { const r = spawnSync("git", a, { cwd, encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const PIN = "1".repeat(40), SHA = "2".repeat(40);
const manifest = `# Manifest\n\nCore: ${CORE} at ${PIN}, copied whole under core/\n`;

// A stand-in for gh api: the repositories by route, each manifest by name, and any other route a 404.
const REPOS = [
  { full_name: `${OWNER}/game-one`, owner: { login: OWNER }, fork: false, private: true },
  { full_name: `${OWNER}/tool-two`, owner: { login: OWNER }, fork: false, private: false },
  { full_name: `${OWNER}/no-manifest`, owner: { login: OWNER }, fork: false, private: false },
  { full_name: `${OWNER}/old-one`, owner: { login: OWNER }, fork: false, private: false, archived: true },
  { full_name: CORE, owner: { login: OWNER }, fork: false, private: false },
  { full_name: "someone-else/their-game", owner: { login: "someone-else" }, fork: false, private: true },
];
const MANIFESTS = { [`${OWNER}/game-one`]: manifest, [`${OWNER}/tool-two`]: manifest, [`${OWNER}/old-one`]: manifest, [CORE]: manifest, "someone-else/their-game": manifest };
const asked = [];
const gh = (route, ...rest) => {
  asked.push(route);
  if (rest.length) throw new Error("no such call");
  if (/^user\/repos\?affiliation=owner/u.test(route)) return JSON.stringify(REPOS);
  if (new RegExp(`^users/${OWNER}/repos\\?type=owner`, "u").test(route)) return JSON.stringify(REPOS.filter(r => !r.private));
  const m = /^repos\/(.+)\/contents\/core-manifest\.md$/u.exec(route);
  if (m && MANIFESTS[m[1]]) return JSON.stringify({ content: Buffer.from(MANIFESTS[m[1]]).toString("base64") });
  throw new Error("gh: Not Found (HTTP 404)");
};

// the projects found: the owner's own alone, the core and an archived one left out, and a reading not taken never none
{
  const signed = owned(true, gh);
  ok(signed.map(p => p.name).join() === `${OWNER}/game-one,${OWNER}/tool-two` && signed[0].private && !signed[1].private, "with the owner's sign-in, every project the owner's account owns that takes the core, never another owner's, the core or an archived one", JSON.stringify(signed));
  asked.length = 0;
  const open = owned(false, gh);
  ok(open.map(p => p.name).join() === `${OWNER}/tool-two` && asked[0].startsWith(`users/${OWNER}/repos`), "without it, the owner's public projects alone, from the account's public list", JSON.stringify(open));
  let threw = false;
  try { owned(true, route => { if (route.startsWith("user/")) return JSON.stringify(REPOS); throw new Error("gh: Server Error (HTTP 502)"); }); } catch { threw = true; }
  ok(threw, "an answer other than a manifest not there (an outage) throws, so that none found is never read from a reading not taken");
}

// the list and each runner's clone: names masked first and never printed beside, one project alone, no sign-in kept
const remotes = path.join(tmp, "remotes"), dir = path.join(tmp, "try");
for (const name of ["game-one", "tool-two"]) {
  const at = path.join(remotes, name);
  fs.mkdirSync(at, { recursive: true });
  git(at, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(at, "core-manifest.md"), manifest);
  git(at, "add", "-A");
  git(at, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a project");
}
{
  const said = [], outs = [];
  const { legs } = list({ signedIn: true, gh, say: l => said.push(l), out: l => outs.push(l), actions: true });
  const masks = said.filter(l => l.startsWith("::add-mask::")), rest = said.filter(l => !l.startsWith("::add-mask::"));
  ok(masks.length === 4 && masks.indexOf(`::add-mask::${OWNER}/game-one`) < masks.indexOf(`::add-mask::tool-two`), "each project's full name and short name is masked in GitHub's log", masks.join(" "));
  ok(rest.length === 1 && !/game-one|tool-two/u.test(rest[0]) && /found 2 of the owner's own projects that take the core \(1 private\); each is tried on a runner of its own/u.test(rest[0]), "what it prints is a count alone, no name", rest.join("\n"));
  ok(outs.join() === "found=2,private=1,signed=true,legs=[1,2]" && legs.join() === "1,2" && !outs.some(l => /game|tool/u.test(l)), "its outputs are the counts and the runners' numbers, no name", outs.join());
  const url = n => path.join(remotes, n.split("/")[1]);
  const one = path.join(dir, "project"), cloned = [];
  const got = cloneLeg(2, one, { signedIn: true, token: ["fake", "token", "for", "a", "test"].join("-"), expected: 2, gh, url, say: l => cloned.push(l), actions: true });
  ok(got && fs.existsSync(path.join(one, "core-manifest.md")) && git(one, "remote", "get-url", "origin").endsWith("tool-two") && fs.readdirSync(dir).join() === "project", "a runner clones its one project alone, the second in the order of names for runner 2, and nothing else", fs.readdirSync(dir).join());
  ok(cloned.filter(l => !l.startsWith("::")).every(l => !/game-one|tool-two/u.test(l)) && cloned.some(l => l === "::add-mask::tool-two"), "the runner masks the names first and prints none", cloned.join(" | "));
  const config = git(one, "config", "--list", "--local");
  ok(!/extraheader|fake-token|AUTHORIZATION/iu.test(config) && !fs.readFileSync(path.join(one, "core-manifest.md"), "utf8").includes("fake-token"), "the clone keeps no sign-in, in its config or its files", config);
  const moved = path.join(tmp, "moved");
  const none = cloneLeg(1, moved, { signedIn: true, expected: 3, gh, url, say: () => {}, actions: false });
  ok(!none && !fs.existsSync(moved), "where the list no longer holds the projects counted, the runner clones nothing, so its number never names another project");
  const quiet = [];
  list({ signedIn: false, gh, say: l => quiet.push(l), actions: false });
  ok(!quiet.some(l => l.startsWith("::")) && /the public ones alone, the private ones wanting the owner's sign-in PROJECTS_READ/u.test(quiet.join()), "outside GitHub's job nothing is masked, and without the sign-in it says the private ones want it", quiet.join("\n"));
}

// the projects' own code runs with no sign-in, and its output stays in the log file
{
  const keep = { ...process.env };
  Object.assign(process.env, { GH_TOKEN: "x", GITHUB_TOKEN: "x", PROJECTS_READ: "x", ACTIONS_RUNTIME_TOKEN: "x", GITHUB_OUTPUT: "/x", GITHUB_ENV: "/x", PERSONAL_TERMS: "x", GIT_CONFIG_COUNT: "1" });
  const log = path.join(tmp, "env.log");
  runLogged(process.execPath, ["-e", "console.log(Object.keys(process.env).join('\\n'))"], tmp, log);
  const keys = fs.readFileSync(log, "utf8").split("\n");
  for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
  Object.assign(process.env, keep);
  ok(!["GH_TOKEN", "GITHUB_TOKEN", "PROJECTS_READ", "ACTIONS_RUNTIME_TOKEN", "GITHUB_OUTPUT", "GITHUB_ENV", "PERSONAL_TERMS", "GIT_CONFIG_COUNT"].some(k => keys.includes(k)) && keys.includes("PATH") && BARE.test("SOME_TOKEN") && BARE.test("AWS_ACCESS_KEY_ID"), "a command the try runs is given no sign-in and none of a step's output files, and its output goes to the log alone", keys.filter(k => BARE.test(k)).join(" "));
}

// each project tried: its runs read as the release's trial reads them
{
  ok(holds([{ "a/x": "passed" }, { "a/x": "failed" }], SHA) && holds([{ "a/x": "passed" }, { "a/x": "unread" }], SHA) && holds([{ "a/x": "passed" }, { "a/x": "stopped" }], SHA)
    && !holds([{ "a/x": "failed" }, { "a/x": "failed" }], SHA) && !holds([{ "a/x": "passed" }, { "a/x": "passed" }], SHA), "a project is held where the trial would hold a cut: a check passed before and failed, unread or stopped after; one failing both, or passing both, is not");
  // (each project as its runner finds it: one tried and held, one passing, one whose run before wrote nothing, one whose
  // sync failed, one already at the commit)
  const plan = { held: { before: { "a/x": "passed" }, after: { "a/x": "failed" } }, passing: { before: { "a/x": "passed" }, after: { "a/x": "passed" } }, untried: { before: null }, unsynced: { before: { "a/x": "passed" }, sync: false }, atPin: { at: SHA } };
  const ran = [], legsSaid = [];
  for (const [i, [k, p]] of Object.entries(plan).entries()) {
    const leg = path.join(tmp, "legs", k), at = path.join(leg, "project");
    fs.mkdirSync(at, { recursive: true }); git(at, "init", "-q");
    fs.writeFileSync(path.join(at, "core-manifest.md"), p.at ? manifest.replace(PIN, SHA) : manifest);
    const run = (cmd, args, cwd, log, env) => {
      ran.push({ k, args: args.join(" "), log, cwd, root: env?.DOTNET_ROOT, pub: env?.CORE_PRIVATE, bare: !Object.keys(env ?? { GH_TOKEN: 1 }).some(n => BARE.test(n)) });
      const v = args.indexOf("--verdicts");
      if (v >= 0) { const after = args[v + 1].endsWith("after.json"), runs = after ? p.after : p.before; if (runs) fs.writeFileSync(args[v + 1], JSON.stringify(runs)); return !!runs; }
      if (args.some(a => a.endsWith("sync.mjs"))) return p.sync !== false;
      return true;
    };
    const tools = (where, log) => { ran.push({ k, tools: where === at && path.dirname(log) === leg }); return { DOTNET_ROOT: `/sdk-${k}` }; };
    legsSaid.push(runLeg(leg, path.join(tmp, "core-at"), i + 1, { run, tools, sha: SHA }));
  }
  ok(legsSaid.map(l => l.came).join() === "held,tried,untried,syncFailed,atPin" && legsSaid[0].failedAfter === 1 && legsSaid[1].passedBoth === 1 && legsSaid.every((l, i) => l.leg === i + 1 && l.commit === SHA), "each runner's counts: what its project came to, and the trial's classes of its runs", JSON.stringify(legsSaid.map(l => [l.leg, l.came])));
  ok(!JSON.stringify(legsSaid).includes(OWNER) && Object.keys(legsSaid[0]).every(k => k === "leg" || k === "commit" || k === "came" || Number.isInteger(legsSaid[0][k])), "a runner's counts are numbers, the commit and what it came to, no name", JSON.stringify(legsSaid[0]));
  const held = ran.filter(r => r.k === "held"), runs = held.filter(r => !("tools" in r));
  ok(!ran.some(r => r.k === "atPin") && held[0]?.tools === true && runs.length >= 6 && runs.every(r => r.root === "/sdk-held" && r.bare) && runs.every(r => path.dirname(r.log) === path.dirname(r.cwd) && path.basename(r.log) === "project.log"),
    "a project already at the commit is not run; the toolchain it pins is fetched first, and every run before, of the sync and after is given what it sets, with no sign-in, its output to the log beside the clone", JSON.stringify(held).slice(0, 400));
  ok(runs.every(r => r.pub === "false"), "every run of a project is told it is public, so the sync reads that from no host that may refuse a reader with no sign-in (#1561)", JSON.stringify(runs.map(r => r.pub)));
  ok(runs.filter(r => /--verdicts/u.test(r.args)).map(r => r.args.includes("before.json") ? "before" : "after").join() === "before,after" && runs.some(r => r.args.endsWith(` ${SHA}`)), "the run before, the sync to the commit, then the run after", ran.filter(r => r.k === "held").map(r => r.args).join(" | "));
  const none = runLeg(path.join(tmp, "legs", "nothing-cloned"), path.join(tmp, "core-at"), 6, { run: () => true, sha: SHA });
  ok(none.came === "untried" && none.leg === 6, "a runner whose clone failed says its project was not tried", JSON.stringify(none));

  // the counts summed from the runners' own lines
  const lines = legsSaid.map(l => ({ leg: l.leg, text: JSON.stringify(l) }));
  const t = gather(lines, { sha: SHA, day: "2026-11-27", signedIn: true, found: 7, privates: 2 });
  ok(t.found === 7 && t.private === 2 && t.tried === 2 && t.held === 1 && t.untried === 3 && t.syncFailed === 1 && t.atPin === 1 && t.afterUnread === 0 && t.failedAfter === 1 && t.passedBoth === 1 && formed(t), "the runners' counts summed, and a runner that said nothing counted as not tried", JSON.stringify(t));
  const forged = gather([{ leg: 1, text: JSON.stringify({ ...legsSaid[1], leg: 2 }) }, { leg: 2, text: JSON.stringify(legsSaid[1]) }, { leg: 3, text: JSON.stringify({ ...legsSaid[2], commit: PIN }) }], { sha: SHA, day: "2026-11-27", signedIn: true, found: 3, privates: 0 });
  ok(forged.tried === 1 && forged.untried === 2 && formed(forged), "a line that gives another runner's number, or another commit, is not read, so one project's code cannot speak for another's", JSON.stringify(forged));
}

// a fork counts as the owner's own only where its parent and its source are the owner's too, as GitHub's own answer
// for the repository says; one it cannot read throws, never read as none
{
  const of = login => ({ owner: { login } });
  const forks = {
    [`${OWNER}/their-fork`]: { fork: true, parent: of("someone-else"), source: of("someone-else") },
    [`${OWNER}/deep-fork`]: { fork: true, parent: of(OWNER), source: of("someone-else") },
    [`${OWNER}/says-nothing`]: { fork: true },
    [`${OWNER}/own-fork`]: { fork: true, parent: of(OWNER), source: of(OWNER) },
    [`${OWNER}/unsaid`]: { fork: false },
  };
  const listed = Object.keys(forks).map(full_name => ({ full_name, owner: { login: OWNER }, private: true, ...(full_name.endsWith("unsaid") ? {} : { fork: true }) }));
  const ghForks = (route, fail = null) => {
    if (/repos\?/u.test(route)) return JSON.stringify(listed);
    const m = /^repos\/(.+)\/contents\/core-manifest\.md$/u.exec(route);
    if (m) return JSON.stringify({ content: Buffer.from(manifest).toString("base64") });
    const r = /^repos\/(.+)$/u.exec(route);
    if (r && forks[r[1]] && r[1] !== fail) return JSON.stringify(forks[r[1]]);
    throw new Error("gh: Something went wrong (HTTP 502)");
  };
  const found = owned(true, ghForks).map(p => p.name).join();
  ok(found === `${OWNER}/own-fork,${OWNER}/unsaid`, "a fork whose parent or source another account owns, or whose answer names neither, is not the owner's own; the owner's own fork is, and a listing that says nothing of forking is read from the repository's own answer", found);
  let threw = null;
  try { owned(true, route => ghForks(route, `${OWNER}/own-fork`)); } catch (e) { threw = e; }
  ok(threw instanceof Error, "a fork whose own answer cannot be read throws, never read as none or as the owner's", String(threw?.message ?? threw));
}

// the hostile cases of what the try reads (SECURITY.md, rule 5): GitHub's answers, the projects' verdicts and what
// --list found (those of the runners' lines: tests/daily-try-file-test.mjs)
{
  const envs = [{ SHA: "not one", FOUND: "1", PRIVATE: "0", RUN_ID: "1", RUN_ATTEMPT: "1" }, { SHA, FOUND: "1", PRIVATE: "2", RUN_ID: "1", RUN_ATTEMPT: "1" }, { SHA, FOUND: "1", PRIVATE: "0", RUN_ID: "1/../../x", RUN_ATTEMPT: "1" }, { SHA, FOUND: "-1", PRIVATE: "0", RUN_ID: "1", RUN_ATTEMPT: "1" }];
  const said = envs.map(e => spawnSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "daily-try.mjs"), "--file"], { encoding: "utf8", env: { PATH: process.env.PATH, GH_TOKEN: "", ...e } })).map(r => [r.status, r.stderr + r.stdout]);
  ok(said.every(([st, o]) => st === 1 && /no form/u.test(o) && /Mend:/u.test(o)), "what --list found, in no form (a commit, counts out of range, a run that is no number), is refused before anything is read or written, saying the mend", JSON.stringify(said).slice(0, 300));
  const odd = [
    { full_name: `${OWNER}/huge`, owner: { login: OWNER }, fork: false }, { full_name: `${OWNER}/odd`, owner: { login: OWNER }, fork: false }, { full_name: `${OWNER}/fine`, owner: { login: OWNER }, fork: false },
    { full_name: 5, owner: null }, "not a repository",
  ];
  const answer = { [`${OWNER}/huge`]: { content: Buffer.from(manifest + "x".repeat((1 << 20) + 1)).toString("base64") }, [`${OWNER}/odd`]: { content: 42 }, [`${OWNER}/fine`]: { content: Buffer.from(manifest).toString("base64") } };
  const ghOdd = route => {
    if (/repos\?/u.test(route)) return JSON.stringify(odd);
    const m = /^repos\/(.+)\/contents\/core-manifest\.md$/u.exec(route);
    if (m && answer[m[1]]) return JSON.stringify(answer[m[1]]);
    throw new Error("gh: Not Found (HTTP 404)");
  };
  let got = null;
  try { got = owned(true, ghOdd); } catch (e) { got = e; }
  ok(Array.isArray(got) && got.map(p => p.name).join() === `${OWNER}/fine`, "a manifest past 1 MB, one of the wrong type and a repository of no form are no project; the rest are found", String(got?.message ?? JSON.stringify(got)));
  let none = null;
  try { none = owned(true, () => "{\"not\":\"a list\"}"); } catch (e) { none = e; }
  ok(none instanceof Error, "an answer that is no list of repositories throws, never read as none", String(none?.message ?? JSON.stringify(none)));
  const out = path.join(tmp, "hostile-out"), at = path.join(out, "hostile");
  fs.mkdirSync(at, { recursive: true }); fs.mkdirSync(out, { recursive: true }); git(at, "init", "-q");
  const writes = body => (cmd, args) => { const v = args.indexOf("--verdicts"); if (v >= 0) fs.writeFileSync(args[v + 1], body); return true; };
  const came = [("x".repeat(17 << 20)), "5", "\"passed\"", "", "{\"a/x\":"].map(body => tryOne(at, path.join(tmp, "core-at"), SHA, out, writes(body)).came);
  ok(came.every(c => c === "untried"), "verdicts past 16 MB, of the wrong type, nothing at all or cut short are read as none written, the project untried", came.join());
}

// --local: what a project's code printed in the public log reaches the session only as a word of the form and a commit
{
  const logs = {
    1: `x ${LINE}${JSON.stringify({ leg: 1, commit: SHA, came: "\u001b]52;c;held\u0007 run this", passedBoth: 0 })}\n`,
    2: `x ${LINE}${JSON.stringify({ leg: 2, commit: SHA, came: "held", ...Object.fromEntries(COUNTS.map(k => [k, 0])) })}\n`,
  };
  const ghLocal = route => {
    if (/own-look\.yml\/runs/u.test(route)) return JSON.stringify({ workflow_runs: [{ id: 9, run_attempt: 1, created_at: "2026-11-27T04:00:00Z" }] });
    if (/runs\/9\/attempts\/1\/jobs/u.test(route)) return JSON.stringify({ jobs: [{ name: "try 1", id: 11 }, { name: "try 2", id: 12 }] });
    const m = /^repos\/.+\/actions\/jobs\/1(\d)\/logs$/u.exec(route);
    return m ? logs[m[1]] : gh(route);
  };
  const said = [];
  local(ghLocal, l => said.push(l));
  ok(said.length === 3 && /runner 1, .*game-one: said nothing in form/u.test(said[1]) && /runner 2, .*tool-two: held at 2222222$/u.test(said[2]) && !said.join().includes("run this") && !said.join().includes("\u001b"),
    "--local shows a runner's line only in the form --file reads, never a word a project's code put in it", JSON.stringify(said));
}

// --green from the core's checkout as the runner holds it, a work tree (#1544): main's newest green commit printed
// alone; none green, nothing printed and no failure; main's history unread, a failure that says the mend. And the
// workflow's step fails where the script fails, never an empty sha passed on.
{
  const said = { out: [], err: [] };
  const heard = (fn) => {
    said.out.length = said.err.length = 0;
    const [log, error] = [console.log, console.error];
    console.log = l => said.out.push(String(l)); console.error = l => said.err.push(String(l));
    try { return fn(); } finally { [console.log, console.error] = [log, error]; }
  };
  const runs = (conclusion) => () => JSON.stringify({ total_count: 1, workflow_runs: [{ name: "tests", path: ".github/workflows/tests.yml", status: "completed", conclusion }] });
  const tree = path.join(tmp, "green-tree");
  fs.mkdirSync(tree);
  git(tree, "init", "--quiet", "--initial-branch=main");
  for (const n of [1, 2]) { fs.writeFileSync(path.join(tree, "f"), `${n}`); git(tree, "add", "f"); git(tree, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "--quiet", "-m", `${n}`); }
  const head = git(tree, "rev-parse", "HEAD");
  const linked = path.join(tmp, "green-linked");
  git(tree, "worktree", "add", "--quiet", "--detach", linked, "main");
  for (const [at, what] of [[tree, "a work tree"], [linked, "a linked work tree, its .git a file"], [path.join(tree, ".git"), "a work tree's git folder, as a bare repository is handed"]]) {
    const code = heard(() => green(at, runs("success")));
    ok(code === 0 && said.out.join() === head && !said.err.length, `--green from ${what} prints main's newest green commit alone`, JSON.stringify({ code, ...said }));
  }
  const none = heard(() => green(tree, runs("failure")));
  ok(none === 0 && !said.out.length && /nothing to try today/u.test(said.err.join()), "--green where no commit is green prints nothing, says nothing is tried today, and fails nothing", JSON.stringify({ none, ...said }));
  const bare = path.join(tmp, "green-none");
  fs.mkdirSync(bare);
  const unread = heard(() => green(bare, runs("success")));
  ok(unread === 1 && !said.out.length && /^FAIL main's history could not be read.*Mend: /u.test(said.err.join()), "--green where main's history cannot be read fails, saying the mend, and prints no commit", JSON.stringify({ unread, ...said }));

  // the step's own lines, as own-look.yml gives them, run under bash -e as the runner runs them, a stand-in for node
  const yml = fs.readFileSync(new URL("../.github/workflows/own-look.yml", import.meta.url), "utf8");
  const step = /\n {8}id: green\n(?: {8,}(?!run:).*\n)*? {8}run: (?:\|\n((?: {10}.*\n)+)|(.+))/u.exec(yml);
  ok(!!step, "own-look.yml holds the step that finds the commit to try, its id green");
  if (step) {
    const script = step[1] ? step[1].replace(/^ {10}/gmu, "") : step[2], bin = path.join(tmp, "green-bin"), out = path.join(tmp, "green-output");
    fs.mkdirSync(bin);
    const step_ = (body) => {
      fs.writeFileSync(path.join(bin, "node"), `#!/bin/sh\n${body}\n`, { mode: 0o755 }); fs.writeFileSync(out, "");
      return spawnSync("bash", ["-e", "-c", script], { encoding: "utf8", env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: out } }).status;
    };
    ok(step_("echo FAIL it could not be read >&2; exit 1") !== 0 && !/sha=/u.test(fs.readFileSync(out, "utf8")), "the step fails where --green fails, and passes no sha on");
    ok(step_(`echo ${head}`) === 0 && fs.readFileSync(out, "utf8") === `sha=${head}\n`, "the step passes on the commit --green prints");
    ok(step_("exit 0") === 0 && fs.readFileSync(out, "utf8") === "sha=\n", "the step passes an empty sha where no commit is green");
  }
}

console.log(`${count - failed} of ${count} assertions on the daily try`);
if (failed) process.exitCode = 1;
