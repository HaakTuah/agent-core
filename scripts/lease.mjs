// The orchestrator's lease (core/tasks/tools.md, "One orchestrator works a queue"; #1106): one issue of the project's,
// opened by the *owner's account* under the lease's title and labelled as labels.json's state marked `lease` (the label
// alone never makes one: any account that can write sets it), locked as it opens, whose newest lease comment names the session that holds the queue, its tool and how many
// builders it had running, its time the host's own (the comment's creation), and whose current text is the
// orchestrator's hand-off. Only comments the *owner's account* wrote are read: any other account's, and a session's word
// beyond what the issue shows, decide nothing (floor rule 4). GitHub's answers are untrusted (floor rule 4): each comment
// is read by its lines' form, a session's name and a tool's in a form of their own, and only the repository's name, an
// issue's number and a time in its form reach gh's route.
//   - At a wake (--session): where another session's lease is fresh (younger than TERM_HOURS), or a hand-over note newer
//     than the newest lease names another or replaced this session's own lease, it prints "Stop:" and ends with 2, so the orchestrator deletes every wake of
//     its own and stops; else it writes its lease comment (renewing its own, or claiming a stale one, or one handed to it
//     or to any) and ends with 0. Where no lease issue stands, it opens one first, its text the hand-off's frame, and
//     locks it, saying so where it cannot and going on. Where gh acts as another account than the owner's, it writes
//     nothing: another session's fresh lease still stops the wake, and else the wake goes on without one, so such a
//     session neither opens an issue at each wake nor takes another's lease; a hand-over from it fails.
//   - Where no lease can stand (no repository on github.com, issues switched off, no gh here) it says so and ends with
//     0: the wake goes on without one ("Nothing locks a project"). Any other failure ends with 1: this wake works no
//     lane and keeps its next.
//   - Read alone (no --session): who holds the lease, its tool, its last wake and how long ago, whether that is over
//     COLD_MINUTES old (the holder's cache lapsed) and whether it had builders running, and so whether a new orchestrator
//     may be started; it writes nothing. Whoever starts one (the owner, the adviser) reads it first.
//   - --hand-over <session or "any">: the hand-over note, written by whoever starts a fresh orchestrator in place of a
//     cold one, or by an orchestrator that stops keeping no wake; the session it names, or with "any" the next that
//     wakes save the holder it replaced, takes the lease.
//   - For the scheduled look (`dueIssue`, look.mjs): over the last LOOK_HOURS, a lease renewed by two sessions (a lease
//     of one session while another's was fresh, with no hand-over note between that names it or any), and a holder's
//     wakes more than COLD_MINUTES apart while it had builders running.
// It writes on the host only the lease comment, the hand-over note and the lease issue, and only where it is run with
// --session or --hand-over. Comments are read from the newest back, at most PAGES pages, never failing past them.
// Node's own modules and gh.
//
//   node core/scripts/lease.mjs                                  who holds the lease, and whether one may be started
//   node core/scripts/lease.mjs --session <id> --tool <t> [--builders <n>]   at a wake: renew, claim, or Stop
//   node core/scripts/lease.mjs --hand-over <id or any> [--tool <t>]   hand the lease over
//   ... [--repo <owner>/<name>] [--owner <login>]               the repository and the owner's account, where not read
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { CORE } from "./core-address.mjs";
import { aLogin, aRepository, oneLine, parseBounded } from "./guards.mjs";
import { repoOf } from "./inbox.mjs";
import { LIST } from "./labels.mjs";
import { timeOf } from "./moment.mjs";
import { ownerOf, plainEnv } from "./releases.mjs";
import { started } from "./started.mjs";

export const LABEL = Object.keys(LIST.state).find(s => LIST.state[s].lease === true);
export const ISSUE_TITLE = "The orchestrator's lease and hand-off";
export const TITLE = "The orchestrator's lease shows two holders or a late wake";
// A lease is fresh this long after its holder's last wake (a few hours, a first guess); a holder's cache lapses an
// hour after its last step; the look reads this far back; the most comments read.
export const TERM_HOURS = 3, COLD_MINUTES = 60, LOOK_HOURS = 26, PAGES = 10;
const HOUR = 3600000, MINUTE = 60000;
const SESSION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/u, TOOL = /^[a-z][a-z0-9-]{0,39}$/u;
export const OPENER = "From the orchestrator, on its lease:";

