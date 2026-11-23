// Tests busy-records.mjs, which files two merged pull requests each added to within a week (#860): what is read through
// a gh that answers from fixtures, a rebase merge and a squash each one pull request, what counts as adding to a file,
// the host's answers refused where too deep or of another form, and each failure's mend, from a run in this process.
// Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/busy-records-test.mjs
import { addedTo, busy, main, options, read, report } from "../scripts/busy-records.mjs";
import { mended } from "../scripts/mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };

// ---- which files are busy ----
const p = (number, day, files) => ({ number, at: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`, files });
const found = busy([p(4, 9, ["z.md", "a.md"]), p(3, 20, ["b.md", "a.md"]), p(2, 6, ["a.md", "b.md"]), p(1, 2, ["QUEUE.md", "a.md"]), p(5, 28, ["b.md", "b.md"]), p(6, 12, ["z.md"])]);
ok(JSON.stringify(found) === JSON.stringify([{ file: "a.md", pulls: [1, 2, 4] }, { file: "z.md", pulls: [4, 6] }]),
  "a file two pull requests merged within a week of each other added to is busy, with every pull request of such a pair, oldest first, the files by name; one they added to further apart, or one alone added to, is not", JSON.stringify(found));
ok(busy([p(1, 1, ["a.md"]), p(2, 8, ["a.md"])]).length === 1 && busy([p(1, 1, ["a.md"]), { number: 2, at: "2026-11-08T12:00:01Z", files: ["a.md"] }]).length === 0,
  "a week is seven days to the second");
ok(busy([p(1, 3, ["a.md", "a.md"])]).length === 0, "a file named twice by one pull request is that pull request's once");

// ---- what is read through gh ----
const pulls = [
  { number: 10, merged_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-20T10:00:00Z", base: { ref: "main" } },
  { number: 11, merged_at: "2026-11-21T10:00:00Z", updated_at: "2026-11-21T10:00:00Z", base: { ref: "main" } },
  { number: 12, merged_at: "2026-11-21T11:00:00Z", updated_at: "2026-11-21T11:00:00Z", base: { ref: "other" } },
  { number: 13, merged_at: null, updated_at: "2026-11-22T10:00:00Z", base: { ref: "main" } },
  { number: 14, merged_at: "2026-10-01T10:00:00Z", updated_at: "2026-11-22T11:00:00Z", base: { ref: "main" } },
];
const many = Array.from({ length: 100 }, (_, i) => ({ filename: `big/${i}.md`, status: "added", additions: 1 }));
const files = {
  // (a rebase merge: its several commits, one pull request, as the host lists its files)
  10: [{ filename: "log.md", status: "modified", additions: 3 }, { filename: "gone.md", status: "removed", additions: 0 }, { filename: "cut.md", status: "modified", additions: 0 }],
  11: [{ filename: "log.md", status: "modified", additions: 1 }, { filename: "cut.md", status: "modified", additions: 0 }],
  12: [{ filename: "log.md", status: "modified", additions: 1 }],
  15: [...many, { filename: "last.md", status: "added", additions: 2 }],
};
const asked = [];
const gh = route => {
  asked.push(route);
  if (route === "repos/o/r") return JSON.stringify({ default_branch: "main" });
  if (route.startsWith("repos/o/r/pulls?")) return JSON.stringify(/page=1(?!\d)/u.test(route) ? pulls : []);
  const m = /^repos\/o\/r\/pulls\/(\d+)\/files\?per_page=100&page=(\d+)$/u.exec(route);
  if (m) { const all = files[m[1]] ?? []; return JSON.stringify(all.slice((m[2] - 1) * 100, m[2] * 100)); }
  throw new Error(`no fixture for ${route}`);
};
const merged = read("o/r", 28, Date.parse("2026-11-23T00:00:00Z"), gh);
ok(JSON.stringify(merged.map(x => x.number)) === "[10,11]", "only the pull requests merged into the default branch in the days read are read, never one closed unmerged, merged elsewhere or before", JSON.stringify(merged));
ok(JSON.stringify(merged.map(x => x.files)) === '[["log.md"],["log.md"]]', "a pull request adds to a file it added lines to, never one it only deleted from or removed", JSON.stringify(merged));
ok(!asked.some(r => /pulls\/(12|13|14)\/files/u.test(r)), "the files of a pull request not counted are not asked for");
ok(JSON.stringify(busy(merged)) === '[{"file":"log.md","pulls":[10,11]}]', "so a rebase merge's commits read as one pull request, whatever the clone holds");
ok(addedTo("o/r", 15, gh).length === 101, "a pull request's files are read page by page");
ok(report(busy(merged), merged.length, 28).join("\n") === "2 pull request(s) merged into the default branch in the last 28 days; 1 file(s) two of them added to within a week:\n  log.md  (#10, #11)",
  "it prints the count read and each busy file with its pull requests");

// ---- what the host may answer ----
const deep = "[".repeat(300) + "]".repeat(300);
const answering = (route, text) => r => (r.startsWith(route) ? text : gh(r));
let threw = "";
try { read("o/r", 28, Date.parse("2026-11-23T00:00:00Z"), answering("repos/o/r/pulls?", deep)); } catch (e) { threw = e.message; }
ok(/nests deeper/u.test(threw), "an answer nested deeper than the core reads is refused", threw);
threw = "";
try { addedTo("o/r", 10, answering("repos/o/r/pulls/10/files", JSON.stringify([{ filename: { x: 1 }, additions: 1 }]))); } catch (e) { threw = e.message; }
ok(threw === "the host's answer holds a file not of the form read", "a file not of the form read is refused, never printed", threw);
threw = "";
try { read("o/r", 28, Date.parse("2026-11-23T00:00:00Z"), answering("repos/o/r/pulls?", JSON.stringify([{ number: "10", merged_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-20T10:00:00Z", base: { ref: "main" } }]))); } catch (e) { threw = e.message; }
ok(threw === "the host's answer holds a pull request not of the form read", "a pull request not of the form read is refused", threw);
threw = "";
try { read("o/r", 28, Date.parse("2026-11-23T00:00:00Z"), answering("repos/o/r", JSON.stringify({ name: "r" }))); } catch (e) { threw = e.message; }
ok(threw === "the host's answer holds a default branch not of the form read", "an answer about the repository with no default branch is refused, never read as a month with no merge", threw);
ok(report([{ file: "a\u001b[2Jb\nc.md", pulls: [1, 2] }], 2, 7)[1] === "  a?[2Jb?c.md  (#1, #2)", "a file's name is printed on one line, its control characters shown as ?");

// ---- a run ----
const runs = (argv, opts) => { const out = [], err = []; const code = main(argv, { out: l => out.push(l), err: l => err.push(l), ...opts }); return { code, out: out.join("\n"), err: err.join("\n") }; };
const good = runs(["--repo", "o/r", "--days", "28"], { gh, now: Date.parse("2026-11-23T00:00:00Z") });
ok(good.code === 0 && good.out.endsWith("log.md  (#10, #11)") && good.err === "", "a run prints the report and exits 0", JSON.stringify(good));
const noGh = runs(["--repo", "o/r"], { gh: () => { throw new Error("gh: not found\nmore"); } });
ok(noGh.code === 1 && mended(noGh.err) && noGh.err.includes("could not be read: gh: not found. Mend: sign gh in"), "where the host cannot be read, it says so with its mend and exits 1", noGh.err);
// ---- what it is told ----
ok(JSON.stringify(options(["--repo", "o/r"])) === '{"repo":"o/r","days":31}' && JSON.stringify(options(["--days", "7"], () => "a/b")) === '{"repo":"a/b","days":7}',
  "it reads the repository named, else this clone's, and 31 days unless told the days");
ok(["x", "0", "1.5", "3651", "1000000000"].every(d => options(["--repo", "o/r", "--days", d]).why === `--days ${d} is no whole number of days from 1 to 3650`) && options(["--repo", "o/r", "--days", "3650"]).days === 3650,
  "a --days that is no whole number of days from 1 to 3650 is refused, saying so");
ok(["o", "o/r/x", "../r", "o/..", "o/r?x=1"].every(r => options(["--repo", r]).why === `--repo ${r} is no owner/name`), "a --repo that is no owner/name is refused, saying so");
ok(options([], () => null).why === "no repository named, and none read from this clone" && /--bogus/u.test(options(["--bogus"]).why), "no repository, or an option it does not know, is refused, saying so");
const bad = runs(["--repo", "o/r", "--days", "0"], { gh: () => { throw new Error("not asked"); } });
ok(bad.code === 1 && bad.err.includes("--days 0 is no whole number") && mended(bad.err), "a refusal is printed with its mend, and it exits 1", bad.err);

console.log(`${count - failed} of ${count} assertions on the busy records' reader passed`);
if (failed) process.exit(1);
