// The scheduled look (modules/orchestrating.md, "The scheduled look"; core archive 218): what has stopped, what is due
// and what is overdue, kept in issues by itself, so that starting an orchestrator is all an owner does and an owner who
// never asks is shown it all the same. Run once a day from a project's root by the project's daily job (the core's
// look.yml, and core-moved.yml for a project that still calls it), on an orchestrator's wake where that job does not
// run it, and in the core by its own workflow (.github/workflows/own-look.yml). Each thing due is one issue it keeps,
// labelled queued and by:look, found again by its title among the issues with that label that the workflow's account
// or the *owner's account* opened, and never opened twice: updated while it stands, reopened when it comes back, a task
// again, its state label set as its reader says (`reopening`), closed with a comment once nothing of it stands. Each is
// a task an agent takes alone; one whose session hands it to the owner is labelled needs-owner, and one its reader says
// is the owner's to see too.
//   - Pull requests that stand idle: every open pull request of this repository's own branches, Dependabot's left out,
//     with no push for longer than stalled.mjs's hours: draft or ready, its checks, what its description says it waits
//     on (pr-description.mjs) and for how long, a draft with green checks first; and one whose line and label
//     needs-owner disagree.
//   - Steps of a release not done (steps.mjs), in a project.
//   - Labels and openers to mend (labels.mjs).
//   - The scheduled look missed a run: where its record shows no run for longer than MISSED hours. The look never
//     closes this one: a session closes it once it has found why.
//   - What the dose makes due (dose.mjs; modules/cleaning.md): cleaning, while the codebase is not in standard, and an
//     audit by a reader, which the look labels needs-owner in place of queued where the project is in debt and its
//     baseline no smaller than at the last audit. What the staged cases make due joins DUE as their rule comes
//     (#235); and of the choices that are hard to undo (choices.mjs), the pass over them twice a year, and a sign
//     written in a measure the shape check keeps, while it holds.
//   - Once a month, the state report (state-report.mjs, beside this file), opened once and not touched again.
// Its record is the body of one closed issue, "The scheduled look's record", which it writes on each run. A run by a
// session (not GitHub's job) where the record shows a run less than SOON hours before does nothing more, so an
// orchestrator's hourly wake makes one look a day. Where this repository's issues cannot be read and written
// (inbox.mjs), what it would open goes to the folder inbox/ instead, one file each: written by --inbox, which a session
// then commits in a pull request of its own; else printed, with that mend. It writes issues and, with --inbox, files
// in inbox/, nothing else, and fails nothing (exit 0), save where it is not run from a repository's root or is given a
// wrong option. gh, git and Node's own modules.
//
//   node core/scripts/look.mjs            the look (GITHUB_REPOSITORY and GH_TOKEN set by GitHub's job; else the
//                                         clone's origin and gh's own sign-in)
//   node core/scripts/look.mjs --dry      what it would open, update, reopen or close; it writes nothing
//   node core/scripts/look.mjs --now      a session's run though the record shows one less than SOON hours before
//   node core/scripts/look.mjs --inbox    where issues cannot be reached, writes what it would open to inbox/
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { look as choicesDue, signs } from "./choices.mjs";
import { CORE } from "./core-address.mjs";
import { auditIsDue, cleaningDue } from "./dose.mjs";
import { answer, FOLDER, repoOf } from "./inbox.mjs";
import { check, gather, ghApi, pagesOf, report as labelsReport, sinceHere } from "./labels.mjs";
import { WAITS, waitsOn } from "./pr-description.mjs";
import { ownerOf } from "./releases.mjs";
import { HOURS, openPulls, stalled } from "./stalled.mjs";
import { started } from "./started.mjs";
import { copies, monthOf, readCounts, shape, body as stateReport, TITLE as REPORT } from "./state-report.mjs";
import { notDone, report as stepsReport } from "./steps.mjs";