// The attribution line each text it writes ends with (floor rule 4: an agent's text under the owner's account says so,
// and is never read as the owner's own word), naming the tool of the session that ran it where it is given.
export const signed = tool => `\n\n---\n_Generated by [the core's lease script, for ${tool ? `a ${tool} session` : "a session"}](https://github.com/${CORE}/blob/main/scripts/lease.mjs)_`;
// The lease comment and the hand-over note as the script writes them, and as `entryOf` reads them back.
export const leaseText = ({ session, tool, builders }) => [OPENER, `Lease: ${session}`, `Tool: ${tool}`, `Builders: ${builders}`].join("\n") + signed(tool);
export const handOverText = (to, opener = OPENER, tool = null) => [opener, `Hand-over: ${to}`].join("\n") + signed(tool);

const valueOf = (lines, key) => {
  const found = lines.filter(l => l.startsWith(`${key}: `));
  return found.length === 1 ? found[0].slice(key.length + 2).trim() : null;
};

const sameLogin = (a, b) => Boolean(a) && Boolean(b) && String(a).toLowerCase() === String(b).toLowerCase();

// A comment's lines and the host's time where the owner's account wrote it, in a size the reader takes; else null.
function authored(comment, owner) {
  if (!sameLogin(comment?.user?.login, owner)) return null;
  const at = timeOf(comment.created_at);
  if (at === null || typeof comment.body !== "string" || comment.body.length > 4000) return null;
  return { at, lines: comment.body.split(/\r?\n/u).map(l => l.trim()) };
}

// A lease's lines read as { kind: "lease", session, tool, builders, at }, or null where one is out of its form.
function leaseOf(lines, session, at) {
  const tool = valueOf(lines, "Tool") ?? "", builders = Number(valueOf(lines, "Builders"));
  const fits = SESSION.test(session) && TOOL.test(tool) && Number.isInteger(builders) && builders >= 0 && builders <= 999;
  return fits ? { kind: "lease", session, tool, builders, at } : null;
}

// A comment read as { kind: "lease", session, tool, builders, at } or { kind: "hand-over", to, at }, or null: one the
// owner's account did not write, one with no time of the host's, and one whose lines are of neither form (both, or a
// key twice, is neither).
export function entryOf(comment, owner) {
  const got = comment && typeof comment === "object" ? authored(comment, owner) : null;
  if (!got) return null;
  const session = valueOf(got.lines, "Lease"), to = valueOf(got.lines, "Hand-over");
  if (session !== null && to === null) return leaseOf(got.lines, session, got.at);
  const handed = to !== null && session === null && (to === "any" || SESSION.test(to));
  return handed ? { kind: "hand-over", to, at: got.at } : null;
}

export const entriesOf = (comments, owner) => (Array.isArray(comments) ? comments : []).map(c => entryOf(c, owner)).filter(Boolean).sort((a, b) => a.at - b.at);

const ago = (at, now) => Math.max(0, Math.round((now - at) / MINUTE));

// Who holds the lease at `now`, from the entries (entriesOf): { holder, tool, builders, at, minutes, fresh, cold,
// handedTo } where a lease stands (handedTo: the session or "any" a hand-over note newer than it names), else null.
export function holding(entries, now) {
  const lease = [...entries].reverse().find(e => e.kind === "lease") ?? null;
  const note = [...entries].reverse().find(e => e.kind === "hand-over" && (!lease || e.at > lease.at)) ?? null;
  if (!lease && !note) return null;
  const base = lease ? { holder: lease.session, tool: lease.tool, builders: lease.builders, at: lease.at, minutes: ago(lease.at, now) } : { holder: null, tool: null, builders: 0, at: note.at, minutes: ago(note.at, now) };
  return { ...base, fresh: now - base.at < TERM_HOURS * HOUR, cold: now - base.at > COLD_MINUTES * MINUTE, handedTo: note?.to ?? null, noteAt: note?.at ?? null };
}

