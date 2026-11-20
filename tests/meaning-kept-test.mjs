// Checks the reader of a change that keeps the meaning (scripts/meaning-kept.mjs; #886, point 2): the design check's
// line "Meaning unchanged:", read for the description check, and the state report's list of the changes to the floor
// and the review guidelines merged, each saying whether it quoted the owner's yes. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/meaning-kept-test.mjs
import { mended } from "../scripts/mend.mjs";
import { floorChanges, main, mergedFiles, numberOf, pathsOf, stated, statedOf } from "../scripts/meaning-kept.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

// The design check's statement that a change keeps its meaning (meaning-kept.mjs; #886, point 2).
{
  ok(pathsOf("Design check: x\nMeaning unchanged: `floor/security.md`, roles/shared/review-guidelines.md.\n  Meaning unchanged: floor/a.md\nNot: Meaning unchanged: floor/b.md").join() === "floor/security.md,roles/shared/review-guidelines.md,floor/a.md",
    "the paths are read from lines of their own that open the mark, out of backticks, a closing stop dropped; a mark inside a line is none");
  const A = "a".repeat(40), B = "b".repeat(40), design = (sha, more = "") => ({ comment: true, body: `Design check: ${sha}\nBlocking findings: 0.\nOther findings: 0.\nScore: 10 of 10.\n${more}` });
  const M = "9".repeat(40), blobs = { [`${A}:floor/security.md`]: "x1", [`${B}:floor/security.md`]: "x0", "head:floor/security.md": "x1", [`${A}:roles/shared/review-guidelines.md`]: "g1", "head:roles/shared/review-guidelines.md": "g1",
    [`${M}:floor/security.md`]: "x0", "base:floor/security.md": "x0" };
  const blob = (at, p) => blobs[`${at}:${p}`] ?? null, asked = ["floor/security.md", "roles/shared/review-guidelines.md"], base = () => M;
  const say = "Meaning unchanged: floor/security.md";
  ok(stated({ notes: [design(A, say)], asked, blob, base }).join() === "floor/security.md", "a path the newest design check names keeps its meaning where the commit it names holds the head's text; a path it does not name asks the yes");
  ok(stated({ notes: [design(B, say)], asked, blob, base }).length === 0, "a statement on a commit whose text differs from the head's states nothing: the change after it was not read");
  ok(stated({ notes: [design(A, say), design(A)], asked, blob, base }).length === 0 && stated({ notes: [design(A), design(A, say)], asked, blob, base }).length === 1,
    "the newest design check decides: a later one that leaves the line out takes it back");
  ok(stated({ notes: [{ comment: false, body: `Design check: ${A}\n${say}` }], asked, blob, base }).length === 0 && stated({ notes: [{ comment: true, body: `Code review: ${A}\n${say}` }], asked, blob, base }).length === 0
    && stated({ notes: [design("c".repeat(39), say)], asked, blob, base }).length === 0, "the description, which its builder writes, another kind of review and a design check naming no whole SHA state nothing");
  ok(stated({ notes: [design(A, say)], asked, blob: (at, p) => (at === "base" ? "x2" : blob(at, p)), base }).length === 0 && stated({ notes: [design(A, say)], asked, blob, base: () => null }).length === 0,
    "where the base branch changed the file since the commit the design check names, or their merge base cannot be read, nothing is stated: a merge whose settling undid that change was never read");
  ok(numberOf("refs/pull/893/merge") === "893" && numberOf("refs/heads/main") === null && numberOf(undefined) === null, "the pull request's number is read from the merge ref alone");
  // through a host and git, as the description check reads them on the merge commit (HEAD^2 the head)
  const at = "e".repeat(40), one = "1".repeat(40);
  const host = (sha, more = "") => (route, query) => ({ "repos/o/r/issues/5": { user: { login: "boss" }, body: `Design check: ${sha}\n${say}`, node_id: "I_5" },
    "repos/o/r/issues/5/comments?per_page=100&page=1": [{ user: { login: "boss" }, body: `Design check: ${sha}\n${say}\n${more}`, node_id: "C_5" }],
    "repos/o/r/collaborators/boss/permission": { role_name: "admin", user: { type: "User" } },
    [`repos/o/r/compare/${"0".repeat(40)}...${sha}?per_page=1`]: { merge_base_commit: { sha: M } },
    [`repos/o/r/git/trees/${M}?recursive=1`]: { truncated: false, tree: [{ path: "floor/security.md", type: "blob", sha: "d".repeat(40) }] },
    [`repos/o/r/git/trees/${sha}?recursive=1`]: { truncated: false, tree: [{ path: "floor", type: "tree", sha: one }, { path: "floor/security.md", type: "blob", sha: at }] } }[route]
    // (the edits are given only where the query asks of the texts read: the query is passed on)
    ?? (route === "graphql" && /"C_5"/u.test(String(query)) ? { data: { nodes: [{ id: "I_5", lastEditedAt: null }, { id: "C_5", lastEditedAt: null }] } } : null));
  const run = args => ({ "--literal-pathspecs ls-tree -z --full-tree HEAD^2 -- floor/security.md": `100644 blob ${at}\tfloor/security.md\0`,
    "--literal-pathspecs ls-tree -z --full-tree HEAD^1 -- floor/security.md": `100644 blob ${"d".repeat(40)}\tfloor/security.md\0`, "rev-parse --verify --quiet HEAD^1": `${"0".repeat(40)}\n` }[args.join(" ")]
    ?? (args.includes("ls-tree") ? "" : null)), plain = () => ({ self: false });
  const asked1 = ["floor/security.md"], read1 = opts => statedOf({ cwd: ".", repo: "o/r", number: "5", asked: asked1, gh: host(one), run, change: plain, ...opts });
  ok(read1({}).join() === "floor/security.md", "the design check's statement on the head is read through the host and git");
  ok(read1({ number: null }).length === 0 && read1({ gh: () => null }).length === 0 && read1({ run: () => null }).length === 0 && read1({ repo: "o r" }).length === 0,
    "no pull request's number, a host that answers nothing, a head git cannot give, or a repository out of its form, states nothing");
  ok(read1({ change: () => ({ self: "scripts/pr-description.mjs" }) }).length === 0 && read1({ change: () => null }).length === 0,
    "where the pull request changes the check that reads it, or git cannot say what it changes, the statement counts for nothing: the code that reads it is main's");
  const tree = entries => (route, query) => (route.startsWith("repos/o/r/git/trees/") ? entries : host(one)(route, query));
  ok(read1({ gh: tree({ truncated: false, tree: [{ path: "floor/security.md", type: "tree", sha: at }] }) }).length === 0
    && read1({ gh: tree({ truncated: true, tree: [{ path: "floor/security.md", type: "blob", sha: at }] }) }).length === 0,
    "a path the host gives as no file, or a tree it gives cut short, states nothing");
  // a file the change deletes, its text moved or merged: absent at the commit named and at the head
  const gone = ["floor/old.md"], deleted = { truncated: false, tree: [{ path: "floor/security.md", type: "blob", sha: at }] };
  ok(statedOf({ cwd: ".", repo: "o/r", number: "5", asked: gone, gh: (r, q) => (r.startsWith("repos/o/r/git/trees/") ? deleted : host(one, "Meaning unchanged: floor/old.md")(r, q)), run, change: plain }).join() === "floor/old.md"
    && statedOf({ cwd: ".", repo: "o/r", number: "5", asked: gone, gh: host(one, "Meaning unchanged: floor/old.md"), run: args => (args.includes("ls-tree") ? `100644 blob ${at}\tfloor/old.md\0` : null), change: plain }).length === 0
    && statedOf({ cwd: ".", repo: "o/r", number: "5", asked: gone, gh: (r, q) => (r.startsWith("repos/o/r/git/trees/") ? null : host(one, "Meaning unchanged: floor/old.md")(r, q)), run, change: plain }).length === 0,
    "a deleted file is stated where the host's whole tree and git each show it absent; one present at either, or a tree not given, states nothing");
  // the comments read in part: a newer design check, unread, may take the statement back
  const full = Array.from({ length: 100 }, (_, i) => ({ user: { login: "x[bot]" }, body: "", node_id: `B_${i}` }));
  ok(read1({ gh: (r, q) => (r === "repos/o/r/issues/5/comments?per_page=100&page=1" ? [...host(one)(r, q), ...full.slice(1)] : r.endsWith("page=2") ? null : host(one)(r, q)) }).length === 0
    && read1({ gh: (r, q) => (r === "graphql" ? null : host(one)(r, q)) }).length === 0,
    "where a page of the comments, or a text's edits, cannot be read, nothing is stated");
  // the state report's list
  const pulls = [{ number: 1, title: "Kept", body: "x", files: ["floor/security.md", "a.md"] }, { number: 2, title: "Asked", body: "## The owner's word\n\n> yes\n", files: ["floor/security.md"] },
    { number: 3, title: "Other", body: "", files: ["tasks/x.md"] }, { number: 4, title: "Dark", body: "", files: null }];
  ok(floorChanges(pulls).join("\n") === "- #1 Kept: floor/security.md; no yes quoted.\n- #2 Asked: floor/security.md; a yes quoted.\n- Not read: the files of 1 merged pull request, which the host did not give whole (gh)."
    && floorChanges([]).join() === "- None." && floorChanges(null) === null,
    "the state report lists each merged change to the floor or the guidelines, those that quote no yes first, and says what it could not read");
  const page = n => Array.from({ length: n }, (_, i) => ({ filename: `f${i}.md` }));
  const files = route => ({ "repos/o/r/pulls/7/files?per_page=100&page=1": [{ filename: "floor/new.md", previous_filename: "floor/security.md" }, { filename: "a.md" }],
    "repos/o/r/pulls/9/files?per_page=100&page=1": page(100), "repos/o/r/pulls/9/files?per_page=100&page=2": page(3) }[route] ?? null);
  const listed = mergedFiles({ repo: "o/r", from: "", to: "", gh: files, list: () => [{ number: 7, title: "t", body: null }, { number: 8, title: "u" }, { number: 9, title: "v" }] });
  ok(listed[0].files.join() === "floor/new.md,floor/security.md,a.md" && listed[0].body === "" && listed[1].files === null && listed[2].files.length === 103
    && mergedFiles({ repo: "o/r", from: "", to: "", list: () => { throw new Error("x"); } }) === null,
    "the files of each merged pull request, of any merge method, and those it renamed away from, are read from the host page by page; a list it does not give is unread");
}
// the command the session that takes the state report runs: a month or a repository out of its form fails with its mend
const said = [], code = main(["--month", "11"], line => said.push(line)), other = [], wrong = main(["--month", "2026-11", "--repo", "a b"], line => other.push(line));
ok(code === 1 && mended(said.join("\n")) && wrong === 1 && mended(other.join("\n")), "the command fails a month or a repository out of its form, saying its mend");
console.log(`${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