export const BOT = "github-actions[bot]";
export const LABELS = ["queued", "by:look"];
export const RECORD = "The scheduled look's record";
// A daily look with a few hours' slack; and how soon a session's run after another does nothing more.
export const MISSED = 30, SOON = 20;
export const TITLES = {
  idle: "Pull requests that stand idle",
  steps: "Steps of a release not done",
  labels: "Labels and openers to mend",
  missed: "The scheduled look missed a run",
};
// The readers of what else is due, each (ctx) => { title, body, unread, owner } or null, a body of null closing the
// issue it keeps and `unread` leaving it as it stands: the pass over the choices that are hard to undo and a sign of
// theirs that has tripped (choices.mjs), the cleaning and the audit the dose makes due (dose.mjs), and, as their rule
// comes, the staged cases (#235). One that says `owner`, true or false, has its issue's state label kept to it:
// needs-owner where true, else queued; one that gives `requeue`, the key of a line of its lists, has it put back to
// queued where an update brings a key the issue did not hold (`updating`).
export const DUE = [choicesDue, signs, cleaningDue, auditIsDue];
export const OWNERS = "needs-owner";
export const dueNow = (ctx, readers = DUE) => readers.map(read => read(ctx)).filter(Boolean).map(d => ({ title: d.title, what: d.body, unread: d.unread ?? null, owner: d.owner, ...(typeof d.requeue === "function" ? { requeue: d.requeue } : {}) }));
const labelsFor = owner => (owner ? [OWNERS, ...LABELS.slice(1)] : LABELS);

// The labels an issue the look keeps should carry where its state label is not the one that fits: the others as they
// stand, and needs-owner or queued; null where they fit already, and where a session gave it another state (later,
// on-hold), which the look leaves as it is.
export function relabelled(labels, owner) {
  const [want, drop] = owner ? [OWNERS, LABELS[0]] : [LABELS[0], OWNERS];
  if (labels.includes("later") || labels.includes("on-hold")) return null;
  return labels.includes(want) && !labels.includes(drop) ? null : [...labels.filter(l => l !== drop && l !== want), want];
}

// What reopening an issue the look keeps writes: its body, open, and, since what came back is a task again, its state
// label as its reader says (needs-owner where the issue is the owner's to see, else queued), whatever a session set
// while it stood before (a tripped sign's needs-owner, say); later and on-hold, a session's own, stay.
export const reopening = (issue, body, owner) => {
  const labels = relabelled(issue.labels ?? [], owner === true);
  return { body, state: "open", ...(labels ? { labels } : {}) };
};

// What updating an issue the look keeps writes: its body, and, for a reader that gives `requeue` (a line's key, null
// for none), queued in place of a needs-owner a session set, where the new body holds a line of a list ("- ") whose key
// the old one did not: something new for a session to take up first (a second choice's sign that trips), never a
// number that moved.
export const updating = (issue, body, requeue = null) => {
  const keys = text => new Set(String(text).split("\n").filter(l => l.startsWith("- ")).map(requeue).filter(k => k !== null));
  const before = requeue ? keys(issue.body ?? "") : new Set();
  const fresh = !!requeue && (issue.labels ?? []).includes(OWNERS) && [...keys(body)].some(k => !before.has(k));
  const labels = fresh ? relabelled(issue.labels, false) : null;
  return { body, ...(labels ? { labels } : {}) };
};

function write(method, route, payload) {
  const r = spawnSync("gh", ["api", "-X", method, route, "--input", "-"], { input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error(`GitHub refused ${method} ${route.replace(/^repos\/[^/]+\/[^/]+\//, "")}`);
  return r.stdout ? JSON.parse(r.stdout) : {};
}

// The state label of an issue the look keeps and still holds open, kept to what its reader says of the owner: what
// was done, as lines for the look's summary.
function relabel({ repo, issue, finding, dry }) {
  if (typeof finding.owner !== "boolean" || !issue || finding.what === null || finding.unread) return [];
  const labels = relabelled(issue.labels, finding.owner);
  if (!labels) return [];
  try { if (!dry) write("PUT", `repos/${repo}/issues/${issue.number}/labels`, { labels }); } catch (e) { return [`  ${e.message}`]; }
  return [`${finding.title}: labelled ${finding.owner ? OWNERS : LABELS[0]} (#${issue.number})`];
}

// The time of the last run its record holds, or null.
export const lastRun = body => /^Last run: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)/m.exec(String(body ?? ""))?.[1] ?? null;

// Hours from one time to another, as a number with one decimal.
const hoursBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 360000) / 10;