// What a wake of session `me` does: { act: "renew" | "claim" | "stop", why }.
export function decide(entries, me, now) {
  const h = holding(entries, now);
  if (!h) return { act: "claim", why: "no lease stands" };
  if (h.handedTo !== null) {
    if (h.handedTo === me) return { act: "claim", why: "the lease was handed over to this session" };
    if (h.holder === me) return { act: "stop", why: "a hand-over note newer than this session's lease replaced it" };
    if (h.handedTo === "any") return { act: "claim", why: "the lease was handed over to the next that wakes" };
    if (now - h.noteAt < TERM_HOURS * HOUR) return { act: "stop", why: `a hand-over note names ${h.handedTo}` };
    return { act: "claim", why: `the hand-over note to ${h.handedTo} is over ${TERM_HOURS} hours old and it never took the lease` };
  }
  if (h.holder === me) return { act: "renew", why: "this session holds the lease" };
  if (h.fresh) return { act: "stop", why: `${h.holder} (${h.tool}) holds the lease, its last wake ${h.minutes} minutes ago` };
  return { act: "claim", why: `the lease of ${h.holder} is stale, its last wake ${h.minutes} minutes ago` };
}

// The lines read alone print: who holds it and whether a new orchestrator may be started.
export function said(h) {
  if (!h) return ["No lease stands: a new orchestrator may be started."];
  const when = new Date(h.at).toISOString().replace(/\.\d{3}Z$/u, "Z");
  const out = h.holder ? [`Held by ${h.holder} (${h.tool}), its last wake ${when}, ${h.minutes} minutes ago, with ${h.builders} builder${h.builders === 1 ? "" : "s"} running.`] : [];
  if (h.handedTo) out.push(`Handed over to ${h.handedTo === "any" ? "the next that wakes" : h.handedTo}: ${h.handedTo === "any" ? "a new orchestrator may be started" : "only that session takes it"}.`);
  else if (!h.fresh) out.push(`The lease is stale (over ${TERM_HOURS} hours): a new orchestrator may be started.`);
  else if (h.cold && h.builders === 0) out.push(`Its last wake is over an hour old and it had no builder running, so its cache has lapsed: whoever resumes the work writes \`--hand-over any\` (or the fresh session's name, where known), which stops the old one, and starts a fresh orchestrator from the hand-off, never waking the old one.`);
  else if (h.cold) out.push(`Its last wake is over an hour old, but it had builders running, which report to it: do not replace it; wake it.`);
  else out.push("Its last wake is within the hour: do not start another.");
  return out;
}

// What the look reports over the entries since `from`: the leases taken while another's was fresh with no note that
// named the new holder or any, and a holder's wakes more than COLD_MINUTES apart while it had builders running.
export function faults(entries, from) {
  const out = [];
  let held = null, note = null;
  for (const e of entries) {
    if (e.kind === "hand-over") { note = e; continue; }
    if (held && e.at >= from) {
      const handed = note && note.at > held.at && (note.to === e.session || note.to === "any");
      if (held.session !== e.session && e.at - held.at < TERM_HOURS * HOUR && !handed) out.push(`renewed by two sessions: ${e.session} took the lease ${ago(held.at, e.at)} minutes after ${held.session}'s wake, with no hand-over note between`);
      if (held.session === e.session && held.builders > 0 && e.at - held.at > COLD_MINUTES * MINUTE) out.push(`${e.session}'s wakes ${ago(held.at, e.at)} minutes apart while ${held.builders} builder${held.builders === 1 ? "" : "s"} ran`);
    }
    held = e;
    note = null;
  }
  return out;
}

