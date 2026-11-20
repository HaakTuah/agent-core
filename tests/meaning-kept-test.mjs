// Checks the reader of a change that keeps the meaning (scripts/meaning-kept.mjs; #886, point 2): the design check's
// line "Meaning unchanged:", read for the description check, and the state report's list of the changes to the floor
// and the review guidelines merged without the owner's yes. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/meaning-kept-test.mjs
import { mended } from "../scripts/mend.mjs";
import { main, mergedFiles, numberOf, pathsOf, stated, statedOf, withoutYes } from "../scripts/meaning-kept.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

// The design check's statement that a change keeps its meaning (meaning-kept.mjs; #886, point 2).
{
  ok(pathsOf("Design check: x\nMeaning unchanged: `floor/security.md`, roles/shared/review-guidelines.md.\n  Meaning unchanged: floor/a.md\nNot: Meaning unchanged: floor/b.md").join() === "floor/security.md,roles/shared/review-guidelines.md,floor/a.md",
    "the paths are read from lines of their own that open the mark, out of backticks, a closing stop dropped; a mark inside a line is none");
  const A = "a".repeat(40), B = "b".repeat(40), design = (sha, more = "") => ({ comment: true, body: `Design check: ${sha}\nBlocking findings: 0.\nOther findings: 0.\nScore: 10 of 10.\n${more}` });
  const blobs = { [`${A}:floor/security.md`]: "x1", [`${B}:floor/security.md`]: "x0", "head:floor/security.md": "x1", [`${A}:roles/shared/review-guidelines.md`]: "g1", "head:roles/shared/review-guidelines.md": "g1" };
  const blob = (sha, p) => blobs[`${sha ?? "head"}:${p}`] ?? null, asked = ["floor/security.md", "roles/shared/review-guidelines.md"];
  const say = "Meaning unchanged: floor/security.md";
  ok(stated({ notes: [design(A, say)], asked, blob }).join() === "floor/security.md", "a path the newest design check names keeps its meaning where the commit it names holds the head's text; a path it does not name asks the yes");
  ok(stated({ notes: [design(B, say)], asked, blob }).length === 0, "a statement on a commit whose text differs from the head's states nothing: the change after it was not read");
  ok(stated({ notes: [design(A, say), design(A)], asked, blob }).length === 0 && stated({ notes: [design(A), design(A, say)], asked, blob }).length === 1,
    "the newest design check decides: a later one that leaves the line out takes it back");
  ok(stated({ notes: [{ comment: false, body: `Design check: ${A}\n${say}` }], asked, blob }).length === 0 && stated({ notes: [{ comment: true, body: `Code review: ${A}\n${say}` }], asked, blob }).length === 0
    && stated({ notes: [design("c".repeat(39), say)], asked, blob }).length === 0, "the description, which its builder writes, another kind of review and a design check naming no whole SHA state nothing");
  ok(numberOf("refs/pull/893/merge") === "893" && numberOf("refs/heads/main") === null && numberOf(undefined) === null, "the pull request's number is read from the merge ref alone");
  // through a host and git, as the description check reads them on the merge commit (HEAD^2 the head)
  const at = "e".repeat(40), one = "1".repeat(40);
  const host = (sha, more = "") => route => ({ "repos/o/r/issues/5": { user: { login: "boss" }, body: `Design check: ${sha}\n${say}`, node_id: "I_5" },
    "repos/o/r/issues/5/comments?per_page=100&page=1": [{ user: { login: "boss" }, body: `Design check: ${sha}\n${say}\n${more}`, node_id: "C_5" }],
    "repos/o/r/collaborators/boss/permission": { role_name: "admin", user: { type: "User" } },
    [`repos/o/r/contents/floor/security.md?ref=${sha}`]: { type: "file", sha: at } }[route] ?? (route === "graphql" ? { data: { nodes: [{ id: "I_5", lastEditedAt: null }, { id: "C_5", lastEditedAt: null }] } } : null));
  const run = args => (args.join(" ") === "rev-parse --verify --quiet HEAD^2:floor/security.md" ? `${at}\n` : null), plain = () => ({ self: false });
  const asked1 = ["floor/security.md"], read1 = opts => statedOf({ cwd: ".", repo: "o/r", number: "5", asked: asked1, gh: host(one), run, change: plain, ...opts });
  ok(read1({}).join() === "floor/security.md", "the design check's statement on the head is read through the host and git");
  ok(read1({ number: null }).length === 0 && read1({ gh: () => null }).length === 0 && read1({ run: () => null }).length === 0 && read1({ repo: "o r" }).length === 0,
    "no pull request's number, a host that answers nothing, a head git cannot give, or a repository out of its form, states nothing");
  ok(read1({ change: () => ({ self: "scripts/pr-description.mjs" }) }).length === 0 && read1({ change: () => null }).length === 0,
    "where the pull request changes the check that reads it, or git cannot say what it changes, the statement counts for nothing: the code that reads it is main's");
  ok(read1({ gh: route => (route.startsWith("repos/o/r/contents/") ? { type: "dir", sha: at } : host(one)(route)) }).length === 0, "a path the host gives as no file states nothing");
  // the state report's list
  const pulls = [{ number: 1, title: "Kept", body: "x", files: ["floor/security.md", "a.md"] }, { number: 2, title: "Asked", body: "## The owner's word\n\n> yes\n", files: ["floor/security.md"] },
    { number: 3, title: "Other", body: "", files: ["tasks/x.md"] }, { number: 4, title: "Dark", body: "", files: null }];
  ok(withoutYes(pulls).join("\n") === "- #1 Kept: floor/security.md.\n- Not read: the files of 1 merged pull request, which git here could not give (a shallow clone: git fetch --unshallow origin main, then run it again)." && withoutYes([]).join() === "- None." && withoutYes(null) === null,
    "the state report lists each merged change to the floor or the guidelines that quotes no yes, and says what it could not read");
  const merge = "f".repeat(40), files = args => (args.join(" ") === `diff --name-only --no-renames -z ${merge}^1 ${merge}` ? "floor/security.md\0scripts/pr-description.mjs\0" : null);
  const listed = mergedFiles({ repo: "o/r", from: "", to: "", run: files, list: () => [{ number: 7, title: "t", body: null, merge_commit_sha: merge }, { number: 8, title: "u", merge_commit_sha: "nope" }, { number: 9, title: "v", merge_commit_sha: "0".repeat(40) }] });
  ok(listed[0].files.join() === "floor/security.md,scripts/pr-description.mjs" && listed[0].body === "" && listed[1].files === null && listed[2].files === null
    && mergedFiles({ repo: "o/r", from: "", to: "", list: () => { throw new Error("x"); } }) === null,
    "the files of each merged pull request are read from git, its merge commit against its base; a commit git cannot give, or no commit, is unread");
}
// the command the session that takes the state report runs: a month or a repository out of its form fails with its mend
const said = [], code = main(["--month", "11"], line => said.push(line)), other = [], wrong = main(["--month", "2026-11", "--repo", "a b"], line => other.push(line));
ok(code === 1 && mended(said.join("\n")) && wrong === 1 && mended(other.join("\n")), "the command fails a month or a repository out of its form, saying its mend");
console.log(`${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