// A pull request's checks, from its head commit's check runs and its combined commit status (the reviews' statuses,
// security-review and code-review among them) as GitHub gives them: green where every one ended well, red where one
// failed, waiting while one runs or a status is pending, none where there are none.
export function checksOf(runs, status = null) {
  const states = status && status.total_count > 0 ? [status.state] : [];
  if (!runs.length && !states.length) return "none";
  if (runs.some(r => ["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"].includes(r.conclusion)) || states.some(s => s === "failure" || s === "error")) return "red";
  if (runs.some(r => r.status !== "completed") || states.includes("pending")) return "waiting";
  return "green";
}

const plain = text => String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, 200);

// The idle list: `lanes` as stalled() gives them, each with `checks`. Drafts with green checks first, then the rest,
// longest idle first; each line says draft or ready, its checks, what it waits on and for how long, and where its
// line and the label needs-owner disagree, that mend.
export function idleBody(lanes, hours) {
  const first = l => (l.draft && l.checks === "green" ? 0 : 1);
  const sorted = [...lanes].sort((a, b) => first(a) - first(b) || b.waited - a.waited);
  return [`Every open pull request of this repository's own branches with no push for over ${hours} h (\`core/scripts/look.mjs\`). A draft with green checks is named first: it is the shape of a session that finished and stopped. Each is a task an agent takes alone: the lane goes on, is handed to a fresh builder from its branch, or, where it waits on the owner, waits with its question asked.`,
    "",
    ...sorted.map(l => {
      const w = waitsOn(l.body);
      // (a description's words as a code span, so they read as data and name no one)
      const quoted = text => `\`${plain(text).replace(/`/g, "'")}\``;
      const says = w ? (w.kind ? `waits on ${quoted(w.said)}` : `its line ${quoted(`${WAITS} ${w.said}`)} is in none of the forms`) : `says nothing of what it waits on`;
      const owner = w?.kind === "the owner", labelled = (l.labels ?? []).includes("needs-owner");
      const mend = owner && !labelled ? "; to label needs-owner" : !owner && labelled ? "; to take needs-owner off, or say the owner's question in its line" : "";
      return `- #${l.number} (${l.draft ? "draft" : "ready"}, checks ${l.checks}): ${says}; ${l.waited.toFixed(1)} h since its last push${mend}.`;
    })].join("\n");
}

// What to do with one kind: `finding` its new body or null (nothing stands), `unread` where it could not be read,
// `issue` the one it keeps ({ number, state, body }) or null. Closing never happens on what could not be read.
export function plan(finding, issue, unread = false) {
  if (unread) return "nothing";
  if (finding === null) return issue?.state === "open" ? "close" : "nothing";
  if (!issue) return "open";
  if (issue.state !== "open") return "reopen";
  return issue.body === finding ? "nothing" : "update";
}

// The issues the look keeps, from those labelled by:look: opened by GitHub's job or by the owner's account (a session's
// run), the newest of each title; and in `twins`, the older ones of a title still open, which two runs at once (GitHub's
// job and an orchestrator's) can leave, for the look to close.
export function mine(issues, owner) {
  const by = new Map(), twins = [];
  for (const i of [...issues].sort((a, b) => a.number - b.number)) {
    const login = String(i.user?.login ?? "");
    if (i.pull_request || !(login === BOT || login.toLowerCase() === String(owner).toLowerCase())) continue;
    const was = by.get(i.title);
    if (was?.state === "open") twins.push(was);
    by.set(i.title, { number: i.number, state: i.state, body: i.body ?? "", created_at: i.created_at, labels: (i.labels ?? []).map(l => l.name ?? l) });
  }
  return Object.assign(by, { twins });
}

