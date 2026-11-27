// Tests of the part that reads and writes the host for the steps (host.mjs, step-checks-host.mjs; #1092), on a stand-in
// for GitHub: each step read on the host done, not done and not read; what readHost asks, and that it asks nothing but
// reads; the steps run with a host and without one; the issue "Settings only the owner gives", its readings and the
// writes refused; the labels made, and a write refused said with the right it needs; and the look's record written and
// read back. Node's own modules and git.
//
//   node tests/host-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { hostReport, hostSteps, readHost, refusal, settingsOf, settingsTask } from "../scripts/host.mjs";
import { LIST, makeLabels } from "../scripts/labels.mjs";
import { BOT, RECORD, lastRun, recordBody } from "../scripts/look-keep.mjs";
import { Unread } from "../scripts/workflow-calls.mjs";
import { hostOf } from "../scripts/look-host.mjs";
import { HOST_READ, LOOKED, correction, daily, hostRead, inbox, labels, lookedUp, privateReview, reviewers, scanning, scanningOwner } from "../scripts/step-checks-host.mjs";
import { STEPS, notDone, project } from "../scripts/steps.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const unread = f => { try { f(); return false; } catch (e) { return e instanceof Unread; } };

// A scratch project: a git repository holding `files`, read as the steps read it.
const tmp = scratchDir("host-test-");
let n = 0;
function scratch(files = {}) {
  const dir = path.join(tmp, `p${n++}`);
  fs.mkdirSync(dir, { recursive: true });
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  return dir;
}
const PIN = "a".repeat(40);
const kitReview = fs.readFileSync("setup/template/workflows/security-review.yml.tmpl", "utf8").replaceAll("{{core}}", CORE).replaceAll("{{pin}}", PIN);
const copy = { "core/.node-version": "22\n", "core/scripts/security-review.mjs": "\n" };
const every = Object.entries({ ...LIST.state, ...LIST.sender, ...LIST.mark }).map(([name, l]) => ({ name, ...l }));
const at = "2026-11-23T05:41:00Z", hoursAgo = h => new Date(Date.parse(at) - h * 3600000).toISOString().replace(/\.\d{3}Z$/, "Z");
const reviewRule = { type: "required_status_checks", parameters: { required_status_checks: [{ context: "core / core" }, { context: "security-review" }] } };

// ---- step 220: the security review's call in a private repository ----
{
  const p = project(scratch({ ...copy, ".github/workflows/security-review.yml": kitReview }));
  const h = (priv, rules) => ({ repo: { body: { private: priv } }, rules: { body: rules } });
  ok(privateReview(p, h(true, [reviewRule]))?.includes("private: true") && privateReview(p, h(false, [reviewRule])) === null && privateReview(p, h(true, [])) === null,
    "step 220: a private repository whose rules require the status, with the kit's call, is told to pass private; a public one, or one that requires none, is done");
  const given = project(scratch({ ...copy, ".github/workflows/security-review.yml": kitReview.replace("      queue: ${{ needs.queue.outputs.head }}", "      queue: ${{ needs.queue.outputs.head }}\n      private: true") }));
  ok(privateReview(given, h(true, [reviewRule])) === null, "step 220: the call given `private: true` is done");
  ok(unread(() => privateReview(p, { repo: { why: "GitHub answered 403" }, rules: { body: [] } })) && unread(() => privateReview(p, { repo: { body: { private: true } }, rules: { why: "no" } })),
    "step 220: no answer for the repository or its rules is not read, never done");
}

// ---- step 310: the owner's inbox ----
{
  const bare = project(scratch()), folder = project(scratch({ "inbox/README.md": "x\n" }));
  ok(inbox(bare, { reach: { yes: true } }) === null && inbox(folder, { reach: { yes: false, why: "its issues are switched off" } }) === null,
    "step 310: done where issues can be written, or where they cannot and the folder inbox/ stands");
  ok(/switched off/.test(inbox(bare, { reach: { yes: false, why: "its issues are switched off" } }) ?? "") && unread(() => inbox(bare, { reach: null })),
    "step 310: no folder where issues cannot be written is a mend that says why; no answer is not read");
}

