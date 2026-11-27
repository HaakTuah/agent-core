// Tests of the orchestrator's lease (scripts/lease.mjs; core/tasks/tools.md, "One orchestrator works a queue";
// #1106): a fresh lease of another session stops the wake, a stale one is claimed, a hand-over note stops the old
// holder and lets the session it names take it, what is read alone says whether the holder's last wake is over an hour
// old, only the owner's account's comments count, the lease comment and the note it writes read back as written, and the
// scheduled look's reader reports a lease renewed by two sessions and wakes over an hour apart while builders ran.
// Every repository, account and session is invented; GitHub is a stand-in. Node's own modules.
//
//   node tests/lease-test.mjs
import { toolOf } from "../scripts/stand-in-record.mjs";
import { COLD_MINUTES, ISSUE_TITLE, LABEL, OPENER, TERM_HOURS, TITLE, decide, dueIssue, entriesOf, entryOf, faults, frame, handOverText, holding, leaseText, main, optionsOf, said } from "../scripts/lease.mjs";
import { DUE } from "../scripts/look.mjs";
import { LIST, STATES } from "../scripts/labels.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const OWNER = "example-owner", REPO = "example-owner/example-project";
const T0 = Date.parse("2026-11-27T10:00:00Z"), MIN = 60000, HOUR = 3600000;
const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/u, "Z");
let id = 0;
const comment = (body, at, login = OWNER) => ({ id: ++id, user: { login }, created_at: iso(at), body });
const lease = (session, at, builders = 1, tool = "claude", login) => comment(leaseText({ session, tool, builders }), at, login);
const note = (to, at, login) => comment(handOverText(to), at, login);
const entries = (...cs) => entriesOf(cs, OWNER);

// ---- the round trip: what the script writes, it reads back as written ----
{
  const e = entryOf(lease("session_a", T0, 2, "codex"), OWNER);
  ok(e?.kind === "lease" && e.session === "session_a" && e.tool === "codex" && e.builders === 2 && e.at === T0, "a lease comment it writes reads back as written, its time the host's", JSON.stringify(e));
  const n = entryOf(note("session_b", T0), OWNER);
  ok(n?.kind === "hand-over" && n.to === "session_b", "a hand-over note it writes reads back as written");
  ok(entryOf(note("any", T0), OWNER)?.to === "any", "a note to any reads as any");
  ok(leaseText({ session: "s", tool: "claude", builders: 0 }).startsWith(OPENER) && OPENER.startsWith(LIST.openers.find(o => OPENER.startsWith(o)) ?? "\u0000"), "each opens with an opener of the labels' list");
  ok(handOverText("x", "From a chat session with the owner, on the lease:").split("\n")[0].startsWith("From a chat session"), "a note's opener may be whoever writes it");
  ok(toolOf(leaseText({ session: "s", tool: "claude", builders: 0 })) !== null && toolOf(handOverText("any")) !== null, "each ends with an agent's attribution line, so it never reads as the owner's own word");
}

// ---- only the owner's account, and only the form ----
{
  ok(entryOf(lease("session_x", T0, 0, "claude", "someone-else"), OWNER) === null, "another account's lease comment is not read");
  ok(entryOf(lease("session_x", T0, 0, "claude", "EXAMPLE-OWNER"), OWNER) !== null, "the owner's login however cased is read");
  ok(entryOf(comment("Lease: a\nHand-over: b\nTool: claude\nBuilders: 0", T0), OWNER) === null, "a comment of both forms is neither");
  ok(entryOf(comment("Lease: a\nLease: b\nTool: claude\nBuilders: 0", T0), OWNER) === null, "a key given twice is no lease");
  ok(entryOf(comment("Lease: a b\nTool: claude\nBuilders: 0", T0), OWNER) === null, "a session's name out of its form is no lease");
  ok(entryOf(comment("Lease: a\nTool: Claude Code\nBuilders: 0", T0), OWNER) === null, "a tool's name out of its form is no lease");
  ok(entryOf(comment("Lease: a\nTool: claude\nBuilders: -1", T0), OWNER) === null, "a count of builders out of its form is no lease");
  ok(entryOf({ user: { login: OWNER }, created_at: "yesterday", body: leaseText({ session: "a", tool: "claude", builders: 0 }) }, OWNER) === null, "one with no time of the host's is not read");
  ok(entryOf(comment("Just a remark on the lease.", T0), OWNER) === null, "a remark is no entry");
  ok(entriesOf("not a list", OWNER).length === 0, "an answer that is no list gives no entries");
}