// An issue's text as the look writes it: what it is, then where it was found and its attribution line.
const SIGNED = `---\n_Generated by [the scheduled look](https://github.com/${CORE}/blob/main/scripts/look.mjs)_\n`;
export const text = (what, carrier) => `${what}\n\nThe task is what the look finds again on the default branch (\`look.mjs --dry\`, and the script named above), not this text.\n\nFound while: the scheduled look (${carrier}).\n\n${SIGNED}`;

// What a finding becomes as a file of the owner's inbox (inbox.mjs's format), where issues cannot be reached.
export const inboxFile = (title, what, carrier) => `State: queued\nBy: look\n\n**What it is**\n${title}. ${what}\n\n**Why it matters**\nThe scheduled look keeps it in place of an issue, since issues cannot be read and written here; it is a task an agent takes alone.\n\nFound while: the scheduled look (${carrier}).\n`;
export const slug = title => `look-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;

function main(args) {
  const known = ["--dry", "--now", "--inbox"];
  const odd = args.find(a => !known.includes(a));
  if (odd) { console.error(`FAIL: ${odd} is no option of the look's (${known.join(", ")})`); return 1; }
  const dry = args.includes("--dry"), now = args.includes("--now"), toInbox = args.includes("--inbox");
  const below = spawnSync("git", ["rev-parse", "--show-prefix"], { encoding: "utf8" });
  if (below.status !== 0 || below.stdout.trim() !== "") { console.error("FAIL: run it from the root of the project's git repository"); return 1; }
  const job = process.env.GITHUB_ACTIONS === "true";
  const carrier = job ? "GitHub's daily job" : "a session's run";
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  let manifest = null;
  try { manifest = fs.readFileSync("core-manifest.md", "utf8"); } catch { /* (the core itself) */ }
  const repo = job && /^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY ?? "") ? process.env.GITHUB_REPOSITORY
    : repoOf(spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).stdout);
  const owner = ownerOf(manifest ?? "") ?? repo?.split("/")[0] ?? "";
  const scripts = manifest === null ? "scripts" : "core/scripts";
  const say = line => { console.log(line); if (job && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`); };

  // whether issues can be read and written here, as inbox.mjs asks it: no answer, nothing is done
  let reach;
  if (!repo) reach = { yes: false, why: "its origin is not on github.com" };
  else {
    let got = null, refused = false;
    try { got = JSON.parse(ghApi(`repos/${repo}`)); } catch (e) { refused = /\bHTTP 404\b/.test(String(e.message)); }
    reach = got && typeof got === "object" && got.permissions ? answer(got) : refused ? { yes: false, why: "GitHub finds no such repository for this account" } : null;
  }
  if (!reach) { say(`The scheduled look could not ask GitHub here (gh is not installed, answers for no account, or gave no answer): nothing was looked at. Run \`node ${scripts}/look.mjs\` where gh answers.`); return 0; }

  // the record, and whether a session's run is due
  let kept = new Map();
  if (reach.yes) {
    try { kept = mine(pagesOf(`repos/${repo}/issues?state=all&labels=by%3Alook`), owner); } catch { say("The issues the scheduled look keeps could not be read: nothing was looked at."); return 0; }
  }
  const record = kept.get(RECORD) ?? null, last = lastRun(record?.body);
  if (!job && !now && last && hoursBetween(last, at) < SOON) { say(`The scheduled look ran ${hoursBetween(last, at)} h ago (${last}): nothing more to do until ${SOON} h have passed.`); return 0; }

  const findings = [];
  const add = (title, what, unread = null) => findings.push({ title, what, unread });
  // pull requests that stand idle
  try {
    const api = (route, jq) => ghApi(route, "--jq", jq);
    const lanes = stalled(openPulls(repo, api), Date.now(), HOURS);
    for (const l of lanes) {
      try { l.checks = checksOf(pagesOf(`repos/${repo}/commits/${l.sha}/check-runs`, (...a) => JSON.stringify(JSON.parse(ghApi(...a)).check_runs ?? [])), JSON.parse(ghApi(`repos/${repo}/commits/${l.sha}/status`))); }
      catch { l.checks = "not read (the token may not read checks and statuses)"; }
    }
    add(TITLES.idle, lanes.length ? idleBody(lanes, HOURS) : null);
  } catch {
    add(TITLES.idle, null, `the open pull requests could not be read: the token here may not read them. A project's daily job reads them where it calls the core's \`look.yml\` with \`pull-requests: read\`, \`checks: read\` and \`statuses: read\`, as \`core/setup/template/workflows/look.yml.tmpl\` has it`);
  }
  // steps of a release not done, in a project
  let stepsLeft = null;
  if (manifest !== null) {
    try { const missed = notDone(process.cwd()); stepsLeft = missed.length; add(TITLES.steps, missed.length ? `${stepsReport(missed)}\n\nEach step is a task an agent takes alone, in a pull request of its own; one marked the owner's is labelled needs-owner and the rest go on.` : null); }
    catch { add(TITLES.steps, null, "the steps could not be read here"); }
  }
  // labels and openers
  if (reach.yes) {
    try { const since = sinceHere(), found = check({ ...gather(repo, since), owner, since }); add(TITLES.labels, found.length ? labelsReport(found, repo) : null); }
    catch { add(TITLES.labels, null, "the labels and openers could not be read"); }
  }
  // a missed run
  if (last && hoursBetween(last, at) > MISSED) add(TITLES.missed, `The look before this one ran at ${last}, ${hoursBetween(last, at)} h before this run at ${at}: over ${MISSED} h. Find why and mend it, then close this issue: GitHub switches a scheduled workflow off after 60 days with no activity in the repository (\`gh workflow enable\` turns it back on, as an orchestrator's wake does), a run can fail, and an orchestrator that carries the look may not have woken.`);
  // what else is due, as each rule that sets it comes
  findings.push(...dueNow({ repo, manifest, at }));

  // the state report, once a month
  const month = monthOf(at), reportTitle = `${REPORT}, ${month}`;
  let monthly = null;
  // (in the inbox, a month's report is written once: while no commit has held its file)
  const reportFile = path.join(FOLDER, slug(reportTitle));
  const written = !reach.yes && spawnSync("git", ["log", "--all", "--format=%H", "-1", "--", reportFile], { encoding: "utf8" }).stdout.trim() !== "";
  if (reach.yes ? !kept.has(reportTitle) : !written && !fs.existsSync(reportFile)) {
    const previous = [...kept.entries()].filter(([t]) => t.startsWith(`${REPORT}, `) && t < reportTitle).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[1] ?? null;
    // (open since its last reopening, where the look reopened it: a task that came back is not one that stood)
    const since = i => { try { return pagesOf(`repos/${repo}/issues/${i.number}/events`).filter(e => e.event === "reopened").map(e => e.created_at).sort().at(-1) ?? i.created_at; } catch { return i.created_at; } };
    const overdue = [...kept.entries()].filter(([t, i]) => i.state === "open" && t !== RECORD && !t.startsWith(`${REPORT}, `) && hoursBetween(i.created_at, at) > 7 * 24)
      .map(([t, i]) => ({ number: i.number, title: t, since: since(i) })).filter(o => hoursBetween(o.since, at) > 7 * 24);
    const counts = manifest === null ? null : readCounts({ repo, manifest, month, steps: stepsLeft });
    monthly = stateReport({ core: manifest === null, month, measures: copies(process.cwd(), manifest), shape: shape(process.cwd(), manifest), previous: previous?.body ?? null, overdue, counts, scripts });
  }

  // what is done with each
  if (!reach.yes) {
    say(`Issues cannot be read and written here (${reach.why}), so what the scheduled look would open goes to \`${FOLDER}/\`, one file each${toInbox ? "" : ": a session runs `node " + scripts + "/look.mjs --inbox` and commits them in a pull request of its own"}.`);
    for (const f of findings) {
      const file = path.join(FOLDER, slug(f.title));
      if (f.unread) { say(`- ${f.title}: not read (${f.unread}).`); continue; }
      if (f.what === null) {
        if (fs.existsSync(file)) { say(`- ${f.title}: nothing stands; ${file} goes.`); if (toInbox && !dry) fs.rmSync(file); }
        continue;
      }
      const content = inboxFile(f.title, f.what, carrier);
      say(`- ${f.title}: ${file}${toInbox && !dry ? " written" : ""}.`);
      if (toInbox && !dry) { fs.mkdirSync(FOLDER, { recursive: true }); fs.writeFileSync(file, content); } else if (!toInbox) say(content);
    }
    if (monthly) {
      say(`- ${reportTitle}: ${reportFile}${toInbox && !dry ? " written" : ""}.`);
      const content = inboxFile(reportTitle, monthly, carrier);
      if (toInbox && !dry) { fs.mkdirSync(FOLDER, { recursive: true }); fs.writeFileSync(reportFile, content); } else if (!toInbox) say(content);
    }
    say("Its record is kept in an issue, so here no run is recorded and none is said missed: the session that runs it on its wake is the record.");
    return 0;
  }
  const close = (number, why) => {
    write("POST", `repos/${repo}/issues/${number}/comments`, { body: `From the scheduled look: ${why}\n\n${SIGNED}` });
    write("PATCH", `repos/${repo}/issues/${number}`, { state: "closed", state_reason: "completed" });
  };
  const did = [];
  const act = (title, body, issue, unread, { closes = true, labels = LABELS, requeue = null } = {}) => {
    const step = plan(body, issue, unread);
    const shown = step === "close" && !closes ? "nothing" : step;
    did.push(`${title}: ${unread ? `not read (${unread})` : shown}${issue ? ` (#${issue.number})` : ""}`);
    if (dry || shown === "nothing") return;
    try {
      // (an owner GitHub will not let be assigned here leaves the issue unassigned, never unopened)
      if (shown === "open") try { write("POST", `repos/${repo}/issues`, { title, body, labels, assignees: owner ? [owner] : [] }); } catch { write("POST", `repos/${repo}/issues`, { title, body, labels }); }
      else if (shown === "update") write("PATCH", `repos/${repo}/issues/${issue.number}`, updating(issue, body, requeue));
      else if (shown === "reopen") write("PATCH", `repos/${repo}/issues/${issue.number}`, reopening(issue, body, labels.includes(OWNERS)));
      else if (shown === "close") close(issue.number, "nothing of this stands today, so this closes; it opens again if it comes back.");
    } catch (e) { did.push(`  ${e.message}`); }
  };
  // (an older twin of an issue it keeps, left by two runs at once, is closed: never a second issue for the same thing)
  for (const t of kept.twins ?? []) {
    did.push(`a second issue of the same thing: closed (#${t.number})`);
    if (!dry) try { close(t.number, "another issue of the look's holds this same thing, so this one closes."); } catch (e) { did.push(`  ${e.message}`); }
  }
  for (const f of findings) { act(f.title, f.what === null ? null : text(f.what, carrier), kept.get(f.title) ?? null, f.unread, { closes: f.title !== TITLES.missed, labels: labelsFor(f.owner), requeue: f.requeue }); did.push(...relabel({ repo, issue: kept.get(f.title), finding: f, dry })); }
  if (monthly) act(reportTitle, text(monthly, carrier), null, null);
  // the record, written last: a closed issue of its own
  const recordBody = `The scheduled look's own record (\`core/scripts/look.mjs\`): when it last ran, so that the next run says where one was missed. Nothing to do here; it stays closed.\n\nLast run: ${at} (${carrier}).\n`;
  if (!dry) {
    try {
      if (record) write("PATCH", `repos/${repo}/issues/${record.number}`, { body: recordBody, state: "closed" });
      else { const made = write("POST", `repos/${repo}/issues`, { title: RECORD, body: recordBody, labels: ["by:look"] }); if (made.number) write("PATCH", `repos/${repo}/issues/${made.number}`, { state: "closed", state_reason: "completed" }); }
    } catch (e) { did.push(`the record: ${e.message}`); }
  }
  say(`The scheduled look in ${repo}, ${at}${dry ? " (dry: nothing written)" : ""}:\n${did.map(d => `- ${d}`).join("\n")}`);
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
