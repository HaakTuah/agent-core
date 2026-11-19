// Checks the check of issue and comment text for the personal terms (scripts/issue-terms.mjs; #783): it reads the
// terms as the personal-terms check does, its matcher deciding as that check's own shell does on the same texts (run
// from .github/workflows/personal-terms.yml itself, so the two stay in step), a session's link id left out; it takes
// each term out of an issue, a closed pull request and each kind of comment, never an open pull request's own text; in
// a job it prints counts and the mend alone, never a term, a text or where one stood; a text it may not edit is
// counted; --private names each place, and refuses to run in a job; without TERMS it reads nothing. All on GitHub's
// answers made up here: no network. Terms built from pieces as the test runs (floor rule 8).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { holds, main, MARK, OWED, payloadOf, places, takeOut, termsOf, texts, versions } from "../scripts/issue-terms.mjs";
import { mended } from "../scripts/mend.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const [term, other] = [["qz", "vk", "wy"], ["xj", "qq", "zf"]].map(t => t.join(""));
const TERMS = ` ${term}\r\n\n${other}\n`;
const terms = termsOf(TERMS);
ok(terms.length === 2 && terms[0] === term && terms[1] === other, "the terms are read one a line, the blanks around each and the empty lines no part of them");

// the matcher, beside the personal-terms check's own shell: its list made as that check makes it, and its `link` and
// `unlinked` lines taken from the workflow itself
const workflow = fs.readFileSync(path.join(root, ".github/workflows/personal-terms.yml"), "utf8");
const line = name => workflow.split("\n").find(l => l.trimStart().startsWith(name))?.trim();
const tmp = scratchDir("issue-terms-test-");
const list = path.join(tmp, "terms");
fs.writeFileSync(list, `${terms.join("\n")}\n`);
const shell = text => spawnSync("bash", ["-c", `${line("link=")}\n${line("unlinked()")}\nprintf '%s\\n' "$TEXT" | unlinked | grep -q -i -F -f "$LIST"`], { env: { PATH: process.env.PATH, TEXT: text, LIST: list }, encoding: "utf8" }).status === 0;
ok(line("link=") && line("unlinked()"), "the personal-terms check's link and unlinked lines are found in its workflow");
const id = inside => `01${`A${inside}BCDEFGHJKMNPQRSTUVWXYZabc`.slice(0, 22)}`;
const link = (inside, host = "claude.ai/code/session_") => `https://${host}${id(inside)}`;
const cases = [
  ["a term alone", term], ["a term in another case", `Words ${term.toUpperCase()} words`], ["none", "Plain words."],
  ["a term only in a session's link id", `Session: ${link(term)}`], ["such a link ended by a mark", `(${link(term)}).`],
  ["two such links side by side", `${link(term)} ${link(other)}`], ["a link of another host", link(term, "example.com/code/session_")],
  ["a link inside another address", `x${link(term)}`], ["a term after such a link", `${link("x")} ${other}`],
  ["a term on a later line", `one\ntwo ${term}\nthree`], ["a term inside a word", `ab${other}cd`],
];
for (const [what, text] of cases) ok(holds(text, terms) === shell(text), `${what}: the matcher decides as the personal-terms check's shell does`, `${holds(text, terms)} against ${shell(text)}`);

// taking out
ok(takeOut(`A ${term} and ${term.toUpperCase()}.`, terms) === `A ${MARK} and ${MARK}.`, "each term is taken out, in any case, the mark in its place");
ok(takeOut(`Session: ${link(term)}`, terms) === `Session: ${link(term)}`, "a session's link id is left as it is");
ok(!holds(takeOut(`${term.slice(0, 3)}${other}${term.slice(3)}`, terms), terms), "a cut that joins two parts into a term is taken again");
ok(places(`${term}${term}`, terms).length === 2, "two terms side by side are each found");