// ---- a wake decides ----
{
  ok(decide([], "session_a", T0).act === "claim", "with no lease, a wake claims it");
  const fresh = entries(lease("session_b", T0 - 30 * MIN));
  ok(decide(fresh, "session_a", T0).act === "stop", "a fresh lease of another session stops the wake");
  ok(decide(fresh, "session_b", T0).act === "renew", "its holder renews it");
  const stale = entries(lease("session_b", T0 - (TERM_HOURS * 60 + 1) * MIN));
  ok(decide(stale, "session_a", T0).act === "claim", "a stale lease may be claimed");
  const handed = entries(lease("session_a", T0 - 90 * MIN, 0), note("session_c", T0 - 5 * MIN));
  ok(decide(handed, "session_a", T0).act === "stop", "a hand-over note naming another stops the old holder, its lease still fresh");
  ok(decide(handed, "session_c", T0).act === "claim", "the session the note names takes it");
  ok(decide(handed, "session_d", T0).act === "stop", "and no other");
  ok(decide(entries(lease("session_a", T0 - 30 * MIN), note("any", T0 - 5 * MIN)), "session_d", T0).act === "claim", "a note to any lets the next that wakes take it");
  ok(decide(entries(lease("session_a", T0 - 30 * MIN), note("any", T0 - 5 * MIN)), "session_a", T0).act === "claim", "and the old holder too, since it handed over to any");
  ok(decide(entries(lease("session_c", T0 - 2 * MIN), note("session_c", T0 - 10 * MIN), lease("session_a", T0 - 90 * MIN)), "session_a", T0).act === "stop", "once the named session took it, the old holder is stopped by its lease");
  ok(decide(entries(note("session_c", T0 - (TERM_HOURS * 60 + 5) * MIN)), "session_d", T0).act === "claim", "a note whose session never took the lease goes stale after the term");
  ok(decide(entries(lease("session_b", T0 - 30 * MIN, 1, "claude", "someone-else")), "session_a", T0).act === "claim", "another account's lease comment stops nothing");
}

// ---- read alone: whether the holder's last wake is over an hour old ----
{
  const warm = holding(entries(lease("session_b", T0 - 20 * MIN, 0)), T0);
  ok(warm.cold === false && said(warm).join(" ").includes("within the hour"), "a wake within the hour reads as warm: none is started", said(warm).join(" "));
  const cold = holding(entries(lease("session_b", T0 - (COLD_MINUTES + 10) * MIN, 0)), T0);
  ok(cold.cold === true && cold.fresh === true && said(cold).join(" ").includes("--hand-over"), "a wake over an hour old with no builder reads as cold: start a fresh one with a note", said(cold).join(" "));
  const busy = holding(entries(lease("session_b", T0 - (COLD_MINUTES + 10) * MIN, 2)), T0);
  ok(said(busy).join(" ").includes("do not replace it"), "one with builders running is never replaced");
  ok(said(null).join(" ").includes("may be started"), "with no lease, one may be started");
  ok(said(holding(entries(lease("session_b", T0 - (TERM_HOURS + 1) * HOUR)), T0)).join(" ").includes("stale"), "a stale lease says one may be started");
}

// ---- the options ----
{
  ok(optionsOf(["--session", "s1"]).fail?.includes("--tool"), "--session needs --tool");
  ok(!optionsOf(["--session", "s1", "--tool", "claude", "--builders", "2"]).fail, "a wake's options read");
  ok(optionsOf(["--session", "a b", "--tool", "claude"]).fail, "a session's name out of form fails");
  ok(optionsOf(["--hand-over", "s2", "--session", "s1", "--tool", "claude"]).fail, "--hand-over and --session go apart");
  ok(optionsOf(["--repo", "../x"]).fail, "a repository out of form fails");
  ok(optionsOf(["--odd"]).fail?.includes("no option"), "an unknown option fails");
  ok(optionsOf(["--builders", "1.5"]).fail, "a count of builders that is no whole number fails");
}

