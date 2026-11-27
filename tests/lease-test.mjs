// Tests of the orchestrator's lease (scripts/lease.mjs; core/tasks/tools.md, "One orchestrator works a queue";
// #1106): a fresh lease of another session stops the wake, a stale one is claimed, a hand-over note stops the old
// holder whatever it names and lets the session it names take it, a lasting refusal of gh's sign-in lets the wake go
// on, comments the bound or gh's buffer cuts short read the lease as unread, an edited comment reads as none, what is read alone says whether the holder's last wake is over an hour
// old, only the owner's account's comments and the lease issue it opened under the lease's title count, a session
// gh signs in as another account writes nothing, where no lease can stand the wake goes on, the issue is locked as it
// opens, the newest comments are read however many stand, the lease comment and the note it writes read back as written, and the
// scheduled look's reader reports a lease renewed by two sessions and wakes over an hour apart while builders ran.
// Every repository, account and session is invented; GitHub is a stand-in. Node's own modules.
//
//   node tests/lease-test.mjs
import { toolOf } from "../scripts/stand-in-record.mjs";
import { COLD_MINUTES, ISSUE_TITLE, LABEL, OPENER, PAGES, PER_PAGE, SENDER, TERM_HOURS, TITLE, chosenIssue, decide, dueIssue, entriesOf, entryOf, faults, frame, handOverText, holding, hostOf, leaseIssues, leaseText, main, optionsOf, refusalOf, said } from "../scripts/lease.mjs";
import { DUE, dueContext } from "../scripts/look.mjs";
import { LIST, STATES } from "../scripts/labels.mjs";
import { STATES as ITEM_STATES } from "../scripts/inbox.mjs";

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
  for (const bad of ["<b>x</b>", "../../etc/passwd", "/home/x", "a\u0000b", "[x](https://example.invalid)"]) {
    ok(entryOf(comment(`Lease: ${bad}\nTool: claude\nBuilders: 0`, T0), OWNER) === null && entryOf(comment(`Hand-over: ${bad}`, T0), OWNER) === null && entryOf(comment(`Lease: a\nTool: ${bad}\nBuilders: 0`, T0), OWNER) === null, `markup or a path as a session, a hand-over's target or a tool is no entry (${JSON.stringify(bad).slice(0, 14)})`);
  }
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
  ok(decide(entries(lease("session_a", T0 - 75 * MIN, 0), note("any", T0 - 5 * MIN)), "session_a", T0).act === "stop", "a note to any stops the holder it replaced, so a cold holder's late wake cannot take the lease back");
  ok(decide(entries(lease("session_a", T0 - 75 * MIN, 0), note("any", T0 - 5 * MIN), lease("session_d", T0 - 2 * MIN)), "session_a", T0).act === "stop", "and once the fresh one took it, the old holder stays stopped");
  ok(decide(entries(lease("session_c", T0 - 2 * MIN), note("session_c", T0 - 10 * MIN), lease("session_a", T0 - 90 * MIN)), "session_a", T0).act === "stop", "once the named session took it, the old holder is stopped by its lease");
  ok(decide(entries(note("session_c", T0 - (TERM_HOURS * 60 + 5) * MIN)), "session_d", T0).act === "claim", "a note whose session never took the lease goes stale after the term");
  ok(decide(entries(lease("session_b", T0 - 30 * MIN, 1, "claude", "someone-else")), "session_a", T0).act === "claim", "another account's lease comment stops nothing");
}