// GitHub, made up: issues (one a closed pull request, one an open one), comments of each kind and a review
const repo = "o/r";
const issue = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, number: 1, html_url: "https://github.com/o/r/issues/1", node_id: "I1", title: `About ${term}`, body: `See ${other}.`, state: "open" };
const clean = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, number: 2, html_url: "https://github.com/o/r/issues/2", node_id: "I2", title: "Plain", body: "Plain.", state: "open" };
const closed = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, number: 3, html_url: "https://github.com/o/r/pull/3", node_id: "P3", title: "A change", body: `Words ${term}`, state: "closed", pull_request: {} };
const open = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, number: 4, html_url: "https://github.com/o/r/pull/4", node_id: "P4", title: `Open ${term}`, body: "x", state: "open", pull_request: {} };
const comment = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, id: 11, html_url: "https://github.com/o/r/issues/1#issuecomment-11", node_id: "C11", body: `A note ${other}` };
const inline = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, id: 12, html_url: "https://github.com/o/r/pull/3#discussion_r12", node_id: "R12", body: `Here ${term}` };
const review = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, id: 13, html_url: "https://github.com/o/r/pull/3#pullrequestreview-13", node_id: "V13", body: `Review ${term}`, submitted_at: "2026-11-18T00:00:00Z" };
const old = { author_association: "OWNER", user: { login: "writer-a", type: "User" }, id: 14, html_url: "https://github.com/o/r/pull/3#pullrequestreview-14", node_id: "V14", body: `Old ${term}`, submitted_at: "2026-01-01T00:00:00Z" };
const NOW = new Date("2026-11-19T12:00:00Z");
// (each text as GitHub gives it when read again, by its route: as listed, unless `now` says otherwise)
const byRoute = { "repos/o/r/issues/1": issue, "repos/o/r/issues/2": clean, "repos/o/r/issues/3": closed, "repos/o/r/issues/comments/11": comment, "repos/o/r/pulls/comments/12": inline, "repos/o/r/pulls/3/reviews/13": review, "repos/o/r/pulls/3/reviews/14": old };
// (each account's right here, as GitHub answers it; the repository's owner, "o", may write where none answers)
const rights = { "writer-a": "write", "reader-m": "read" };
let owing = [];
const owed = [];
function github({ versions = {}, now = {}, extra = [], pages = {} } = {}) {
  const asked = [];
  const gh = (...args) => {
    asked.push(args.join(" "));
    if (args[0] === "repos/o/r" || args[0] === "repos/O/R") return JSON.stringify({ full_name: "o/r" });
    const right = /^repos\/o\/r\/collaborators\/([^/]+)\/permission$/.exec(args[0]);
    if (right) { const login = right[1], role = rights[login]; if (!role) throw new Error("no"); return JSON.stringify({ role_name: role, permission: role === "maintain" ? "write" : role, user: { login, type: "User", permissions: { push: role !== "read" && role !== "triage" } } }); }
    if (args[0].startsWith("repos/o/r/issues?state=open&labels=")) { owed.push(args[0]); return JSON.stringify(/[?&]page=1$/.test(args[0]) ? owing : []); }
    if (args[0] in now || args[0] in byRoute) { const got = args[0] in now ? now[args[0]] : byRoute[args[0]]; if (got === null) throw new Error("gone"); return JSON.stringify(got); }
    if (args[0] === "graphql") return JSON.stringify({ data: { nodes: args.filter(a => a.startsWith("ids[]=")).map(a => a.slice(6)).map(id => ({ id, userContentEdits: { pageInfo: { hasNextPage: Boolean(pages[id]) }, nodes: (versions[id] ?? []).map(diff => ({ diff })) } })) } });
    const route = args[0], first = /[?&]page=1$/.test(route);
    if (route.startsWith(`repos/${repo}/issues?`)) return JSON.stringify(first ? [issue, clean, closed, open] : []);
    if (route.startsWith(`repos/${repo}/issues/comments?`)) return JSON.stringify(first ? [comment, ...extra] : []);
    if (route.startsWith(`repos/${repo}/pulls/comments?`)) return JSON.stringify(first ? [inline] : []);
    if (route.startsWith(`repos/${repo}/pulls/3/reviews`)) return JSON.stringify(first ? [review, old] : []);
    if (/^repos\/o\/r\/pulls\/\d+\/reviews/.test(route)) return "[]";
    throw new Error(`not made up: ${route}`);
  };
  return { gh, asked };
}
const run = (argv, { env = { TERMS, GITHUB_ACTIONS: "true" }, refuse = () => false, versions, now, extra, at = repo, top = null, pages } = {}) => {
  const { gh, asked } = github({ versions, now, extra, pages });
  const edits = [], lines = [], errors = [];
  const error = console.error; console.error = m => errors.push(m);
  try {
    const status = main(argv, { env, gh, now: NOW, repo: at, top, say: m => lines.push(m), edit: (method, route, payload) => { edits.push({ method, route, payload }); return !refuse(route); } });
    return { status, edits, asked, out: [...lines, ...errors].join("\n") };
  } finally { console.error = error; }
};
const leaks = out => [term, other].some(t => out.toLowerCase().includes(t)) || /github\.com\/o\/r\/(issues|pull)\//.test(out) || /#\d|\/\d+\b/.test(out.replace(/\d+ (texts|days)|--days \d+/g, ""));