// ---- steps 320 and 510: the labels ----
{
  const p = project(scratch());
  ok(labels(p, { labels: { body: every } }) === null && /`queued`/.test(labels(p, { labels: { body: every.filter(l => l.name !== "queued") } }) ?? "") && unread(() => labels(p, { labels: { why: "403" } })),
    "step 320: done where every label of the list stands; one missing named; no answer not read");
  ok(correction(p, { labels: { body: [{ name: "Correction" }] } }) === null && /`correction`/.test(correction(p, { labels: { body: [] } }) ?? "") && unread(() => correction(p, { labels: { why: "x" } })),
    "step 510: the label correction found as GitHub compares names; missing said; no answer not read");
}

// ---- step 330: the daily look ----
{
  const p = project(scratch()), record = h => ({ record: { body: recordBody({ at: hoursAgo(h), carrier: "GitHub's daily job" }) }, at });
  const moved = project(scratch({ ".github/workflows/daily.yml": `on: { schedule: [{ cron: "1 1 * * *" }] }\njobs:\n  moved:\n    uses: ${CORE}/.github/workflows/core-moved.yml@${PIN}\n` }));
  ok(daily(p, record(2)) === null && daily(p, { record: { body: "" }, at, looking: true }) === null, "step 330: done where the record shows a run within the day's slack, or the look is reading it");
  ok(/no run in the last 30 hours/.test(daily(p, record(40)) ?? "") && /core-moved\.yml/.test(daily(moved, record(2)) ?? "") && unread(() => daily(p, { record: { why: "403" }, at })),
    "step 330: a run missed, or a workflow that still calls core-moved.yml, is a mend; a record not read is not read");
}

// ---- step 390: secret scanning ----
{
  const p = project(scratch()), on = s => ({ name: "o/r", repo: { body: { security_and_analysis: { secret_scanning: { status: s }, secret_scanning_push_protection: { status: "enabled" } } } } });
  const pub = s => { const h = on(s); h.repo.body.private = false; return h; };
  ok(scanning(p, on("enabled")) === null && /the owner switches both on.*o\/r\/settings\/security_analysis/.test(scanning(p, on("disabled")) ?? "") && /a session whose sign-in may change the repository's settings switches both on.*topic 9/.test(scanning(p, pub("disabled")) ?? "") && unread(() => scanning(p, { repo: { body: {} } })),
    "step 390: on is done; off is a session's in a public repository (floor topic 9) and the owner's otherwise, with its link; shown to admins alone, it is not read");
}

// ---- step 560: the accounts `reviewers` names ----
{
  const call = names => project(scratch({ ".github/workflows/security-review.yml": `on: pull_request\njobs:\n  security-review:\n    uses: ${CORE}/.github/workflows/security-review.yml@${PIN}\n    with:\n      reviewers: ${names}\n` }));
  const right = (login, role) => ({ body: { role_name: role, permission: role === "write" ? "write" : "read", user: { login, type: "User", permissions: { push: role === "write" } } } });
  const p = call("helper-one Mate");
  ok(/`Mate`/.test(reviewers(p, { rights: { "helper-one": right("helper-one", "read"), mate: right("Mate", "write") } }) ?? "") && reviewers(p, { rights: { "helper-one": right("helper-one", "read"), mate: right("Mate", "read") } }) === null,
    "step 560: an account the host lets write is named to take out; one that may not stays");
  ok(unread(() => reviewers(p, { rights: { "helper-one": right("helper-one", "read"), mate: { why: "403" } } })), "step 560: a right GitHub gave no answer for is not read");
}