// ---- read alone: whether the holder's last wake is over an hour old ----
{
  const warm = holding(entries(lease("session_b", T0 - 20 * MIN, 0)), T0);
  ok(warm.cold === false && said(warm).join(" ").includes("within the hour"), "a wake within the hour reads as warm: none is started", said(warm).join(" "));
  const cold = holding(entries(lease("session_b", T0 - (COLD_MINUTES + 10) * MIN, 0)), T0);
  ok(cold.cold === true && cold.fresh === true && said(cold).join(" ").includes("--hand-over any"), "a wake over an hour old with no builder reads as cold: start a fresh one with a note", said(cold).join(" "));
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
function standIn(comments = [], issues = [{ number: 7 }], { login = OWNER, repository = { has_issues: true }, lockable = true } = {}) {
  const written = [], opened = [], locks = [];
  return {
    written, opened, locks,
    host: repo => ({
      repository: () => repository,
      login: () => login,
      issues: owner => (repo === REPO && owner === OWNER ? issues : []),
      comments: () => comments,
      lock: n => { locks.push(n); return { locked: lockable, why: lockable ? "" : "HTTP 403" }; },
      open: tool => { opened.push(tool); issues.push({ number: 8 }); return { number: 8, comments: 0, locked: true, why: "" }; },
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
  const broken = { host: () => ({ repository: () => { throw new Error("gh could not read repos/x: HTTP 502"); } }) };
  const failed = run(["--session", "session_a", "--tool", "claude"], broken);
  ok(failed.code === 1, "a host that gives no answer fails the wake, saying the mend");
  // a session gh signs in as another account: no issue opened, no lease taken, nothing written, its work going on
  const other = standIn([], [], { login: "another-writer" });
  const r7 = run(["--session", "session_a", "--tool", "claude"], other);
  ok(r7.code === 0 && other.opened.length === 0 && other.written.length === 0 && r7.out.includes("goes on"), "a wake where gh acts as another account opens no issue, writes nothing and goes on", r7.out);
  const otherStale = standIn([lease("session_b", T0 - 200 * MIN)], [{ number: 7 }], { login: "another-writer" });
  ok(run(["--session", "session_a", "--tool", "claude"], otherStale).code === 0 && otherStale.written.length === 0, "and takes no stale lease of another");
  const otherFresh = standIn([lease("session_b", T0 - 10 * MIN)], [{ number: 7 }], { login: "another-writer" });
  ok(run(["--session", "session_a", "--tool", "claude"], otherFresh).code === 2 && otherFresh.written.length === 0, "while another session's fresh lease still stops it");
  const otherNote = standIn([lease("session_b", T0 - 200 * MIN)], [{ number: 7 }], { login: "another-writer" });
  ok(run(["--hand-over", "any"], otherNote).code === 1 && otherNote.written.length === 0, "a hand-over where gh acts as another account writes nothing and fails");
  ok(run([], standIn([lease("session_b", T0 - 10 * MIN)], [{ number: 7 }], { login: "another-writer" })).out.includes("Held by session_b"), "read alone, any account may read who holds it");
  // where no lease can stand, the wake goes on, saying so
  const off = standIn([], [], { repository: { has_issues: false } });
  const r8 = run(["--session", "session_a", "--tool", "claude"], off);
  ok(r8.code === 0 && r8.out.startsWith("No lease can stand here") && r8.out.includes("goes on") && off.opened.length === 0, "a project whose issues are switched off keeps its orchestrator: the wake goes on", r8.out);
  const absent = { host: () => ({ repository: () => { throw Object.assign(new Error("gh could not read repos/x"), { refused: refusalOf({ error: { code: "ENOENT" } }, "repos/x/y") }); } }) };
  ok(run(["--session", "session_a", "--tool", "claude"], absent).code === 0, "where gh is not here at all, the wake goes on too");
  // gh refused by its sign-in, which only the owner mends, lets the wake go on; a passing fault fails it
  const refusals = [[{ status: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login" }, "user"], [{ status: 1, stderr: "HTTP 401: Bad credentials" }, "user"], [{ status: 1, stderr: "HTTP 403: Resource not accessible by integration" }, "user"], [{ status: 1, stderr: "HTTP 403: Resource not accessible by personal access token" }, `repos/${REPO}/issues`], [{ status: 1, stderr: "HTTP 403: Resource protected by organization SAML enforcement" }, `repos/${REPO}`], [{ status: 1, stderr: "HTTP 404: Not Found" }, `repos/${REPO}`]];
  for (const [r, route] of refusals) {
    const got = run(["--session", "session_a", "--tool", "claude"], { host: () => ({ repository: () => { throw Object.assign(new Error("gh could not"), { refused: refusalOf(r, route) }); } }) });
    ok(got.code === 0 && got.out.startsWith("No lease can stand here: gh"), `gh refused (${r.stderr.slice(0, 24)}) lets the wake go on without the lease`, got.out);
  }
  ok(refusalOf({ status: 1, stderr: "HTTP 403: API rate limit exceeded for user" }, "user") === null && refusalOf({ status: 1, stderr: "HTTP 403: You have exceeded a secondary rate limit" }, "user") === null && refusalOf({ status: 1, stderr: "HTTP 502: Bad Gateway" }, "user") === null && refusalOf({ status: 1, stderr: "HTTP 404: Not Found" }, `repos/${REPO}/issues/7/comments`) === null && refusalOf({ status: null, error: { code: "ETIMEDOUT" } }, "user") === null, "a passing fault, and a 404 past the repository, and a rate limit, are no refusal");
  const errs = [];
  const err0 = console.error; console.error = l => errs.push(l);
  const r502 = main(["--session", "session_a", "--tool", "claude"], { host: () => ({ repository: () => { throw Object.assign(new Error("gh could not read repos/x: HTTP 502"), { refused: null }); } }), now: T0, print: () => {}, repo: REPO, owner: OWNER });
  console.error = err0;
  ok(r502 === 1 && errs.join(" ").includes("keeps its next only while"), "a passing fault fails the wake, which keeps its next only while work is in flight", errs.join(" "));
  // an unlocked lease issue is locked again at each wake, and a refusal is said at each
  const relock = standIn([lease("session_a", T0 - 50 * MIN)], [{ number: 7, locked: false }], { lockable: false });
  const r11 = run(["--session", "session_a", "--tool", "claude"], relock), r12 = run(["--session", "session_a", "--tool", "claude"], relock);
  ok(relock.locks.join() === "7,7" && r11.out.includes("could not be locked") && r12.out.includes("could not be locked") && r12.code === 0, "an unlocked lease issue is locked again at each wake, a refusal said at each", r12.out);
  ok((s => (run(["--session", "session_a", "--tool", "claude"], s), s.locks.length === 0))(standIn([], [{ number: 7, locked: true }])), "a locked one is left as it is");
  // the lease unread: read alone, under another account, and in the look, which tells the owner
  const short = () => Object.assign([comment("a remark", T0, "an-outsider")], { short: true });
  const alone = run([], { host: standIn(short()).host });
  ok(alone.code === 0 && alone.out.includes("the lease is unread") && alone.out.includes("owner"), "read alone, an unread lease says whether one runs cannot be told", alone.out);
  const otherUnread = run(["--session", "session_a", "--tool", "claude"], { host: standIn(short(), [{ number: 7 }], { login: "another-writer" }).host });
  ok(otherUnread.code === 0 && otherUnread.out.includes("the lease is unread"), "under another account too", otherUnread.out);
  const told = dueIssue({ repo: REPO, owner: OWNER, at: iso(T0) }, () => standIn(short()).host(REPO));
  ok(told?.owner === true && told.body.includes("#7") && !told.unread, "the look tells the owner of an unread lease in its issue", JSON.stringify(told));
  const handErr = [], e0 = console.error; console.error = l => handErr.push(l);
  const handRefused = main(["--hand-over", "any"], { host: () => ({ repository: () => { throw Object.assign(new Error("gh could not"), { refused: "gh is not signed in here" }); } }), now: T0, print: () => {}, repo: REPO, owner: OWNER });
  console.error = e0;
  ok(handRefused === 1, "a hand-over whose gh is refused fails, since it wrote no note");
  // more than one lease issue: said, and a locked one holding the owner's leases read first
  const two = standIn([lease("session_b", T0 - 10 * MIN)], [{ number: 3, locked: false }, { number: 5, locked: true }]);
  const r13 = run(["--session", "session_a", "--tool", "claude"], two);
  ok(r13.out.includes("2 lease issues stand (#3, #5): it reads #5") && r13.code === 2, "more than one lease issue is said, and the locked one read", r13.out);
  ok(chosenIssue([{ number: 3, locked: true }, { number: 4, locked: true }], i => i.number === 4).number === 4 && chosenIssue([{ number: 3 }, { number: 4 }]).number === 3, "among locked ones, the one holding the owner's leases; else the lowest");
  // an edited comment reads as none, since the script never edits its own
  const edited = { ...lease("session_b", T0 - 10 * MIN), updated_at: iso(T0 - 5 * MIN) };
  ok(entryOf(edited, OWNER) === null && entryOf({ ...edited, updated_at: edited.created_at }, OWNER) !== null, "a comment edited since it was written reads as none");
  const out9 = [];
  ok(main(["--session", "session_a", "--tool", "claude"], { host: () => { throw new Error("never asked"); }, now: T0, print: l => out9.push(l), repo: null, owner: OWNER, here: () => null }) === 0 && out9.join(" ").startsWith("No lease can stand here"), "and where no repository on github.com stands", out9.join(" "));
  // the issue is locked as it opens, and a lock refused is said, the wake going on
  const unlocked = standIn([], []);
  unlocked.host = (h => repo => ({ ...h(repo), open: () => ({ number: 8, comments: 0, locked: false, why: "HTTP 403" }) }))(unlocked.host);
  const r10 = run(["--session", "session_a", "--tool", "claude"], unlocked);
  ok(r10.code === 0 && r10.out.includes("could not be locked") && unlocked.written.length === 1, "a lease issue that could not be locked is said so, and the lease goes on", r10.out);
}

// ---- the host as the script reads it ----
{
  const calls = [];
  const write = (route, payload, method = "POST") => { calls.push(`${method} ${route}`); return route.endsWith("/lock") ? null : { number: 9 }; };
  const opened = hostOf(REPO, () => [], write).open("claude");
  ok(opened.number === 9 && opened.locked === true && calls.join("; ") === `POST repos/${REPO}/issues; PUT repos/${REPO}/issues/9/lock`, "the issue it opens it locks", calls.join("; "));
  const refused = hostOf(REPO, () => [], (route, p, m) => { if (m === "PUT") throw new Error("HTTP 403\nmore"); return { number: 9 }; }).open("claude");
  ok(refused.locked === false && refused.why.includes("403") && !refused.why.includes("\n"), "a lock refused is no failure, said in one line");
  let threw = false;
  try { hostOf(REPO, () => [], () => ({ number: "9/../x" })).open("claude"); } catch { threw = true; }
  ok(threw, "an issue's number out of its form reaches no route");
  // however many comments stand, the newest are read, from the last page back
  const flood = Array.from({ length: 1500 }, (_, i) => comment("a remark", T0 - 2 * HOUR + i));
  flood.push(lease("session_b", T0 - 10 * MIN));
  const pages = [];
  const read = route => { const page = Number(/[?&]page=(\d+)/.exec(route)[1]); pages.push(page); return flood.slice((page - 1) * PER_PAGE, page * PER_PAGE); };
  const got = hostOf(REPO, read).comments({ number: 7, comments: flood.length }, iso(T0 - 24 * HOUR));
  ok(pages[0] === Math.ceil(flood.length / PER_PAGE) && pages.length <= PAGES && PER_PAGE * 65536 * 4 < 1 << 24 && decide(entriesOf(got, OWNER), "session_a", T0).act === "stop", "past the bound of pages, the newest comments are still read and the lease still found", JSON.stringify(pages));
  const old = hostOf(REPO, route => (/[?&]page=7\b/.test(route) ? [lease("session_b", T0 - 10 * MIN)] : [comment("old", T0 - 30 * HOUR)])).comments({ number: 7, comments: 7 * PER_PAGE - 9 }, iso(T0 - 24 * HOUR));
  ok(old.length === 2, "it reads back no further than the first comment older than its reach", String(old.length));
  // an unlocked issue with 1,100 outsiders' comments newer than the lease: the lease is unread, never claimed
  const crowd = [lease("session_b", T0 - 2 * HOUR), ...Array.from({ length: 1100 }, (_, i) => comment("a remark", T0 - HOUR + i, "an-outsider"))];
  const writes = [];
  const crowdRead = route => (route === `repos/${REPO}` ? { has_issues: true } : route === "user" ? { login: OWNER } : route.includes("/issues?") ? [{ number: 7, title: ISSUE_TITLE, user: { login: OWNER }, locked: false, comments: crowd.length }] : (p => crowd.slice((p - 1) * PER_PAGE, p * PER_PAGE))(Number(/[?&]page=(\d+)/.exec(route)[1])));
  const crowdOut = [];
  const rc = main(["--session", "session_a", "--tool", "claude"], { host: repo => hostOf(repo, crowdRead, (route, p, m = "POST") => { writes.push(`${m} ${route}`); return null; }), now: T0, print: l => crowdOut.push(l), repo: REPO, owner: OWNER });
  ok(rc === 0 && !writes.some(w => w.endsWith("/comments")) && writes.includes(`PUT repos/${REPO}/issues/7/lock`) && crowdOut.join(" ").includes("the lease is unread"), "an unlocked issue with 1,100 outsiders' comments newer than the lease claims nothing", `${writes.join("; ")} | ${crowdOut.join(" ")}`);
  // a page past gh's buffer reads as unread, never as a failure
  const full = hostOf(REPO, () => { throw Object.assign(new Error("gh could not read"), { overflow: true }); }).comments({ number: 7, comments: 5 }, iso(T0 - 24 * HOUR));
  ok(Array.isArray(full) && full.length === 0 && full.short === true, "a page past gh's buffer reads as unread, never as a failure");
  // hostile answers: a body past its length, a null comment, a body that is no string, an answer that is no list
  ok(entryOf({ ...lease("session_b", T0), body: `${leaseText({ session: "session_b", tool: "claude", builders: 1 })}${" ".repeat(4001)}`.slice(0, 4001) }, OWNER) === null && entryOf(null, OWNER) === null && entryOf({ ...lease("session_b", T0), body: 7 }, OWNER) === null && entriesOf({ length: 1 }, OWNER).length === 0, "a body of 4,001 characters, a null comment, a body that is no string and an answer that is no list read as none");
  let notList = false;
  try { hostOf(REPO, () => ({ message: "x" })).comments({ number: 7, comments: 1 }, iso(T0)); } catch { notList = true; }
  ok(notList && leaseIssues({ length: 1 }, OWNER).length === 0, "comments or issues given as no list read as none, or fail the read");
  ok(LIST.sender[SENDER] !== undefined, "the lease issue's sender stands in the list of senders");
  // only an issue the owner's account opened under the lease's title is the lease's
  const listed = [{ number: 3, title: "An old issue", user: { login: OWNER } }, { number: 4, title: ISSUE_TITLE, user: { login: "another-writer" } }, { number: 5, title: ISSUE_TITLE, user: { login: OWNER }, pull_request: {} }, { number: 6, title: ISSUE_TITLE, user: { login: OWNER } }];
  ok(leaseIssues(listed, OWNER).map(i => i.number).join() === "6", "the label alone makes no issue the lease's: only one the owner's account opened under its title", JSON.stringify(leaseIssues(listed, OWNER)));
}

// ---- the scheduled look's reader ----
{
  ok(DUE.includes(dueIssue), "the look reads the lease among what is due");
  ok(STATES.includes(LABEL) && Object.values(LIST.state).filter(l => l.lease === true).length === 1 && !ITEM_STATES.includes(LABEL), "the label is the one state of the labels' list marked as the lease's, which no item of the inbox takes");
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
  const ctx = { repo: REPO, owner: OWNER, at: iso(T0), manifest: null, say: () => {}, job: false };
  ok(dueIssue(dueContext(ctx), host([lease("session_a", T0 - 60 * MIN), lease("session_b", T0 - 40 * MIN)]))?.body?.includes("#7"), "the look gives the lease's reader the owner's account, so it reports");
  const unread = dueIssue({ repo: REPO, owner: OWNER, at: iso(T0) }, () => { throw new Error("HTTP 502\nsecond line"); });
  ok(unread?.body === null && unread.unread?.includes("could not be read") && !unread.unread.includes("\n"), "a lease that cannot be read is said so, in one line");
}

console.log(`${count} assertions on the orchestrator's lease`);
if (failed) { console.error(`${failed} failed`); process.exit(1); }
