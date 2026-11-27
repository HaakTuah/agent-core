// Tests of the scheduled look's reader of the files past the split mark whose question stands (look-split.mjs; #1413,
// point 6), and of the one judgement it and the reading-size check share (split-mark.mjs): on scratch repositories,
// in the core's form and a project's. Git and Node's own modules.
//
//   node tests/look-split-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ASKED_SINCE, CORE_MARKS, SPLIT_TITLE, splitAsked } from "../scripts/look-split.mjs";
import { unanswered } from "../scripts/split-mark.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const tmp = scratchDir("look-split-");
const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const day = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString();
const commit = (dir, when, what) => { git(dir, "add", "-A"); execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", what], { env: { ...env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } }); };
const big = n => "a line of a long file\n".repeat(Math.ceil(n / 22));

// the judgement: what answers the question, and what leaves it standing
ok(unanswered(30000, undefined) === `it has no line under "past"` && unanswered(30000, 30000) === null && /grown past its mark alone/.test(unanswered(30001, 30000))
  && /a mark alone, with no why/.test(unanswered(30000, 30000, false)) && /gives no why/.test(unanswered(30000, { mark: 30000, why: " " }))
  && unanswered(30000, { mark: 25000, why: "#812" }) === null && unanswered(30000, { mark: 24000, why: "read whole" }) === null && /more than a quarter past its mark of 23000/.test(unanswered(30000, { mark: 23000, why: "read whole" })),
  "a line answers the question with its why or its split's issue, a mark alone that stood until its file grows past it, and none once its file grows a quarter past its mark");

// a repository as the core holds it: its marks in .github/sizes.json, a split mark of 20 KB
const repo = (name, marksAt, past = {}) => {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, path.dirname(marksAt)), { recursive: true });
  git(tmp, "init", "-q", "-b", "main", dir);
  const marks = past => fs.writeFileSync(path.join(dir, marksAt), JSON.stringify({ each: 1024, read: {}, total: 1024, split: 20480, skip: ["archive/"], past }));
  for (const f of ["old.md", "asked.md", "answered.md", "grown.md", "small.md", "archive/record.md", "core/big.md"]) {
    fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), f === "small.md" ? "short\n" : big(24000));
  }
  marks(past);
  commit(dir, day(ASKED_SINCE, -30), "the files, before the question moved to the look");
  return { dir, marks };
};
const core = repo("core", CORE_MARKS);
// (changed since: one with no line, one whose line answers it, one grown a quarter past its line, a small one, a dated
// record and the core's copy; one changed only before then)
for (const f of ["asked.md", "answered.md", "grown.md", "small.md", "archive/record.md", "core/big.md"]) fs.appendFileSync(path.join(core.dir, f), "one more line\n");
core.marks({ "answered.md": { mark: 24100, why: "every reader of it reads it whole" }, "grown.md": { mark: 18000, why: "#99" } });
commit(core.dir, day(ASKED_SINCE, 1), "changes since");
let r = splitAsked({ manifest: null, root: core.dir });
const listed = [...String(r?.body).matchAll(/^- `([^`]+)`/gmu)].map(m => m[1]);
ok(r?.title === SPLIT_TITLE && listed.join() === "asked.md,grown.md" && /it has no line under "past"/.test(r.body) && /grown more than a quarter past its mark of 18000/.test(r.body) && /\{ "mark": \d+, "why": /.test(r.body),
  "in the core it lists each file past the split mark the default branch changed since the question moved to the look and no line answers, with the line to write; not one changed only before, one answered, a small one, a dated record or the core's copy", JSON.stringify(r));
ok(/fails no pull request/.test(r.body) && /split it along one in a pull request of its own/.test(r.body), "its issue says it is a task that fails nothing, and how it is answered", r.body);
core.marks({ "asked.md": { mark: 24100, why: "#100" }, "answered.md": { mark: 24100, why: "every reader of it reads it whole" }, "grown.md": { mark: 24100, why: "#99" } });
commit(core.dir, day(ASKED_SINCE, 2), "the questions answered");
r = splitAsked({ manifest: null, root: core.dir });
ok(r?.title === SPLIT_TITLE && r.body === null, "once every line answers, its body is null, which closes the issue", JSON.stringify(r));
// (a branch whose commit was made before the question moved to the look, merged since; and a mark alone written since,
// where one that stood before answers)
git(core.dir, "checkout", "-q", "-b", "branch", "HEAD");
fs.appendFileSync(path.join(core.dir, "old.md"), "one more line\n");
commit(core.dir, day(ASKED_SINCE, -10), "a change on a branch, made before");
git(core.dir, "checkout", "-q", "main");
execFileSync("git", ["-C", core.dir, "merge", "-q", "--no-ff", "-m", "the branch merged since", "branch"], { env: { ...env, GIT_AUTHOR_DATE: day(ASKED_SINCE, 3), GIT_COMMITTER_DATE: day(ASKED_SINCE, 3) } });
r = splitAsked({ manifest: null, root: core.dir });
ok([...String(r?.body).matchAll(/^- `([^`]+)`/gmu)].map(m => m[1]).join() === "old.md", "a branch whose commits were made before the question moved to the look, merged since, is read as changed on the day it merged", JSON.stringify(r));
core.marks({ "old.md": 24100, "asked.md": { mark: 24100, why: "#100" }, "answered.md": { mark: 24100, why: "every reader of it reads it whole" }, "grown.md": { mark: 24100, why: "#99" } });
commit(core.dir, day(ASKED_SINCE, 4), "a mark alone written since");
r = splitAsked({ manifest: null, root: core.dir });
ok(/`old\.md`, \d+ bytes: its line under "past" is a mark alone, with no why/.test(String(r?.body)), "a mark alone written since says no why, as at the check, and the question stands", JSON.stringify(r));
const stood = repo("stood", CORE_MARKS, { "asked.md": 24100 });
fs.appendFileSync(path.join(stood.dir, "asked.md"), "one more line\n");
commit(stood.dir, day(ASKED_SINCE, 1), "a change since");
ok(splitAsked({ manifest: null, root: stood.dir })?.body === null, "a mark alone that stood before the question moved to the look answers, until its file grows past it", JSON.stringify(splitAsked({ manifest: null, root: stood.dir })));
fs.writeFileSync(path.join(stood.dir, "tick`ed.md"), big(24000));
commit(stood.dir, day(ASKED_SINCE, 2), "a file whose name holds a backtick");
r = splitAsked({ manifest: null, root: stood.dir });
ok(String(r?.body).includes("- `tick?ed.md`, ") && !String(r?.body).includes("tick`ed"), "a backtick in a file's name is shown as \"?\", so the name cannot write the issue's text", JSON.stringify(r));