const job = run([]);
const edited = route => job.edits.find(e => e.route === route)?.payload;
ok(job.status === 0, "in a job it fails nothing", job.out);
ok(edited("repos/o/r/issues/1")?.title === `About ${MARK}` && edited("repos/o/r/issues/1")?.body === `See ${MARK}.`, "an issue's title and description have the terms taken out", JSON.stringify(job.edits));
ok(edited("repos/o/r/issues/3")?.body === `Words ${MARK}` && !("title" in edited("repos/o/r/issues/3")), "a closed pull request's description has them taken out, and only what held one is sent");
ok(!job.edits.some(e => e.route === "repos/o/r/issues/4"), "an open pull request's own text is left to the personal-terms check");
ok(!job.edits.some(e => e.route === "repos/o/r/issues/2"), "a text with no term is not edited");
ok(edited("repos/o/r/issues/comments/11")?.body === `A note ${MARK}` && edited("repos/o/r/pulls/comments/12")?.body === `Here ${MARK}`, "a comment and a review's inline comment have them taken out");
ok(job.edits.find(e => e.route === "repos/o/r/pulls/3/reviews/13")?.method === "PUT" && job.edits.some(e => e.route.endsWith("/reviews/14")), "every review of a pull request touched in the days read has them taken out, one submitted before them too, since an edit moves no date GitHub gives of it");
ok(job.asked.some(a => a.includes("since=2026-11-11T12:00:00Z")), "it reads the last eight days", job.asked.join("\n"));
ok(!leaks(job.out) && /took a term out of 6/.test(job.out), "it prints counts, never a term, a text or where one stood", job.out);
ok(/Mend: \S+\s+\S/.test(job.out) && /--private/.test(job.out), "where it took one out, it says the mend: the private run that names the versions to delete", job.out);
ok(!job.asked.some(a => a.startsWith("graphql")), "in a job it reads no earlier versions");

const refused = run([], { refuse: route => route.startsWith("repos/o/r/pulls/") });
ok(refused.status === 0 && /3 that hold one this account may not edit/.test(refused.out) && !leaks(refused.out), "a text the token may not edit is counted, naming nothing", refused.out);

const dry = run(["--dry"]);
ok(dry.edits.length === 0 && /would take a term out of 6/.test(dry.out), "--dry edits nothing and says what it would");

const own = run(["--private"], { env: { TERMS }, refuse: route => route.endsWith("/comments/12"), versions: { C11: ["Plain", `A note ${other}`], I2: ["Plain."] } });
ok(own.status === 0 && own.out.includes(`changed: ${issue.html_url} (issue); its old title stays in its timeline`), "--private names each text it changed, and an old title left in a timeline", own.out);
ok(own.out.includes(`could not change: ${inline.html_url}`), "--private names a text it could not change", own.out);
ok(own.out.includes(`earlier versions hold a term: ${comment.html_url}`) && !own.out.includes(`earlier versions hold a term: ${clean.html_url}`), "--private names each text whose kept versions hold a term, and no other", own.out);
ok(![term, other].some(t => own.out.toLowerCase().includes(t)), "--private never prints a term either");

// an outsider's text: neither edited nor counted, so no comment of guesses learns the list; --private names it
const stranger = { id: 21, html_url: "https://github.com/o/r/issues/2#issuecomment-21", node_id: "C21", body: `Guesses: ${term}, ${other}`, author_association: "NONE", user: { type: "User" } };
const app = { id: 22, html_url: "https://github.com/o/r/issues/2#issuecomment-22", node_id: "C22", body: `Quoted ${term}`, author_association: "NONE", user: { type: "Bot", login: "github-actions[bot]" } };
byRoute["repos/o/r/issues/comments/22"] = app;
const guessed = run([], { extra: [stranger, app] });
ok(!guessed.edits.some(e => e.route.endsWith("/comments/21")) && !guessed.edits.some(e => e.route.endsWith("/comments/22")) && /took a term out of 6/.test(guessed.out) && /read 9 texts/.test(guessed.out), "an outsider's comment is neither edited nor counted, nor GitHub's own job's, which can repeat an outsider's words", guessed.out);
const named = run(["--private"], { env: { TERMS }, extra: [stranger] });
ok(named.out.includes(`an outsider's text holds a term: ${stranger.html_url}`) && !named.edits.some(e => e.route.endsWith("/comments/21")), "--private names an outsider's text that holds a term, for the owner, and edits it not", named.out);

