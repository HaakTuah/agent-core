// Whether a commit is the head of a pull request opened from a branch of the repository itself, as the host says it: a
// sync is always opened so, and floor rule 8's proof (pure-sync.mjs) and the report that runs it (attached.mjs) prove
// nothing for a head not shown so, asked before anything of the head's is read. The repository is the one the clone's
// origin names on github.com, as the clone's own config holds it; gh, asked of github.com whatever host its config
// names, lists the repository's open pull requests, and the commit is shown so only where one at least has it as its
// head and each that has it comes from the repository itself: its head repository's id the same as its base's, the
// host's own number, which no rename nor spelling of a name changes, where a deleted fork's head repository is null and
// never is. Where gh gives no answer, or one with a field missing, nothing is shown. Node's own modules, git and gh,
// looked for on the PATH alone.
import { execFileSync } from "node:child_process";
import { parseBounded } from "./guards.mjs";
import { repoOf } from "./inbox.mjs";
import { lookOnlyOnPath } from "./workflow-run.mjs";

// (git and gh, run here and by pure-sync.mjs and attached.mjs in a clone whose head may be another's, are looked for
// on the PATH alone, never in the folder they start in, before anything is run)
lookOnlyOnPath();

const gh = args => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000, maxBuffer: 1 << 26 });
const MEND = "Mend: a sync is opened from a branch of the repository: open its pull request so, and run this on its head";
const id = repo => (Number.isSafeInteger(repo?.id) && repo.id > 0 ? repo.id : null);

// { own: true, repo }, the repository it was read of, or { own: false, foreign, why } with the mend, for the commit `sha` of the clone at `cwd`; `ask` is
// gh, which a test replaces.
export function headFrom(sha, cwd, ask = gh) {
  let origin = "";
  try { origin = execFileSync("git", ["config", "--get", "remote.origin.url"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* (no origin) */ }
  const repo = repoOf(origin), unread = (why, mend = MEND) => ({ own: false, foreign: false, why: `whether this head comes from a branch of the repository could not be read: ${why}, so nothing was run. ${mend}` });
  if (!repo) return unread("the clone's origin names no repository on github.com", `${MEND}, in a clone whose origin is the repository's address there`);
  const { pulls, why, mend } = openPulls(repo, ask);
  if (!pulls) return unread(why, mend);
  const its = pulls.filter(p => p.head.sha === sha);
  if (!its.length) return unread(`no open pull request of ${repo} has this head`);
  if (!its.every(whole)) return unread(`GitHub's answer for a pull request of ${repo} with this head lacks its head's or its base's repository`);
  const other = its.find(p => id(p.head.repo) !== id(p.base.repo));
  if (!other) return { own: true, repo };
  const n = Number.isSafeInteger(other.number) ? `, pull request #${other.number}` : "";
  return { own: false, foreign: true, why: `this head comes from a repository other than ${repo}${other.head.repo === null ? ", a fork since deleted" : ""}${n}, so nothing was run. ${MEND}` };
}

// (a pull request whose head's and base's repositories GitHub gave, the head's null where its fork was deleted)
const whole = p => "repo" in p.head && (p.head.repo === null || id(p.head.repo) !== null) && id(p.base?.repo) !== null;

// { pulls }, the repository's open pull requests as gh gives them, each with its head's commit, or { why, mend } none is.
function openPulls(repo, ask) {
  let pages;
  try { pages = parseBounded(ask(["api", "--hostname=github.com", "--paginate", "--slurp", `repos/${repo}/pulls?state=open&per_page=100`])); }
  catch (e) { return { why: `gh gave no answer for ${repo}'s open pull requests (${String(e.stderr || e.message).trim().split("\n")[0].slice(0, 120)})`, mend: "Mend: run it again where gh is signed in for an account that can read them" }; }
  const pulls = Array.isArray(pages) && pages.every(Array.isArray) ? pages.flat() : null;
  return pulls?.every(p => typeof p?.head?.sha === "string") ? { pulls } : { why: `GitHub's list of ${repo}'s open pull requests lacks a field it always gives` };
}
