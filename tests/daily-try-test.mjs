// Tests of the daily try (scripts/daily-try.mjs; #1413, point 5): only the owner's own projects that take the core are
// found, a project of another owner never; each name is masked and never printed; the clones keep no sign-in; the
// projects' own code runs with none; each project's runs are read as the release's trial reads them; and what is filed
// is counts and conclusions alone, one bug at a time. On a stand-in for GitHub and scratch repositories; git and Node's
// own modules only.
//
//   node tests/daily-try-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { BARE, OWNER, SIGNIN, TITLE, bugText, file, find, formed, holds, owned, runAll, runLogged, tryOne } from "../scripts/daily-try.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daily-try-test-"));
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

// the clones: names masked first and never printed beside, no sign-in kept, nothing to push with
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
  const said = [];
  const list = find(dir, { signedIn: true, token: "fake-token-for-a-test", gh, url: n => path.join(remotes, n.split("/")[1]), say: l => said.push(l), actions: true });
  const masks = said.filter(l => l.startsWith("::add-mask::")), rest = said.filter(l => !l.startsWith("::add-mask::"));
  ok(list.length === 2 && list.every(p => p.cloned) && fs.existsSync(path.join(dir, "p1", "core-manifest.md")), "each project found is cloned under the folder, numbered, not named", JSON.stringify(list));
  ok(masks.length === 4 && masks.indexOf(`::add-mask::${OWNER}/game-one`) < masks.indexOf(`::add-mask::tool-two`), "each project's full name and short name is masked in GitHub's log", masks.join(" "));
  ok(rest.length === 1 && !/game-one|tool-two/u.test(rest[0]) && /found 2 of the owner's own projects that take the core \(1 private\), and cloned 2/u.test(rest[0]), "what it prints is a count alone, no name", rest.join("\n"));
  const config = git(path.join(dir, "p1"), "config", "--list", "--local");
  ok(!/extraheader|fake-token|AUTHORIZATION/iu.test(config) && !fs.readdirSync(path.join(dir)).some(f => fs.readFileSync(path.join(dir, f, ...(f.endsWith(".json") ? [] : ["core-manifest.md"])), "utf8").includes("fake-token")), "the clone keeps no sign-in, in its config or anywhere the try writes", config);
  const quiet = [];
  find(path.join(tmp, "local"), { signedIn: false, gh, url: n => path.join(remotes, n.split("/")[1]), say: l => quiet.push(l), actions: false });
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
  // (five projects: two cloned above, three more written as the stand-in runner finds them)
  const plan = { p1: { before: { "a/x": "passed" }, after: { "a/x": "failed" } }, p2: { before: { "a/x": "passed" }, after: { "a/x": "passed" } }, p3: { before: null }, p4: { before: { "a/x": "passed" }, sync: false }, p5: { at: SHA } };
  const listed = Object.keys(plan).map((d, i) => ({ name: `${OWNER}/n${i}`, private: i < 2, dir: d, cloned: true }));
  for (const d of ["p3", "p4", "p5"]) { fs.mkdirSync(path.join(dir, d), { recursive: true }); git(path.join(dir, d), "init", "-q"); }
  fs.writeFileSync(path.join(dir, "p5", "core-manifest.md"), manifest.replace(PIN, SHA));
  fs.writeFileSync(path.join(dir, "projects.json"), JSON.stringify({ signedIn: true, projects: listed }));
  const ran = [];
  const run = (cmd, args, cwd, log) => {
    const d = path.basename(cwd), p = plan[d];
    ran.push({ d, args: args.join(" "), log });
    const v = args.indexOf("--verdicts");
    if (v >= 0) { const after = args[v + 1].endsWith(".after.json"), runs = after ? p.after : p.before; if (runs) fs.writeFileSync(args[v + 1], JSON.stringify(runs)); return !!runs; }
    if (args.some(a => a.endsWith("sync.mjs"))) return p.sync !== false;
    return true;
  };
  const { out } = runAll(dir, path.join(tmp, "core-at"), { run, sha: SHA, day: "2026-11-27" });
  ok(out.found === 5 && out.private === 2 && out.tried === 2 && out.held === 1 && out.untried === 1 && out.syncFailed === 1 && out.atPin === 1 && out.afterUnread === 0 && out.failedAfter === 1 && out.passedBoth === 1 && formed(out), "the counts: each project tried, held, untried, its sync failed or already at the commit, and the trial's classes summed", JSON.stringify(out));
  ok(!ran.some(r => r.d === "p5") && ran.filter(r => r.d === "p1").map(r => r.args).some(a => /toolchain\.mjs/u.test(a)) && ran.every(r => r.log.startsWith(dir) && !/n\d/u.test(r.log)), "a project already at the commit is not run; the toolchain it pins is fetched first; each run's output goes to a log under the try's folder, named by number", JSON.stringify(ran.slice(0, 3)));
  ok(ran.filter(r => r.d === "p1" && /--verdicts/u.test(r.args)).map(r => r.args.includes(".before.json") ? "before" : "after").join() === "before,after" && ran.some(r => r.d === "p1" && r.args === `${SHA}` || r.args.endsWith(` ${SHA}`)), "the run before, the sync to the commit, then the run after", ran.filter(r => r.d === "p1").map(r => r.args).join(" | "));
  ok(JSON.parse(fs.readFileSync(path.join(dir, "try.json"), "utf8")).commit === SHA && !fs.readFileSync(path.join(dir, "try.json"), "utf8").includes(OWNER), "the counts written hold no project's name", fs.readFileSync(path.join(dir, "try.json"), "utf8"));
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
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "daily-try.mjs"), "--file"], { encoding: "utf8", env: { PATH: process.env.PATH, TRY: JSON.stringify({ ...base, pad: "x".repeat(5000) }), GH_TOKEN: "" } });
  ok(r.status === 1 && /no form/u.test(r.stderr + r.stdout) && /Mend:/u.test(r.stderr + r.stdout), "counts longer than 4 KB are refused before anything is read or written, saying the mend", (r.stderr + r.stdout).slice(0, 300));
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
  let list = null;
  try { list = owned(true, () => "{\"not\":\"a list\"}"); } catch (e) { list = e; }
  ok(list instanceof Error, "an answer that is no list of repositories throws, never read as none", String(list));
  const out = path.join(tmp, "hostile-out"), at = path.join(out, "hostile");
  fs.mkdirSync(at, { recursive: true }); fs.mkdirSync(out, { recursive: true }); git(at, "init", "-q");
  const writes = body => (cmd, args) => { const v = args.indexOf("--verdicts"); if (v >= 0) fs.writeFileSync(args[v + 1], body); return true; };
  const came = [("x".repeat(17 << 20)), "5", "\"passed\"", "", "{\"a/x\":"].map(body => tryOne({ dir: "hostile" }, path.join(tmp, "core-at"), SHA, out, writes(body)).came);
  ok(came.every(c => c === "untried"), "verdicts past 16 MB, of the wrong type, nothing at all or cut short are read as none written, the project untried", came.join());
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${count - failed} of ${count} assertions on the daily try`);
if (failed) process.exitCode = 1;