// a project: its marks where its run of the check reads them, the starter kit's path where nothing names another
const project = repo("project", "checks/sizes.json");
fs.writeFileSync(path.join(project.dir, "core-manifest.md"), "# Core manifest\n");
fs.appendFileSync(path.join(project.dir, "asked.md"), "one more line\n");
commit(project.dir, day(ASKED_SINCE, 1), "a change since");
r = splitAsked({ manifest: "# Core manifest\n", root: project.dir });
ok([...String(r?.body).matchAll(/^- `([^`]+)`/gmu)].map(m => m[1]).join() === "asked.md" && r.body.includes("`checks/sizes.json`"), "in a project it reads the marks its check reads, and lists the file changed since, its copy of the core left out", JSON.stringify(r));
fs.rmSync(path.join(project.dir, "checks/sizes.json"));
ok(splitAsked({ manifest: "# Core manifest\n", root: project.dir }) === null, "a project with no marks keeps no issue");

// what cannot be read leaves the issue as it stands
fs.writeFileSync(path.join(core.dir, CORE_MARKS), "not JSON");
ok(/could not be read as JSON/.test(splitAsked({ manifest: null, root: core.dir })?.unread ?? ""), "marks that cannot be read leave the issue as it stands");
core.marks({});
const shallow = path.join(tmp, "shallow");
git(tmp, "clone", "-q", "--depth", "1", `file://${core.dir}`, shallow);
ok(/history is shallow/.test(splitAsked({ manifest: null, root: shallow })?.unread ?? ""), "a shallow history leaves the issue as it stands, never closing it on a part of the history");
ok(splitAsked({ manifest: null, root: path.join(tmp, "none") }) === null, "where no repository stands it keeps nothing");

console.log(failed ? `\n${failed} of ${count} failed` : `ok   ${count} assertions on the look's reader of the split mark`);
process.exit(failed ? 1 : 0);