// ---- steps 600 and 820, and the look's record written and read back ----
{
  const p = project(scratch());
  const body = recordBody({ at, carrier: "GitHub's daily job", looked: hoursAgo(1), hostRead: at });
  ok(lastRun(body) === at && LOOKED.exec(body)?.[1] === hoursAgo(1) && HOST_READ.exec(body)?.[1] === at && !LOOKED.test(recordBody({ at, carrier: "x" })),
    "the record the look writes reads back: its last run, when it looked the packages up and when it read the host");
  ok(lookedUp(p, { record: { body } }) === null && /held\.mjs/.test(lookedUp(p, { record: { body: recordBody({ at, carrier: "x" }) } }) ?? "") && unread(() => lookedUp(p, { record: { why: "x" } })),
    "step 600: done where the record shows the packages looked up; else the look does it on its next run; a record not read is not read");
  ok(hostRead(p, { record: { body } }) === null && hostRead(p, { record: { body: "" }, looking: true }) === null && /look\.yml/.test(hostRead(p, { record: { body: "" } }) ?? ""),
    "step 820: done where the record shows the host read, or the look is reading it");
}

// ---- readHost, on a stand-in: what it asks, and nothing but reads ----
{
  const dir = scratch({ ".github/workflows/security-review.yml": `on: pull_request\njobs:\n  s:\n    uses: ${CORE}/.github/workflows/security-review.yml@${PIN}\n    with:\n      reviewers: Mate\n` });
  const asked = [];
  const answers = {
    "repos/o/r": { default_branch: "main", private: true, has_issues: true, permissions: { push: true } },
    "repos/o/r/rules/branches/main": [reviewRule],
    "repos/o/r/labels?per_page=100&page=1": Array.from({ length: 100 }, (_, i) => ({ name: `l${i}` })),
    "repos/o/r/labels?per_page=100&page=2": every,
    "repos/o/r/issues?state=all&labels=by%3Alook&per_page=100&page=1": [{ number: 9, title: RECORD, state: "closed", body: recordBody({ at, carrier: "c" }), user: { login: BOT } }, { number: 10, title: RECORD, state: "closed", body: "forged", user: { login: "someone" } }],
    "repos/o/r/collaborators/mate/permission": { role_name: "write" },
  };
  const ask = route => { asked.push(route); return route in answers ? { body: answers[route] } : { why: "GitHub answered 403" }; };
  const h = readHost(project(dir), "o/r", { ask, at, env: { TERMS_GIVEN: "true" } });
  ok(h.name === "o/r" && h.labels.body.length === 100 + every.length && lastRun(h.record.body) === at && h.rights.mate.body.role_name === "write" && h.reach.yes === true && h.termsGiven === true,
    "readHost reads the labels page by page, the look's record from its own account's issue alone, each named account's rights, whether issues can be written, and whether the secret is given", JSON.stringify({ ...h, labels: h.labels.body?.length }).slice(0, 400));
  ok(asked.every(r => !/PERSONAL_TERMS$|\/secrets\/[^?]/.test(r) || r.endsWith("/actions/secrets/PERSONAL_TERMS")) && !asked.some(r => /-X|PATCH|POST|PUT|DELETE/.test(r)),
    "readHost asks only to read, a secret by its name at most, never its value", asked.join("\n"));
  const given = readHost(project(dir), "o/r", { ask, at, reach: { yes: false, why: "w" }, record: { body: "x" }, looking: true, env: {} });
  ok(given.reach.yes === false && given.record.body === "x" && given.looking === true && given.termsGiven === null, "readHost takes what the look gives it: the reach, the record and that it is the look reading");

  // the steps with a host and without: host steps run only with one, and one not read is listed, not reported
  const marked = priv => notDone(dir, [{ lead: "s", host: () => "m", owner: scanningOwner }], { repo: { body: { private: priv } } });
  ok(marked(true)[0]?.owner === true && marked(false)[0]?.owner === false && /\(the owner's\)/.test(hostReport(marked(true))) && !/\(the owner's\)/.test(hostReport(marked(false))),
    "a step whose owner depends on the host (step 390) is the owner's in a private repository and a session's in a public one");
  const without = notDone(dir, STEPS), withHost = hostSteps(dir, { ...h, rights: {} });
  const hostLeads = STEPS.filter(s => s.host).map(s => s.lead);
  ok(!without.some(m => hostLeads.includes(m.lead)) && without.hostUnread.length === 0, "without a host, no step read on the host runs");
  ok(withHost.every(m => hostLeads.includes(m.lead)) && withHost.hostUnread.some(u => u.lead === "17 November 2026, a team's owners read from the host" && /rights/.test(u.why)) && !withHost.some(m => m.unread),
    "with a host, the steps read on it run, and one whose answer is missing is listed as not read, never reported", JSON.stringify(withHost.hostUnread));
  ok(/Steps read on the host not done/.test(hostReport(withHost)) && /Not read on the host here/.test(hostReport(withHost)) && /Every step read on the host is done/.test(hostReport(Object.assign([], { hostUnread: [] }))),
    "the report names the steps not done and those not read");
  const unread = hostReport(Object.assign([], { hostUnread: [{ lead: "a step", why: "gh answered for no account" }, { lead: "another", why: "gh answered for no account" }] }));
  ok(!/Every step read on the host is done/.test(unread) && /^No step read on the host here is left undone, but 2 of them were not read here/.test(unread) && /gh answered for no account/.test(unread),
    "where steps were not read, the report never says every one is done, and says how many were not read and why (#1275, point 1)", unread);
}

