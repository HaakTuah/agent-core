// Tests of the daily try (scripts/daily-try.mjs; #1413, point 5): only the owner's own projects that take the core are
// found, a project of another owner never, in one order; each name is masked and never printed; each runner clones its
// one project alone, and keeps no sign-in; the projects' own code runs with none; each project's runs are read as the
// release's trial reads them; each runner's counts are read from its own log alone; and what is filed is counts and
// conclusions alone, one bug at a time. On a stand-in for GitHub and scratch repositories; git and Node's
// own modules only.
//
//   node tests/daily-try-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { BARE, LINE, OWNER, SIGNIN, TITLE, bugText, cloneLeg, file, formed, gather, holds, legLines, list, owned, runLeg, runLogged, tryOne } from "../scripts/daily-try.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const tmp = scratchDir("daily-try-test-");
const git = (cwd, ...a) => { const r = spawnSync("git", a, { cwd, encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const PIN = "1".repeat(40), SHA = "2".repeat(40);
const manifest = `# Manifest\n\nCore: ${CORE} at ${PIN}, copied whole under core/\n`;

// A stand-in for gh api: the repositories by route, each manifest by name, and any other route a 404.
const REPOS = [
  { full_name: `${OWNER}/game-one`, owner: { login: OWNER }, private: true },
  { full_name: `${OWNER}/tool-two`, owner: { login: OWNER }, private: false },
  { full_name: `${OWNER}/no-manifest`, owner: { login: OWNER }, private: false },
  { full_name: `${OWNER}/old-one`, owner: { login: OWNER }, private: false, archived: true },
  { full_name: CORE, owner: { login: OWNER }, private: false },
  { full_name: "someone-else/their-game", owner: { login: "someone-else" }, private: true },
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
  const got = cloneLeg(2, one, { signedIn: true, token: "fake-token-for-a-test", expected: 2, gh, url, say: l => cloned.push(l), actions: true });
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
    const run = (cmd, args, cwd, log) => {
      ran.push({ k, args: args.join(" "), log, cwd });
      const v = args.indexOf("--verdicts");
      if (v >= 0) { const after = args[v + 1].endsWith("after.json"), runs = after ? p.after : p.before; if (runs) fs.writeFileSync(args[v + 1], JSON.stringify(runs)); return !!runs; }
      if (args.some(a => a.endsWith("sync.mjs"))) return p.sync !== false;
      return true;
    };
    legsSaid.push(runLeg(leg, path.join(tmp, "core-at"), i + 1, { run, sha: SHA }));
  }
  ok(legsSaid.map(l => l.came).join() === "held,tried,untried,syncFailed,atPin" && legsSaid[0].failedAfter === 1 && legsSaid[1].passedBoth === 1 && legsSaid.every((l, i) => l.leg === i + 1 && l.commit === SHA), "each runner's counts: what its project came to, and the trial's classes of its runs", JSON.stringify(legsSaid.map(l => [l.leg, l.came])));
  ok(!JSON.stringify(legsSaid).includes(OWNER) && Object.keys(legsSaid[0]).every(k => k === "leg" || k === "commit" || k === "came" || Number.isInteger(legsSaid[0][k])), "a runner's counts are numbers, the commit and what it came to, no name", JSON.stringify(legsSaid[0]));
  ok(!ran.some(r => r.k === "atPin") && ran.filter(r => r.k === "held").map(r => r.args).some(a => /toolchain\.mjs/u.test(a)) && ran.every(r => path.dirname(r.log) === path.dirname(r.cwd) && path.basename(r.log) === "project.log"), "a project already at the commit is not run; the toolchain it pins is fetched first; each run's output goes to a log beside the clone, outside it", JSON.stringify(ran.slice(0, 2)));
  ok(ran.filter(r => r.k === "held" && /--verdicts/u.test(r.args)).map(r => r.args.includes("before.json") ? "before" : "after").join() === "before,after" && ran.some(r => r.k === "held" && r.args.endsWith(` ${SHA}`)), "the run before, the sync to the commit, then the run after", ran.filter(r => r.k === "held").map(r => r.args).join(" | "));
  const none = runLeg(path.join(tmp, "legs", "nothing-cloned"), path.join(tmp, "core-at"), 6, { run: () => true, sha: SHA });
  ok(none.came === "untried" && none.leg === 6, "a runner whose clone failed says its project was not tried", JSON.stringify(none));

  // the counts summed from the runners' own lines
  const lines = legsSaid.map(l => ({ leg: l.leg, text: JSON.stringify(l) }));
  const t = gather(lines, { sha: SHA, day: "2026-11-27", signedIn: true, found: 7, privates: 2 });
  ok(t.found === 7 && t.private === 2 && t.tried === 2 && t.held === 1 && t.untried === 3 && t.syncFailed === 1 && t.atPin === 1 && t.afterUnread === 0 && t.failedAfter === 1 && t.passedBoth === 1 && formed(t), "the runners' counts summed, and a runner that said nothing counted as not tried", JSON.stringify(t));
  const forged = gather([{ leg: 1, text: JSON.stringify({ ...legsSaid[1], leg: 2 }) }, { leg: 2, text: JSON.stringify(legsSaid[1]) }, { leg: 3, text: JSON.stringify({ ...legsSaid[2], commit: PIN }) }], { sha: SHA, day: "2026-11-27", signedIn: true, found: 3, privates: 0 });
  ok(forged.tried === 1 && forged.untried === 2 && formed(forged), "a line that gives another runner's number, or another commit, is not read, so one project's code cannot speak for another's", JSON.stringify(forged));
}

// what is filed: counts and conclusions alone, one bug at a time, the sign-in asked of the owner while it is not given
{
  const t = { commit: SHA, day: "2026-11-27", signedIn: false, found: 3, private: 1, tried: 2, atPin: 0, untried: 0, syncFailed: 1, afterUnread: 0, held: 1, ...Object.fromEntries(["passedBoth", "fixedAfter", "failedBoth", "failedAfter", "failedAfterAlone", "stoppedAfter", "stoppedNeither", "ranAfterAlone", "ranBeforeAlone", "failedBeforeAlone", "unrunAfter", "unrunAfterRan", "unreadAfter", "unreadBefore", "unreadNeither"].map(k => [k, 0])), failedAfter: 1, name: `${OWNER}/game-one` };
  ok(formed(t) && !formed({ ...t, held: "1" }) && !formed({ ...t, commit: "main" }) && !formed({ ...t, tried: 9 }), "only counts in the form the run writes are filed");
  const issues = (open = []) => route => {
    if (/\/comments/u.test(route)) return JSON.stringify(open.flatMap(i => i.comments ?? []));
    if (/issues\?state=open/u.test(route)) return JSON.stringify(open);
    throw new Error("gh: Not Found (HTTP 404)");
  };
  const wrote = [], write = (m, r, b) => wrote.push({ m, r, b });
  file(t, { gh: issues(), write, say: () => {} });
  const bug = wrote.find(w => w.b.title === TITLE), signin = wrote.find(w => w.b.title === SIGNIN);
  ok(bug && bug.m === "POST" && bug.b.labels.join() === "bug,queued,by:look" && bug.b.assignees.join() === OWNER && bug.b.body.includes(SHA) && /1 project whose checks the trial's reading holds \(1 passed before the sync and failed after/u.test(bug.b.body) && /1 project whose sync to the commit failed/u.test(bug.b.body), "a held try files one bug, labelled and assigned, saying the commit and the counts", bug?.b.body);
  ok(!wrote.some(w => JSON.stringify(w.b).includes("game-one")) && /--local/u.test(bug.b.body) && /Mend:/u.test(bug.b.body), "it names no project, even one smuggled into the counts, and says how a session finds which", bugText(t));
  ok(signin && signin.b.labels.join() === "needs-owner,by:look" && /PROJECTS_READ/u.test(signin.b.body), "without the sign-in, one issue asks it of the owner, labelled needs-owner", signin?.b.labels);
  wrote.length = 0;
  const standing = [{ number: 7, title: TITLE, body: "of an earlier commit", comments: [] }, { number: 8, title: SIGNIN, body: "" }];
  file(t, { gh: issues(standing), write, say: () => {} });
  ok(wrote.length === 1 && wrote[0].r.endsWith("issues/7/comments"), "an open bug gets a comment for a new commit held, never a second issue, and the sign-in's issue is not filed twice", JSON.stringify(wrote.map(w => w.r)));
  wrote.length = 0;
  standing[0].comments = [{ body: `held ${SHA}` }];
  file(t, { gh: issues(standing), write, say: () => {} });
  ok(wrote.length === 0, "a commit the bug already holds is not noted again", JSON.stringify(wrote));
  file({ ...t, signedIn: true, held: 0, syncFailed: 0, tried: 3, failedAfter: 0 }, { gh: issues(standing), write, say: () => {} });
  ok(wrote.map(w => `${w.m} ${w.r}`).join() === `POST repos/${CORE}/issues/8/comments,PATCH repos/${CORE}/issues/8`, "a try that held nothing files nothing, and once the sign-in is given its issue is closed", JSON.stringify(wrote));
  wrote.length = 0;
  let threw = false;
  try { file({ ...t, commit: "not one" }, { gh: issues(), write, say: () => {} }); } catch { threw = true; }
  ok(threw && wrote.length === 0, "counts in no form write nothing");
}

// the hostile cases of what the try reads (SECURITY.md, rule 5): GitHub's answers, the projects' verdicts and the counts
{
  const base = { commit: SHA, day: "2026-11-27", signedIn: true, found: 0, private: 0, tried: 0, atPin: 0, untried: 0, syncFailed: 0, afterUnread: 0, held: 0, ...Object.fromEntries(["passedBoth", "fixedAfter", "failedBoth", "failedAfter", "failedAfterAlone", "stoppedAfter", "stoppedNeither", "ranAfterAlone", "ranBeforeAlone", "failedBeforeAlone", "unrunAfter", "unrunAfterRan", "unreadAfter", "unreadBefore", "unreadNeither"].map(k => [k, 0])) };
  const refused = [null, undefined, "", [], "counts", 5, {}, { ...base, commit: `<b>${SHA}</b>` }, { ...base, commit: "../../../etc/passwd" }, { ...base, day: "<img src=x>" },
    { ...base, found: -1 }, { ...base, found: 2 ** 60 }, { ...base, held: 0.5 }, { ...base, signedIn: "true" }, { ...base, private: 1 }];
  ok(formed(base) && refused.every(t => !formed(t)), "counts that are nothing at all, of the wrong type, markup, a file path or a number out of range are in no form", JSON.stringify(refused.filter(t => formed(t))));
  const envs = [{ SHA: "not one", FOUND: "1", PRIVATE: "0", RUN_ID: "1", RUN_ATTEMPT: "1" }, { SHA, FOUND: "1", PRIVATE: "2", RUN_ID: "1", RUN_ATTEMPT: "1" }, { SHA, FOUND: "1", PRIVATE: "0", RUN_ID: "1/../../x", RUN_ATTEMPT: "1" }, { SHA, FOUND: "-1", PRIVATE: "0", RUN_ID: "1", RUN_ATTEMPT: "1" }];
  const said = envs.map(e => spawnSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "daily-try.mjs"), "--file"], { encoding: "utf8", env: { PATH: process.env.PATH, GH_TOKEN: "", ...e } })).map(r => [r.status, r.stderr + r.stdout]);
  ok(said.every(([st, o]) => st === 1 && /no form/u.test(o) && /Mend:/u.test(o)), "what --list found, in no form (a commit, counts out of range, a run that is no number), is refused before anything is read or written, saying the mend", JSON.stringify(said).slice(0, 300));
  const big = { leg: 1, commit: SHA, came: "tried", ...Object.fromEntries(Object.keys(base).filter(k => !["commit", "day", "signedIn", "found", "private", "tried", "atPin", "untried", "syncFailed", "afterUnread", "held"].includes(k)).map(k => [k, 0])) };
  const huge = [{ ...big, passedBoth: 2 ** 52 }, { ...big, passedBoth: 10001 }, { ...big, came: "held\n" }, { ...big, came: "toString" }];
  const g = gather([...huge.map(l => ({ leg: 1, text: JSON.stringify(l) })), { leg: 2, text: `${JSON.stringify({ ...big, leg: 2 })}${" ".repeat(5000)}` }], { sha: SHA, day: "2026-11-27", signedIn: true, found: 2, privates: 0 });
  ok(g.untried === 2 && g.passedBoth === 0 && formed(g), "a runner's line with a count past 10,000, of no class or past 4 KB is not read, so no runner can stop the filing for the rest", JSON.stringify(g).slice(0, 200));
  const logs = { 11: `x\n${LINE}{"forged":1}\nmore\n${LINE}${JSON.stringify(big)}\nafter`, 12: `${LINE}{}`.padEnd((16 << 20) + 10, "x"), 13: "nothing said", 14: `${LINE}${JSON.stringify(big)}` };
  const jobs = [{ id: 11, name: "try 1" }, { id: 12, name: "try 2" }, { id: 13, name: "try 3" }, { id: 14, name: "try-file" }, { id: "15", name: "try 4" }];
  const ghLogs = route => {
    if (/\/runs\/7\/attempts\/2\/jobs\?per_page=100&page=1$/u.test(route)) return JSON.stringify({ jobs });
    const m = /\/actions\/jobs\/(\d+)\/logs$/u.exec(route);
    if (m && logs[m[1]]) return logs[m[1]];
    throw new Error("gh: Not Found (HTTP 404)");
  };
  const ll = legLines(7, 2, { gh: ghLogs, repo: CORE });
  ok(ll.length === 1 && ll[0].leg === 1 && ll[0].text === JSON.stringify(big), "of each runner's log the last counts line alone is read; a log past 16 MB, a job not of the try's runners and one with no number are not", JSON.stringify(ll).slice(0, 200));
  let refusedJobs = null;
  try { legLines(8, 1, { gh: ghLogs, repo: CORE }); } catch (e) { refusedJobs = e; }
  ok(refusedJobs instanceof Error, "GitHub refusing the list of jobs throws, never read as runners that said nothing");
  const odd = [
    { full_name: `${OWNER}/huge`, owner: { login: OWNER } }, { full_name: `${OWNER}/odd`, owner: { login: OWNER } }, { full_name: `${OWNER}/fine`, owner: { login: OWNER } },
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
  ok(none instanceof Error, "an answer that is no list of repositories throws, never read as none", String(list));
  const out = path.join(tmp, "hostile-out"), at = path.join(out, "hostile");
  fs.mkdirSync(at, { recursive: true }); fs.mkdirSync(out, { recursive: true }); git(at, "init", "-q");
  const writes = body => (cmd, args) => { const v = args.indexOf("--verdicts"); if (v >= 0) fs.writeFileSync(args[v + 1], body); return true; };
  const came = [("x".repeat(17 << 20)), "5", "\"passed\"", "", "{\"a/x\":"].map(body => tryOne(at, path.join(tmp, "core-at"), SHA, out, writes(body)).came);
  ok(came.every(c => c === "untried"), "verdicts past 16 MB, of the wrong type, nothing at all or cut short are read as none written, the project untried", came.join());
}

console.log(`${count - failed} of ${count} assertions on the daily try`);
if (failed) process.exitCode = 1;