// an app whose text an outsider shapes (Dependabot's, carrying another publisher's release notes) is an outsider too
const bump = { id: 23, html_url: "https://github.com/o/r/pull/3#issuecomment-23", node_id: "C23", body: `Release notes: ${term}`, author_association: "NONE", user: { type: "Bot", login: "dependabot[bot]" } };
const bumped = run([], { extra: [bump, app] });
ok(!bumped.edits.some(e => e.route.endsWith("/comments/23")) && /read 9 texts/.test(bumped.out), "Dependabot's text is neither edited nor counted", bumped.out);
const posing = { ...comment, id: 25, html_url: "https://github.com/o/r/issues/1#issuecomment-25", node_id: "C25", user: { type: "Bot", login: "an-app[bot]" } };
ok(!run([], { extra: [posing] }).edits.some(e => e.route.endsWith("/comments/25")), "an app the host names a collaborator is no insider either");

// Codex's text is an outsider's too: its review of a fork's pull request can quote it
const codex = { ...bump, id: 24, html_url: "https://github.com/o/r/pull/3#issuecomment-24", node_id: "C24", user: { type: "Bot", login: "chatgpt-codex-connector[bot]" } };
const reviewed = run([], { extra: [codex] });
ok(!reviewed.edits.some(e => e.route.endsWith("/comments/24")) && /read 8 texts/.test(reviewed.out), "Codex's text is neither edited nor counted", reviewed.out);

// the repository as GitHub names it, so that an origin in another case reads every row
const cased = run([], { at: "O/R" });
ok(/took a term out of 6/.test(cased.out), "an origin written in another case still reads the repository's texts", cased.out);
for (const [what, answer] of [["GitHub refuses", null], ["GitHub gives no name", {}], ["a name not of its shape", { full_name: "o/r/../x" }]]) {
  const named = (() => { const lines = [], edits = [], asked = [];
    const status = main([], { env: { TERMS, GITHUB_ACTIONS: "true" }, now: NOW, repo: "x/y", top: null, say: m => lines.push(m), edit: () => { edits.push(1); return true; },
      gh: (...args) => { asked.push(args[0]); if (args[0] === "repos/x/y") { if (answer === null) throw new Error("no"); return JSON.stringify(answer); } return "[]"; } });
    return { status, out: lines.join("\n"), edits, asked }; })();
  ok(named.status === 0 && /nothing was read/.test(named.out) && /Mend: \S+\s+\S/.test(named.out) && named.edits.length === 0 && named.asked.length === 1, `${what} of the repository's name: nothing is read, and it says so with the mend`, named.out);
}

// a member or collaborator who may only read is no insider: GitHub's answer for the account decides, not its association
const watcher = { ...comment, id: 26, html_url: "https://github.com/o/r/issues/1#issuecomment-26", node_id: "C26", author_association: "MEMBER", user: { login: "reader-m", type: "User" } };
const unknown = { ...comment, id: 27, html_url: "https://github.com/o/r/issues/1#issuecomment-27", node_id: "C27", author_association: "COLLABORATOR", user: { login: "gone-z", type: "User" } };
const owner = { ...comment, id: 28, html_url: "https://github.com/o/r/issues/1#issuecomment-28", node_id: "C28", author_association: "OWNER", user: { login: "o", type: "User" } };
byRoute["repos/o/r/issues/comments/28"] = owner;
const members = run([], { extra: [watcher, unknown, owner] });
ok(!members.edits.some(e => /\/comments\/2[67]$/.test(e.route)) && members.edits.some(e => e.route.endsWith("/comments/28")), "a member who may only read, and an account GitHub gives no right for, are outsiders; the repository's owner is not", JSON.stringify(members.edits.map(e => e.route)));
ok(members.asked.filter(a => a.includes("/collaborators/")).length === 4, "the rights asked are those of the authors of texts that hold a term, each once", members.asked.filter(a => a.includes("/collaborators/")).join("\n"));