// ---- the issue "Settings only the owner gives" ----
{
  const dir = scratch();
  const h = (priv, rules, termsGiven = null) => ({ name: "o/r", repo: { body: { private: priv, default_branch: "main" } }, rules: { body: rules }, secrets: { why: "403" }, actions: { why: "403" }, termsGiven });
  const pub = settingsOf(h(false, []), dir), priv = settingsOf(h(true, []), dir), terms = settingsOf(h(false, [], false), dir);
  ok(pub.ruleset.given === false && priv.ruleset.given === null && /does not apply/.test(priv.ruleset.said) && priv["security-review-required"].given === null,
    "the ruleset not given in a public repository is listed; in a private one where no rule applies, it is the owner's choice and not listed");
  ok(terms["personal-terms"].given === false && settingsOf(h(false, [], true), dir)["personal-terms"].given === true && pub["personal-terms"].given === null,
    "the secret PERSONAL_TERMS read from what the look's workflow says, never its value");
  const task = settingsTask("o/r", terms);
  ok(/https:\/\/github\.com\/o\/r\/settings\/rules/.test(task) && /https:\/\/github\.com\/o\/r\/settings\/secrets\/actions/.test(task) && /no agent is asked to give them/.test(task) && /Not read with the job's token[^\n]*`sha-pinning`/.test(task),
    "the task lists each setting not given with its link, names those the token cannot read, and asks no agent to give them", task);
  ok(settingsTask("o/r", priv) === null && /could not be written/.test(settingsTask("o/r", priv, ["The labels could not be written: x."]) ?? ""),
    "with nothing not given and no write refused there is no task (it closes); a write refused alone opens it");
}

// ---- the labels made, and a write refused said ----
{
  const writes = [], gh = (...a) => { if (a[0] === "-X") { writes.push(a.slice(0, 3).join(" ")); return "{}"; } return JSON.stringify(a[0].includes("page=1") ? every.filter(l => l.name !== "queued") : []); };
  const made = makeLabels("o/r", gh, () => {});
  ok(made.join() === "queued" && writes.length === 1 && writes[0] === "-X POST repos/o/r/labels", "the labels the repository lacks are made, and nothing else written", writes.join("\n"));
  let said = null;
  try { makeLabels("o/r", (...a) => { if (a[0] === "-X") throw new Error("gh: Resource not accessible by integration (HTTP 403)"); return "[]"; }, () => {}); } catch (e) { said = refusal("The labels of the core's list", e, "issues: write"); }
  ok(/answered 403/.test(said ?? "") && /`issues: write`/.test(said ?? "") && !/integration/.test(said ?? ""), "a write GitHub refuses is said with the right the job needs, never with gh's own words", said);
}