const plain = route => route.split("?")[0];
// (gh not here at all is no failure of the host's: no lease can stand where it is not, `absent`)
const ghFailed = (r, what, route) => Object.assign(new Error(`gh could not ${what} ${plain(route)}: ${oneLine(String(r.stderr || r.error || "")).trim().slice(0, 200)}`), { absent: r.error?.code === "ENOENT" });
const ghRead = route => {
  const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 24, timeout: 60000, env: plainEnv() });
  if (r.status !== 0) throw ghFailed(r, "read", route);
  return parseBounded(r.stdout);
};
const ghWrite = (route, payload, method = "POST") => {
  const r = spawnSync("gh", ["api", "-X", method, route, "--input", "-"], { input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 1 << 24, timeout: 60000, env: plainEnv() });
  if (r.status !== 0) throw ghFailed(r, "write", route);
  return r.stdout.trim() ? parseBounded(r.stdout) : null;
};

// The lease issues among the host's answer: open issues, no pull request, each opened by the owner's account under the
// lease's title (the label the query asks never enough), lowest number first.
export const leaseIssues = (got, owner) => (Array.isArray(got) ? got : [])
  .filter(i => i && !i.pull_request && Number.isInteger(i.number) && i.number > 0 && i.title === ISSUE_TITLE && sameLogin(i.user?.login, owner))
  .sort((a, b) => a.number - b.number);

// The host as the script reads and writes it: the repository's answer, the login gh acts as, the lease issues, an
// issue's comments from the newest back to the first older than `since` (an ISO time), at most PAGES pages, and the
// lease issue opened and locked ({ number, locked, why }).
export function hostOf(repo, read = ghRead, write = ghWrite) {
  if (!aRepository(repo)) throw new Error("no repository in the form owner/name");
  return {
    repository: () => read(`repos/${repo}`),
    login: () => read("user")?.login ?? null,
    issues: owner => (aLogin(owner) ? leaseIssues(read(`repos/${repo}/issues?labels=${LABEL}&state=open&creator=${owner}&per_page=100`), owner) : []),
    comments: (issue, since) => {
      const from = timeOf(since) ?? 0, count = issue?.comments;
      const last = Number.isInteger(count) && count > 0 ? Math.ceil(count / 100) : 1;
      const rows = [];
      for (let page = last; page >= 1 && page > last - PAGES; page--) {
        const got = read(`repos/${repo}/issues/${issue.number}/comments?per_page=100&page=${page}`);
        if (!Array.isArray(got)) throw new Error("GitHub gave no list of comments");
        rows.unshift(...got);
        if (got.some(c => (timeOf(c?.created_at) ?? 0) < from)) break;
      }
      return rows;
    },
    open: tool => {
      const got = write(`repos/${repo}/issues`, { title: ISSUE_TITLE, labels: [LABEL, `by:${LABEL}`], body: frame() + signed(tool) });
      if (!Number.isInteger(got?.number) || got.number < 1) throw new Error("GitHub gave no issue's number for the lease issue it opened");
      try { write(`repos/${repo}/issues/${got.number}/lock`, {}, "PUT"); return { number: got.number, comments: 0, locked: true, why: "" }; }
      catch (e) { return { number: got.number, comments: 0, locked: false, why: oneLine(String(e.message)).slice(0, 200) }; }
    },
    comment: (number, body) => write(`repos/${repo}/issues/${number}/comments`, { body }),
  };
}

// The hand-off's frame, the lease issue's first text, which the orchestrator keeps current at each change.
export const frame = () => [
  "This is the issue's current text.",
  "",
  "The orchestrator's lease and hand-off (core/tasks/tools.md, \"One orchestrator works a queue\"): its newest lease comment names the session that holds the queue; this text is the hand-off, kept current at each change, from which a new orchestrator takes up alone.",
  "",
  "**Lanes and their pull requests, and what each waits on:** none yet.",
  "**Orders for now in force:** none.",
  "**Next:** the first wake's work.",
  "",
  "Found while: an orchestrator's first wake, taking the lease.",
].join("\n");

const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/u, "Z");