// ---- main against a stand-in host ----
function standIn(comments = [], issues = [{ number: 7 }]) {
  const written = [], opened = [];
  return {
    written, opened,
    host: repo => ({
      issues: owner => (repo === REPO && owner === OWNER ? issues : []),
      comments: () => comments,
      open: tool => { opened.push(tool); issues.push({ number: 8 }); return { number: 8 }; },
      comment: (n, body) => { written.push({ n, body }); comments.push(comment(body, T0)); return {}; },
    }),
  };
}
const run = (argv, s) => { const out = []; const code = main(argv, { host: s.host, now: T0, print: l => out.push(l), repo: REPO, owner: OWNER }); return { code, out: out.join("\n") }; };
{
  const s = standIn([lease("session_b", T0 - 10 * MIN)]);
  const r = run(["--session", "session_a", "--tool", "claude"], s);
  ok(r.code === 2 && r.out.startsWith("Stop:") && s.written.length === 0, "a wake that finds another's fresh lease writes nothing, says Stop and ends with 2", r.out);
  const s2 = standIn([lease("session_b", T0 - 10 * MIN)]);
  const r2 = run(["--session", "session_b", "--tool", "claude", "--builders", "3"], s2);
  ok(r2.code === 0 && s2.written.length === 1 && entryOf(comment(s2.written[0].body, T0), OWNER)?.builders === 3, "its holder's wake renews it, the count of builders written", r2.out);
  const s3 = standIn([], []);
  const r3 = run(["--session", "session_a", "--tool", "claude"], s3);
  ok(r3.code === 0 && s3.opened.length === 1 && s3.opened[0] === "claude" && s3.written[0]?.n === 8, "a first wake with no lease issue opens it and takes the lease", r3.out);
  ok(frame().startsWith("This is the issue's current text.") && frame().includes("Found while:"), "the issue opens as one current text, saying what it was found while");
  const s4 = standIn([], []);
  const r4 = run([], s4);
  ok(r4.code === 0 && s4.opened.length === 0 && r4.out.includes("may be started"), "read alone with no lease issue it opens none");
  const s5 = standIn([lease("session_a", T0 - 90 * MIN, 0)]);
  const r5 = run(["--hand-over", "session_c"], s5);
  ok(r5.code === 0 && entryOf(comment(s5.written[0].body, T0), OWNER)?.to === "session_c", "--hand-over writes the note", r5.out);
  const r6 = run(["--hand-over", "any"], standIn([], []));
  ok(r6.code === 1, "with no lease issue there is nothing to hand over");
  const broken = { host: () => ({ issues: () => { throw new Error("gh could not read repos/x/issues: HTTP 502"); } }) };
  ok(run(["--session", "session_a", "--tool", "claude"], broken).code === 1, "a host that gives no answer fails the wake, saying the mend");
}

// ---- the scheduled look's reader ----
{
  ok(DUE.includes(dueIssue), "the look reads the lease among what is due");
  ok(STATES.includes(LABEL), "the label is a state of the labels' list");
  ok(ISSUE_TITLE !== TITLE, "the lease issue and the look's issue go by titles of their own");
  const from = T0 - 24 * HOUR;
  const two = faults(entries(lease("session_a", T0 - 60 * MIN), lease("session_b", T0 - 40 * MIN), lease("session_a", T0 - 5 * MIN)), from);
  ok(two.length === 2 && two.every(f => f.startsWith("renewed by two sessions")), "a lease renewed by two sessions is reported", JSON.stringify(two));
  ok(faults(entries(lease("session_a", T0 - 60 * MIN), note("session_b", T0 - 50 * MIN), lease("session_b", T0 - 40 * MIN)), from).length === 0, "a hand-over between them is no fault");
  ok(faults(entries(lease("session_a", T0 - 5 * HOUR), lease("session_b", T0 - 40 * MIN)), from).length === 0, "a stale lease claimed is no fault");
  const late = faults(entries(lease("session_a", T0 - 150 * MIN, 2), lease("session_a", T0 - 20 * MIN, 0)), from);
  ok(late.length === 1 && late[0].includes("apart while 2 builders ran"), "wakes over an hour apart while builders ran are reported", JSON.stringify(late));
  ok(faults(entries(lease("session_a", T0 - 150 * MIN, 0), lease("session_a", T0 - 20 * MIN, 0)), from).length === 0, "with no builder running a long gap is no fault");
  ok(faults(entries(lease("session_a", T0 - 50 * HOUR, 2), lease("session_a", T0 - 48 * HOUR, 2)), from).length === 0, "what is older than the look's reach is not reported");
  const host = cs => () => ({ issues: o => (o === OWNER ? [{ number: 7 }] : []), comments: () => cs });
  const due = dueIssue({ repo: REPO, owner: OWNER, at: iso(T0) }, host([lease("session_a", T0 - 60 * MIN), lease("session_b", T0 - 40 * MIN)]));
  ok(due?.title === TITLE && due.body?.includes("#7") && due.owner === false, "the look keeps its issue while a fault stands", JSON.stringify(due));
  ok(dueIssue({ repo: REPO, owner: OWNER, at: iso(T0) }, host([lease("session_a", T0 - 60 * MIN)]))?.body === null, "and closes it once none does");
  ok(dueIssue({ repo: REPO, owner: "nobody-here", at: iso(T0) }, host([])) === null, "a project with no lease issue has none");
  const unread = dueIssue({ repo: REPO, owner: OWNER, at: iso(T0) }, () => { throw new Error("HTTP 502\nsecond line"); });
  ok(unread?.body === null && unread.unread?.includes("could not be read") && !unread.unread.includes("\n"), "a lease that cannot be read is said so, in one line");
}

console.log(`${count} assertions on the orchestrator's lease`);
if (failed) { console.error(`${failed} failed`); process.exit(1); }