// a collaborator's text the job already cleaned: its kept versions are still named to the owner
const cleaned = { ...comment, id: 29, html_url: "https://github.com/o/r/issues/1#issuecomment-29", node_id: "C29", body: `A note ${MARK}`, author_association: "COLLABORATOR", user: { login: "writer-b", type: "User" } };
const history = run(["--private"], { env: { TERMS }, extra: [cleaned], versions: { C29: [`A note ${other}`, `A note ${MARK}`] } });
ok(history.out.includes(`earlier versions hold a term: ${cleaned.html_url}`), "--private names a collaborator's text the job already cleaned, whose kept version holds a term", history.out);

// a history GitHub gives without its edits, or a node gone since it was listed, is unread, and the run goes on
{
  const got = versions(["C1", "C2", "C3"], terms, () => JSON.stringify({ data: { nodes: [{ id: "C1" }, null, { id: "C3", userContentEdits: { pageInfo: { hasNextPage: false }, nodes: [{ diff: `x ${term}` }] } }] } }));
  ok(got.unread.has("C1") && got.unread.has("C2") && got.held.has("C3") && got.held.size === 1, "a history given without its edits, or a node gone, is unread, and the rest are still read", JSON.stringify({ held: [...got.held], unread: [...got.unread] }));
}

// GitHub's older node ids, Base64 with padding, are read
ok(texts(repo, "2026-11-11T12:00:00Z", (...args) => (/[?&]page=1$/.test(args[0]) && args[0].includes("issues/comments?") ? JSON.stringify([{ ...comment, node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=" }]) : "[]")).length === 1, "a node id of GitHub's older form, padded, is read");

// an edit history longer than its first page is unread, never clear
const longer = run(["--private"], { env: { TERMS }, versions: { C11: ["Plain"] }, pages: { C11: true } });
ok(/the earlier versions of \d+ texts could not be read/.test(longer.out) && !longer.out.includes(`earlier versions hold a term: ${comment.html_url}`), "a history GitHub gives in more than one page is said unread", longer.out);

// the owner is told, in an issue labelled needs-owner, that the private run is due: one, updated, never a text or an address
owed.length = 0; owing = [];
const told = run([]);
const opened = told.edits.find(e => e.method === "POST" && e.route === "repos/o/r/issues");
ok(opened && opened.payload.title === OWED && JSON.stringify(opened.payload.labels) === JSON.stringify(["by:look", "needs-owner"]) && /took a personal term out of 6 texts/.test(opened.payload.body), "where it took a term out, it opens one issue labelled needs-owner for the owner's private run", JSON.stringify(opened));
ok(!leaks(opened?.payload.body ?? "") && /--days 36500/.test(opened?.payload.body ?? "") && /never typed into a chat/.test(opened?.payload.body ?? ""), "the issue holds counts and the private run alone, its window reaching back however late it runs", opened?.payload.body);
owing = [{ number: 40, title: OWED, labels: [], user: { login: "someone-else" } }];
const planted = run([]);
ok(!planted.edits.some(e => e.route === "repos/o/r/issues/40") && planted.edits.some(e => e.method === "POST"), "an issue of that title and those labels that someone else opened is left alone, and one of the job's opened");
owing = [{ number: 41, title: OWED, labels: [], user: { login: "github-actions[bot]" } }];
const again = run([]);
ok(again.edits.some(e => e.method === "PATCH" && e.route === "repos/o/r/issues/41") && !again.edits.some(e => e.method === "POST"), "a second run updates that issue and opens none", JSON.stringify(again.edits.map(e => `${e.method} ${e.route}`)));
owing = [];
ok(!run(["--dry"]).edits.length && !run([], { extra: [], now: Object.fromEntries(Object.keys(byRoute).map(r => [r, { ...byRoute[r], title: "Plain", body: "Plain." }])) }).edits.some(e => e.method === "POST"), "a dry run, or one that took nothing out, opens no issue");

// a row of GitHub's answers not of its shape is left out (floor topic 5)
const bent = [{ ...comment, id: "11/lock" }, { ...comment, id: -1 }, { ...comment, id: 1.5 }, { ...comment, id: 31, html_url: "https://github.com/x/y/issues/1#issuecomment-31" },
  { ...comment, id: 32, html_url: "https://github.com/o/r/issues/1 x" }, { ...comment, id: 33, node_id: "C 33" }, { ...comment, id: 34, node_id: "<b>" }, { ...comment, id: 35, body: { text: term } },
  { ...comment, id: 36, body: `${term}${"x".repeat(1 << 20)}` }, null, "a row", { id: 37 }];
const read = texts(repo, "2026-11-11T12:00:00Z", (...args) => { const route = args[0]; if (/[?&]page=1$/.test(route) && route.includes("issues/comments?")) return JSON.stringify(bent); if (/[?&]page=1$/.test(route) && route.includes("issues?")) return JSON.stringify([{ ...issue, number: "1/lock" }, { ...issue, number: 0 }, { ...issue, title: 7 }]); return "[]"; });
ok(read.length === 0, "a row whose number, id, address, node id or text is not of its shape is left out, every one", JSON.stringify(read.map(r => r.route)));

// a term inside the mark is never edited each day again
const dots = termsOf("…");
ok(payloadOf({ body: "a … b" }, dots) === null, "where a term stands inside the mark, the text is not edited");
const looped = run([], { env: { TERMS: `${TERMS}\n…`, GITHUB_ACTIONS: "true" }, now: { "repos/o/r/issues/comments/11": { ...comment, body: `A … note ${other}` } }, extra: [] });
ok(!looped.edits.some(e => e.route.endsWith("/comments/11")) && /may not edit/.test(looped.out), "such a text is counted, and left as it is", looped.out);

// read again just before its edit: a person's edit since the first read is kept
const since = run([], { now: { "repos/o/r/issues/comments/11": { ...comment, body: `A note, edited, ${other}` }, "repos/o/r/pulls/comments/12": { ...inline, body: "Taken out by hand" }, "repos/o/r/pulls/3/reviews/13": null } });
ok(since.edits.find(e => e.route.endsWith("/comments/11"))?.payload.body === `A note, edited, ${MARK}`, "the edit is made from the text as it stands when read again", JSON.stringify(since.edits));
ok(!since.edits.some(e => e.route.endsWith("/pulls/comments/12")) && !since.edits.some(e => e.route.endsWith("/reviews/13")), "a text no longer holding a term, or gone, is not edited");

// the list from a file, never typed into a chat
const file = path.join(tmp, "terms.txt");
fs.writeFileSync(file, TERMS);
const fromFile = run(["--private", "--terms-file", file], { env: {} });
ok(fromFile.status === 0 && fromFile.out.includes(`changed: ${issue.html_url}`), "--terms-file reads the list from a file", fromFile.out);
const inside = path.join(tmp, "inside.txt");
fs.writeFileSync(inside, TERMS);
const inTree = run(["--private", "--terms-file", inside], { env: {}, top: fs.realpathSync(tmp) });
ok(inTree.status === 1 && mended(inTree.out) && !inTree.out.includes(tmp) && inTree.asked.length === 0, "a terms file inside the repository's work tree is refused, naming no path", inTree.out);
const noFile = run(["--terms-file", path.join(tmp, "none")], { env: {} });
ok(noFile.status === 1 && mended(noFile.out) && !noFile.out.includes(tmp), "a file that cannot be read fails, says the mend, and names no path", noFile.out);
ok(/--terms-file/.test(job.out) && /never typed into a chat/.test(job.out) && !/TERMS=/.test(job.out), "the job's mend gives the list by a file, never typed into a chat", job.out);

const inJob = run(["--private"]);
const inCi = run(["--private"], { env: { TERMS, CI: "true" } });
ok(inCi.status === 1 && mended(inCi.out) && inCi.asked.length === 0, "--private where another runner says CI fails too, reading nothing", inCi.out);
ok(inJob.status === 1 && mended(inJob.out) && inJob.edits.length === 0 && inJob.asked.length === 0, "--private in a job fails, reads nothing, and says the mend", inJob.out);
const bad = run(["--days", "x"]);
ok(bad.status === 1 && mended(bad.out), "a wrong option fails and says the mend", bad.out);
const none = run([], { env: { GITHUB_ACTIONS: "true" } });
ok(none.status === 0 && none.asked.length === 0 && /no terms are given here/.test(none.out), "without TERMS it reads nothing and says so", none.out);

done("the check of issue and comment text for the personal terms");
