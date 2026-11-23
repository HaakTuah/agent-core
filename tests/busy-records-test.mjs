// Tests busy-records.mjs, which files two merged pull requests each added to within a week (#860): what is read through
// a gh that answers from fixtures, a rebase merge and a squash each one pull request, what counts as adding to a file,
// and the failure's mend where the host cannot be read. Its tests workflow runs it on every pull request here. Node's
// own modules.
//
//   node tests/busy-records-test.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addedTo, busy, read, report } from "../scripts/busy-records.mjs";
import { mended } from "../scripts/mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- which files are busy ----
const p = (number, day, files) => ({ number, at: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`, files });
const found = busy([p(1, 2, ["QUEUE.md", "a.md"]), p(2, 6, ["a.md", "b.md"]), p(3, 20, ["b.md"]), p(4, 9, ["a.md"]), p(5, 28, ["b.md", "b.md"])]);
ok(JSON.stringify(found) === JSON.stringify([{ file: "a.md", pulls: [1, 2, 4] }]),
  "a file two pull requests merged within a week of each other added to is busy, with every pull request of such a pair, oldest first; one they added to further apart, or one alone added to, is not", JSON.stringify(found));
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

// ---- the failures ----
const run = (...a) => spawnSync(process.execPath, [path.join(root, "scripts/busy-records.mjs"), ...a], { encoding: "utf8", env: { ...process.env, PATH: "", GITHUB_REPOSITORY: "" } });
const noGh = run("--repo", "o/r");
ok(noGh.status === 1 && mended(noGh.stderr), "where the host cannot be read, it says so with its mend and exits 1", noGh.stderr);
const badDays = run("--repo", "o/r", "--days", "x");
ok(badDays.status === 1 && /--days x/u.test(badDays.stderr) && mended(badDays.stderr), "a --days that is no whole number is refused with its mend", badDays.stderr);

console.log(`${count - failed} of ${count} assertions on the busy records' reader passed`);
if (failed) process.exit(1);