// The scheduled look's reader (look.mjs, DUE): its issue while a fault of the last LOOK_HOURS stands, closed once none
// does; none at all where no lease issue stands, or no repository on the host is named.
export function dueIssue({ repo, owner, at }, host = () => hostOf(repo)) {
  if (!aRepository(repo ?? "")) return null;
  try {
    const now = timeOf(at) ?? Date.now();
    const h = host();
    const issue = h.issues(owner)[0];
    if (!issue) return null;
    const from = now - LOOK_HOURS * HOUR;
    const found = faults(entriesOf(h.comments(issue, iso(from - TERM_HOURS * HOUR)), owner), from);
    if (!found.length) return { title: TITLE, body: null };
    return {
      title: TITLE, owner: false,
      body: [
        `The orchestrator's lease (#${issue.number}; \`node core/scripts/lease.mjs\`; core/tasks/tools.md, "One orchestrator works a queue") shows, over the last ${LOOK_HOURS} hours:`,
        "",
        ...found.map(f => `- ${f}`),
        "",
        "A task the orchestrator takes: find why from its wakes and the sessions running (two orchestrators on one queue: the one that does not hold the lease deletes its wakes and stops; a late wake: its wake comes within the cache's hour while a builder runs), and close this issue once it is mended.",
      ].join("\n"),
    };
  } catch (e) { return { title: TITLE, body: null, unread: `the orchestrator's lease could not be read: ${oneLine(String(e.message)).slice(0, 200)}` }; }
}

const KEYS = { "--session": "session", "--tool": "tool", "--builders": "builders", "--hand-over": "handOver", "--repo": "repo", "--owner": "owner" };
// What makes the options wrong, each with what it says: the first that holds fails them.
const WRONG = [
  [o => o.session !== null && !SESSION.test(o.session), "--session is no session's name: letters, digits and _ . : - alone, at most 100"],
  [o => o.session !== null && !TOOL.test(o.tool ?? ""), "--session needs --tool, the tool's name in lower case (claude, codex)"],
  [o => o.tool !== null && !TOOL.test(o.tool), "--tool is the tool's name in lower case (claude, codex)"],
  [o => !Number.isInteger(o.builders) || o.builders < 0 || o.builders > 999, "--builders is a whole number of builders running"],
  [o => o.handOver !== null && o.handOver !== "any" && !SESSION.test(o.handOver), "--hand-over names a session, or any"],
  [o => o.handOver !== null && o.session !== null, "--hand-over and --session go apart"],
  [o => o.repo !== null && !aRepository(o.repo), "--repo is owner/name"],
  [o => o.owner !== null && !aLogin(o.owner), "--owner is an account's login"],
];

// The options, or { fail }.
export function optionsOf(argv) {
  const o = { session: null, tool: null, builders: 0, handOver: null, repo: null, owner: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = KEYS[argv[i]], value = argv[i + 1];
    if (!key) return { fail: `${oneLine(argv[i])} is no option of this script (${Object.keys(KEYS).join(", ")})` };
    if (value === undefined || value.startsWith("--")) return { fail: `${argv[i]} needs a value` };
    o[key] = key === "builders" ? Number(value) : value;
  }
  const wrong = WRONG.find(([holds]) => holds(o));
  return wrong ? { fail: wrong[1] } : o;
}

