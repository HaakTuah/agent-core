// Checks the personal-terms check (floor rule 11; .github/workflows/personal-terms.yml): its own job, run as GitHub
// runs it (workflow-run.mjs, beside this file), on scratch pull requests, each checked out as GitHub checks one out: its
// merge into its base. What fails: a term in a file, in a line a commit adds and a later one takes away, in a line a
// merge's own resolution adds, in a file's name (an empty file, a rename, a binary file, a name outside plain ASCII),
// in a commit's message, author or committer (name or address), and in the title or description. What passes: none of
// these; a term only in a file git reads as binary (not read); only in a commit from before the rule; only in the
// author of a merge GitHub itself made (floor rule 11's exception); only in a commit of the base's, though the event
// names an older base; and a repository without the secret. The terms are invented, built from pieces as the test
// runs, so no file holds them. On Linux and on Windows. Git, bash and Node's own modules.
//
//   node scripts/personal-terms-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkflow } from "./workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 800).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/personal-terms.yml"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "personal-terms-test-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
const [term, other, wide] = [["qz", "vk", "wy"], ["xj", "qq", "zf"], ["zç", "qñ", "x"]].map(t => t.join(""));
const TERMS = `${term}\n${other}\n${wide}\n`;
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: "2026-11-13T12:00:00Z", GIT_COMMITTER_DATE: "2026-11-13T12:00:00Z" });
const ME = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
const GITHUB = { GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" };
const git = (dir, args, extra = {}) => execFileSync("git", args, { cwd: dir, env: { ...env, ...ME, ...extra }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

let n = 0;
const put = (dir, files) => { for (const [name, text] of Object.entries(files)) { const at = path.join(dir, name); if (text === null) fs.rmSync(at); else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); } } };
const commitAll = (dir, [files, extra = {}, message = "a change"]) => { if (typeof files === "function") files(dir); else put(dir, files); git(dir, ["add", "-A"]); git(dir, ["commit", "-q", "--allow-empty", "-m", message], extra); };
// A repository whose main holds a first commit and then `onMain`, and a pull request's branch, `change`, from the first
// commit with its `commits` (each [files or a function of the folder, extra env, message]).
function pull(commits, onMain = []) {
  const dir = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  commitAll(dir, [{ "README.md": "# A project\n", "a.md": "one\ntwo\nthree\n" }, {}, "first"]);
  const first = git(dir, ["rev-parse", "HEAD"]);
  for (const c of onMain) commitAll(dir, c);
  git(dir, ["checkout", "-q", "-b", "change", first]);
  for (const c of commits) commitAll(dir, c);
  return { dir, first };
}
// The check's verdict, with the pull request checked out as GitHub merges it into the base's tip; the event names
// `eventBase`, the tip itself unless an older base is given.
function check({ dir, first }, { terms = TERMS, title = "A change", body = "Words.", stale = false } = {}) {
  const tip = git(dir, ["rev-parse", "main"]);
  git(dir, ["checkout", "-q", "--detach", "main"]);
  git(dir, ["merge", "-q", "--no-ff", "--no-edit", "change"], GITHUB);
  const github = { event_name: "pull_request", repository: "someone/project", ref: "refs/pull/1/merge", event: { pull_request: { title, body, base: { sha: stale ? first : tip } } } };
  const [job] = runWorkflow(workflow, { github, secrets: { PERSONAL_TERMS: terms }, base: { ...env, ...ME }, workspace: () => dir, uses: { "actions/checkout": () => {} }, temp: tmp });
  return { passed: job.passed, out: job.steps.map(s => s.out).join("") };
}
const fails = (what, repo, opts) => { const r = check(repo, opts); ok(!r.passed && ![term, other, wide].some(t => r.out.includes(t)), `${what} fails, and the term is never printed`, r.out); };
const passes = (what, repo, opts) => { const r = check(repo, opts); ok(r.passed, `${what} passes`, r.out); };

passes("a pull request with no term anywhere", pull([[{ "b.md": "plain words\n" }]]));
fails("a term in a file", pull([[{ "b.md": `a line with ${term.toUpperCase()} in it\n` }]]));
fails("a term added in one commit and taken out in the next", pull([[{ "b.md": `${term}\n` }], [{ "b.md": "gone\n" }]]));
fails("a term in an empty file's name, the file removed again", pull([[{ [`notes-${other}.md`]: "" }], [{ [`notes-${other}.md`]: null }]]));
fails("a term in a file's new name, renamed and nothing else", pull([[dir => { git(dir, ["mv", "a.md", `${term}.md`]); }]]));
fails("a term in a binary file's name, the file removed again", pull([[{ [`${other}.bin`]: "\u0000x\u0000" }], [{ [`${other}.bin`]: null }]]));
fails("a term outside plain ASCII in a file's name", pull([[{ [`a-${wide}.md`]: "x\n" }]]));
fails("a term in a commit's message", pull([[{ "b.md": "x\n" }, {}, `fix for ${term}`]]));
fails("a term in a commit's author name", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: `A ${term}` }]]));
fails("a term in a commit's author address", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: `${other}@example.invalid` }]]));
fails("a term in a commit's committer name", pull([[{ "b.md": "x\n" }, { GIT_COMMITTER_NAME: term }]]));
// a merge of main into the branch, as "update branch" makes it (GitHub's) or as a person does
const onMain = [[{ "c.md": "y\n" }, {}, "on main"]];
const update = committer => pull([[{ "b.md": "x\n" }], [dir => { git(dir, ["merge", "-q", "--no-ff", "--no-edit", "main"], { GIT_AUTHOR_NAME: `A ${term}`, ...committer }); }]], onMain);
passes("a merge GitHub itself made into the branch, its author the merging account's profile (floor rule 11's exception)", update(GITHUB));
fails("a merge anyone else made, with a term in its author", update({}));
fails("a commit that is no merge, with a term in its author, whoever committed it", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: term, ...GITHUB }]]));
// a merge resolved by hand: the lines its resolution adds are read
const resolved = pull([[{ "a.md": "one\nmine\nthree\n" }], [dir => {
  try { git(dir, ["merge", "-q", "--no-edit", "main"]); } catch { /* (the conflict, resolved below) */ }
  fs.writeFileSync(path.join(dir, "a.md"), `one\n${term}\nthree\n`);
  git(dir, ["add", "a.md"]);
  git(dir, ["commit", "-q", "--no-edit"]);
}], [{ "a.md": "one\nboth\nthree\n" }]], [[{ "a.md": "one\ntheirs\nthree\n" }, {}, "on main"]]);
fails("a term in a line a merge's own resolution adds, taken out again later", resolved);
fails("a term in the title", pull([[{ "b.md": "x\n" }]]), { title: `About ${other}` });
fails("a term in the description", pull([[{ "b.md": "x\n" }]]), { body: `Words.\n\n${term}` });
passes("a term only in a file git reads as binary (not read: the check's header says so)", pull([[{ "a.bin": `\u0000${term}\u0000` }]]));
passes("a term only in a commit from before the rule, added and taken out again", pull([[{ "b.md": `${term}\n` }, { GIT_AUTHOR_DATE: "2026-10-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-01T00:00:00Z" }], [{ "b.md": "gone\n" }]]));
passes("a term only in a commit of the base's, though the event names an older base", pull([[{ "b.md": "x\n" }]], [[{ "c.md": "y\n" }, { GIT_AUTHOR_NAME: term, ...GITHUB }, "squashed on main"]]), { stale: true });
const none = check(pull([[{ "b.md": `${term}\n` }]]), { terms: "" });
ok(none.passed && none.out.includes("PERSONAL_TERMS is not set"), "without the secret it passes with a note: the check stays optional", none.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the personal-terms check`);
process.exitCode = failed ? 1 : 0;