// ---- the look's reading of the host (look-host.mjs): a label set anew said with what it was, in GitHub's job alone ----
{
  const dir = scratch(), lines = [], writes = [];
  const gh = (...a) => { if (a[0] === "-X") { writes.push(a[2]); return "{}"; } return JSON.stringify(a[0].includes("page=1") ? [...every.filter(l => l.name !== "queued"), { name: "Queued", color: "123456", description: "the project's own" }] : []); };
  const ask = route => route === "repos/o/r" ? { body: { default_branch: "main", private: false } } : { why: "GitHub answered 403" };
  const ctx = { repo: "o/r", manifest: "", job: true, dry: false, at, say: l => lines.push(l) };
  const { host, refused } = hostOf(ctx, { yes: true }, { gh, ask, root: dir });
  ok(host?.name === "o/r" && host.looking === true && HOST_READ.exec(host.record.body)?.[1] === at && !refused.length && writes.length === 1 && lines.some(l => /^Setting queued: it was Queued, colour 123456, "the project's own"\./.test(l)),
    "the look makes the labels first, saying what a label it sets anew was, and reads the host with the record as this run writes it", lines.join("\n"));
  writes.length = 0;
  const outside = hostOf({ ...ctx, job: false }, { yes: true }, { gh, ask, root: dir }), wroteOutside = writes.length;
  const none = hostOf({ ...ctx, manifest: null }, { yes: true }, { gh, ask, root: dir });
  const broken = hostOf(ctx, { yes: true }, { gh, ask: () => { throw new TypeError("x"); }, root: dir });
  ok(!wroteOutside && outside.host?.name === "o/r" && none.host === null && broken.host === null && lines.some(l => /^The host was not read here \(TypeError/.test(l)),
    "outside GitHub's job no label is written; with no manifest the host is not read; a reading that throws is said, not hidden", lines.join("\n"));
}

// ---- each sync prints what host.mjs reads, and that run fails nothing and writes nothing ----
{
  const at = scratch(), host = () => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/host.mjs", import.meta.url))], { cwd: at, encoding: "utf8" });
  const listed = /\["labels\.mjs"\], \["host\.mjs"\]/.test(fs.readFileSync(new URL("../scripts/sync.mjs", import.meta.url), "utf8"));
  const r = host();
  ok(listed && r.status === 0 && /^The host was not read: the origin names no host/.test(r.stdout), "the sync runs host.mjs among its reports, and with no host named it says so and fails nothing", `${r.status} ${r.stdout}${r.stderr}`);
  spawnSync("git", ["remote", "add", "origin", "https://gitlab.example/o/r"], { cwd: at });
  const other = host();
  ok(other.status === 0 && /^The host was not read: the origin is on no github\.com/.test(other.stdout), "an origin on another host is said to be on no github.com", `${other.stdout}${other.stderr}`);
}

// ---- each right of the look's workflows named with what it is for ----
for (const f of [".github/workflows/look.yml", ".github/workflows/own-look.yml", "setup/template/workflows/look.yml.tmpl"]) {
  const lines = fs.readFileSync(f, "utf8").split("\n"), bare = [];
  lines.forEach((l, i) => { if (/^\s+permissions:\s*$/.test(l)) for (let j = i + 1; j < lines.length && /^\s+[a-z-]+: (read|write)\b/.test(lines[j]); j++) if (!/ # \S/.test(lines[j])) bare.push(lines[j].trim()); });
  ok(!bare.length && lines.some(l => /^\s+issues: write # /.test(l)), `${f}: each right its job uses is named with a comment saying what it is for`, bare.join("; "));
}

console.log(`\n${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