function repoHere() {
  if (process.env.GITHUB_ACTIONS === "true" && aRepository(process.env.GITHUB_REPOSITORY ?? "")) return process.env.GITHUB_REPOSITORY;
  return repoOf(spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8", env: plainEnv() }).stdout);
}
const manifestOwner = () => { try { return ownerOf(fs.readFileSync("core-manifest.md", "utf8")); } catch { return null; } };

// The line printed where no lease can stand, and the wake goes on ("Nothing locks a project").
export const noLease = why => `No lease can stand here: ${why}. The wake goes on without one, saying so in its report.`;

// Whether a lease can stand here, and as whom the script writes: { code } where the run ends there (issues switched
// off, or a hand-over from another account), else { as }: null where gh acts as the owner's account (read alone, it
// writes nothing and asks not), else what it acts as.
function standing(h, o, print) {
  const got = h.repository();
  if (got && typeof got === "object" && got.has_issues === false) { print(noLease("its issues are switched off")); return { code: 0 }; }
  const login = o.session !== null || o.handOver !== null ? h.login() : o.who;
  const as = sameLogin(login, o.who) ? null : `gh acts as ${aLogin(login ?? "") ? login : "no account it could name"}, not the owner's account ${o.who}`;
  if (as && o.handOver !== null) { console.error(`FAIL: ${as}, so it wrote no hand-over note. Mend: sign gh in as ${o.who}, then run it again`); return { code: 1 }; }
  return { as };
}

// The lease issue opened and locked, said so, or said where it could not be locked.
function opened(h, o, print) {
  const issue = h.open(o.tool);
  print(`Opened the lease issue #${issue.number}${issue.locked ? ", locked" : `. It could not be locked (${issue.why}): the lease goes on, reading the owner's account's comments alone; lock it by hand`}.`);
  return issue;
}

// What a run with an issue (or none) does, once the host answers: prints its lines and gives its exit code.
function run(h, o, now, print) {
  const here = standing(h, o, print);
  if (here.code !== undefined) return here.code;
  let issue = h.issues(o.who)[0];
  if (here.as) return readOnly(h, issue, o, now, print, here.as);
  if (!issue && o.session === null) {
    if (o.handOver === null) { print(said(null).join("\n")); return 0; }
    console.error("FAIL: no lease issue stands to hand over. Mend: nothing to hand over; the next orchestrator's wake opens it");
    return 1;
  }
  if (!issue) issue = opened(h, o, print);
  if (o.handOver !== null) {
    h.comment(issue.number, handOverText(o.handOver, OPENER, o.tool));
    print(`Handed the lease (#${issue.number}) over to ${o.handOver === "any" ? "the next that wakes" : o.handOver}.`);
    return 0;
  }
  const entries = entriesOf(h.comments(issue, iso(now - 24 * HOUR)), o.who);
  if (o.session === null) { print([`The lease: #${issue.number}.`, ...said(holding(entries, now))].join("\n")); return 0; }
  return wake(h, issue, entries, o, now, print);
}

// A wake where gh acts as another account: it writes nothing, opening no issue and taking no lease; another session's
// fresh lease still stops it, and else the wake goes on without one, saying so.
function readOnly(h, issue, o, now, print, as) {
  const d = issue ? decide(entriesOf(h.comments(issue, iso(now - 24 * HOUR)), o.who), o.session, now) : { act: "claim" };
  if (d.act === "stop") { print(`Stop: ${d.why} (#${issue.number}). Delete every wake of your own and stop; keep no wake.`); return 2; }
  print(noLease(`${as}, so it writes nothing (sign gh in as ${o.who} to hold the lease)`));
  return 0;
}

// A wake: Stop where another holds the lease, else the lease comment written.
function wake(h, issue, entries, o, now, print) {
  const d = decide(entries, o.session, now);
  if (d.act === "stop") { print(`Stop: ${d.why} (#${issue.number}). Delete every wake of your own and stop; keep no wake.`); return 2; }
  h.comment(issue.number, leaseText(o));
  print(`${d.act === "renew" ? "Renewed" : "Claimed"} the lease (#${issue.number}): ${d.why}. Set your next wake within the cache's hour (55 minutes) while a builder runs or a review or check is due; with nothing in flight keep none, its hand-off ready.`);
  return 0;
}

export function main(argv, { host = hostOf, now = Date.now(), print = console.log, repo = null, owner = null, here = repoHere } = {}) {
  const o = optionsOf(argv);
  if (o.fail) { console.error(`FAIL: ${o.fail}. Mend: run it as its header shows`); return 1; }
  const where = o.repo ?? repo ?? here();
  if (!where) { print(noLease("no repository on github.com could be read from origin (give --repo <owner>/<name> where it is one)")); return 0; }
  o.who = o.owner ?? owner ?? manifestOwner() ?? where.split("/")[0];
  try { return run(host(where), o, now, print); }
  catch (e) {
    if (e.absent) { print(noLease("gh is not installed here")); return 0; }
    console.error(`FAIL: ${oneLine(String(e.message)).slice(0, 300)}. Mend: this wake works no lane and keeps its next, which runs it again; where gh still gives no answer, say so in the report`);
    return 1;
  }
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
