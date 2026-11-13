// Checks the personal-terms check (floor rule 11; .github/workflows/personal-terms.yml): its own job, run as GitHub
// runs it (workflow-run.mjs, beside this file), on scratch repositories, each a pull request of a few commits. What
// fails: a term in a file, in a line a commit adds and a later one takes away, in a file's name, in a commit's message,
// author or committer (name or address), and in the title or description; what passes: none of these, a term only in
// a file git reads as binary (not read), only in a commit from before the rule, only in the author of a merge GitHub
// itself made (floor rule 11's exception), and a repository without the secret.
// The terms are invented, built from pieces as the test runs, so no file holds them. On Linux and on Windows. Git,
// bash and Node's own modules.
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
const [term, other] = [["qz", "vk", "wy"], ["xj", "qq", "zf"]].map(t => t.join(""));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: "2026-11-13T12:00:00Z", GIT_COMMITTER_DATE: "2026-11-13T12:00:00Z" });
const git = (dir, args, extra = {}) => execFileSync("git", args, { cwd: dir, env: { ...env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", ...extra }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

let n = 0;
// A repository with a first commit on main and the pull request's commits after it; each commit [files, extra env, message].
function pull(commits) {
  const dir = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  fs.writeFileSync(path.join(dir, "README.md"), "# A project\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "first"]);
  const base = git(dir, ["rev-parse", "HEAD"]);
  for (const [files, extra = {}, message = "a change"] of commits) {
    for (const [name, text] of Object.entries(files)) {
      if (text === null) fs.rmSync(path.join(dir, name));
      else { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); }
    }
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "-q", "--allow-empty", "-m", message], extra);
  }
  return { dir, base };
}
function check({ dir, base }, { terms = `${term}\n${other}\n`, title = "A change", body = "Words." } = {}) {
  const github = { event_name: "pull_request", repository: "someone/project", ref: "refs/pull/1/merge", event: { pull_request: { title, body, base: { sha: base } } } };
  const [job] = runWorkflow(workflow, { github, secrets: { PERSONAL_TERMS: terms }, base: env, workspace: () => dir, uses: { "actions/checkout": () => {} } });
  return { passed: job.passed, out: job.steps.map(s => s.out).join("") };
}
const fails = (what, repo, opts) => { const r = check(repo, opts); ok(!r.passed && !r.out.includes(term) && !r.out.includes(other), `${what} fails, and the term is never printed`, r.out); };
const passes = (what, repo, opts) => { const r = check(repo, opts); ok(r.passed, `${what} passes`, r.out); };

passes("a pull request with no term anywhere", pull([[{ "a.md": "plain words\n" }]]));
fails("a term in a file", pull([[{ "a.md": `a line with ${term.toUpperCase()} in it\n` }]]));
fails("a term added in one commit and taken out in the next", pull([[{ "a.md": `${term}\n` }], [{ "a.md": "gone\n" }]]));
fails("a term in a file's name, the file removed again", pull([[{ [`notes-${other}.md`]: "x\n" }], [{ [`notes-${other}.md`]: null }]]));
fails("a term in a commit's message", pull([[{ "a.md": "x\n" }, {}, `fix for ${term}`]]));
fails("a term in a commit's author name", pull([[{ "a.md": "x\n" }, { GIT_AUTHOR_NAME: `A ${term}` }]]));
fails("a term in a commit's author address", pull([[{ "a.md": "x\n" }, { GIT_AUTHOR_EMAIL: `${other}@example.invalid` }]]));
fails("a term in a commit's committer name", pull([[{ "a.md": "x\n" }, { GIT_COMMITTER_NAME: term }]]));
// a merge into the branch: GitHub's own (as "update branch" makes it, its author the merging account's profile), or another's
function merged(committer) {
  const repo = pull([[{ "a.md": "x\n" }]]);
  git(repo.dir, ["checkout", "-q", "-b", "side", repo.base]);
  fs.writeFileSync(path.join(repo.dir, "b.md"), "y\n");
  git(repo.dir, ["add", "-A"]);
  git(repo.dir, ["commit", "-q", "-m", "on main"]);
  git(repo.dir, ["checkout", "-q", "main"]);
  git(repo.dir, ["merge", "-q", "--no-ff", "-m", "Merge branch 'main' into change", "side"], { GIT_AUTHOR_NAME: `A ${term}`, ...committer });
  return repo;
}
passes("a merge GitHub itself made, its author the merging account's profile (floor rule 11's exception)", merged({ GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" }));
fails("a merge anyone else made, with a term in its author", merged({}));
fails("a commit that is no merge, with a term in its author, whoever committed it", pull([[{ "a.md": "x\n" }, { GIT_AUTHOR_NAME: term, GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" }]]));
fails("a term in the title", pull([[{ "a.md": "x\n" }]]), { title: `About ${other}` });
fails("a term in the description", pull([[{ "a.md": "x\n" }]]), { body: `Words.\n\n${term}` });
passes("a term only in a file git reads as binary (not read: the check's header says so)", pull([[{ "a.bin": `\u0000${term}\u0000` }]]));
passes("a term only in a commit from before the rule, added and taken out again", pull([[{ "a.md": `${term}\n` }, { GIT_AUTHOR_DATE: "2026-10-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-01T00:00:00Z" }], [{ "a.md": "gone\n" }]]));
const none = check(pull([[{ "a.md": `${term}\n` }]]), { terms: "" });
ok(none.passed && none.out.includes("PERSONAL_TERMS is not set"), "without the secret it passes with a note: the check stays optional", none.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the personal-terms check`);
process.exitCode = failed ? 1 : 0;
