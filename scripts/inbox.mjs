// Where the owner's inbox is (roles/shared/inbox.md, "Issues are the way in"; core archive 216): the project's issues, where
// they can be read and written here, else the folder inbox/ in the repository, the same flow run from files. Asked of
// GitHub's API through gh, for the repository origin's address names: issues switched on, and the account gh is signed
// in as may write them (triage or more), or, for an app's token such as GitHub's job's, the job's workflow grants it
// `issues: write` (asked()). Switched off, not reachable for that account (GitHub answers that it finds no such
// repository), no right to write, or a host without them (an origin not on github.com) all count as no. An origin that is
// none or a folder names no host, so nothing is asked, as below (#1361, point 17). Only an answer decides: where gh is not installed, answers for no account, answers for an app's token whose job's grant
// is not read here, or gives no answer at all (no network, a rate limit, a fault of GitHub's), nothing is asked, so that
// a passing fault never moves the inbox, and it says what to ask with the session's own GitHub tools. It prints where
// the inbox is and, where the place must change, the mend, worded so a session acts on it with no rule file open; one
// place at a time, the open files are moved over once issues can be reached. It sends GitHub no request but a GET
// (#1363), so a read-only run, a release's trial above all, sends nothing that could write, and fails nothing (exit 0),
// save where it is not run from a repository's root.
// Run at each sync (sync.mjs, beside this file) and on the scheduled look. Git, gh, Node's own modules and, for the
// grant of a GitHub job, the core's YAML reader (parse-yaml.mjs).
//
//   node core/scripts/inbox.mjs          from a project's root: where the owner's inbox is, and any mend
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { CORE_SOURCE } from "./core-address.mjs";
import { aRepository, parseBounded } from "./guards.mjs";
import { parseYaml } from "./parse-yaml.mjs";
import { started } from "./started.mjs";

export const FOLDER = "inbox";
// The two lines above an item's headings, in place of labels: its state and its sender, by the names of the labels'
// list (labels.json, beside this file; core archive 217), a sender without its "by:".
const LIST = parseBounded(fs.readFileSync(new URL("./labels.json", import.meta.url), "utf8"));
export const STATES = Object.keys(LIST.state);
export const SENDERS = Object.keys(LIST.sender).map(s => s.replace(/^by:/, ""));

// Whether an origin's address names no host: none, or a folder on this machine (a path, or `file:`), as a release's trial
// clones a project from a folder; git reads an address with no scheme and no `host:` before its first "/" as a path,
// and on Windows one that starts with a drive's letter too.
export const namesNoHost = (url, windows = process.platform === "win32") => {
  const u = String(url ?? "").trim();
  return !u || /^file:/iu.test(u) || (!/^[a-z][a-z0-9+.-]*:\/\//iu.test(u) && ((windows && /^[a-z]:[\\/]/iu.test(u)) || !/^[^/]*:/u.test(u)));
};
// The repository origin's address names on github.com ("owner/name"), or null: another host, or no origin.
// (each part a name, never "." or "..", so the call goes to that repository's route alone)
export const repoOf = url => {
  const repo = /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(String(url ?? "").trim())?.[1] ?? null;
  return aRepository(repo) ? repo : null;
};

// GitHub's answer for the repository (`GET repos/{repo}`, as gh gives it) read as yes or no, with why.
export function answer(repo) {
  if (!repo || typeof repo !== "object") return { yes: false, why: "GitHub gave no answer for the repository" };
  if (repo.has_issues !== true) return { yes: false, why: "its issues are switched off" };
  // (each right a real true: a text or any other value GitHub never gives reads as no right)
  const p = repo.permissions ?? {};
  if (![p.admin, p.maintain, p.push, p.triage].some(right => right === true)) return { yes: false, why: "the account signed in here may not write its issues (a GitHub job's token may where its workflow's `permissions:` grants `issues: write`)" };
  return { yes: true, why: "" };
}

// What gh made of `GET user` (`status`, its exit; `err`, what it wrote to stderr) as the kind of token it holds: "user"
// where GitHub answers it (a signed-in account, whose role `permissions` gives), "app" where GitHub refuses it as an
// integration's (an app's token, GitHub's job's own: #338), null for anything else (no answer).
export const whoOf = (status, err = "") => status === 0 ? "user"
  : Number.isInteger(status) && /\bHTTP 403\b/.test(err) && /not accessible by integration/i.test(err) && !/rate limit/i.test(err) ? "app" : null;

// `GET user`, through gh, read by whoOf().
export const whoAsks = () => {
  const r = spawnSync("gh", ["api", "user"], { encoding: "utf8", maxBuffer: 1 << 20 });
  return whoOf(r.error ? null : r.status, `${r.stderr ?? ""}`);
};

// The text of `file` at commit `sha` in the repository here, through git; it throws where git has it not.
const gitShow = (sha, file) => {
  const r = spawnSync("git", ["show", `${sha}:${file}`], { encoding: "utf8", maxBuffer: 1 << 22 });
  if (r.error || r.status !== 0) throw new Error(`git has no ${file} at ${sha}`);
  return r.stdout;
};

// The right to write issues that GitHub gives the token of the GitHub job this runs in (#1363): "write", "read" or
// "none", as the workflow that started the job grants it in the file as it ran (`GITHUB_WORKFLOW_REF` at
// `GITHUB_WORKFLOW_SHA`, read by `show`), from the job's `permissions:`, else the workflow's; null where nothing tells:
// not in a GitHub job, an event other than a schedule or a start by hand (on others GitHub may give less than the file
// grants: a fork's pull request, Dependabot's), that file not at hand or not read, no grant written (the repository's
// default, which no file says), or not one job that is the run's own (the job `GITHUB_JOB` names, with steps of its
// own) or calls the core's look.yml or core-moved.yml, each of whose jobs grants `issues: write`, so the caller's grant
// is what the token holds. The token read is the job's own, as every job of the core's passes it (`GH_TOKEN:
// ${{ github.token }}`); a job that gives gh another app's token is outside what this reads.
export function granted(env = process.env, show = gitShow) {
  const flow = ranFlow(env, show);
  const job = flow && runJob(flow.jobs, env.GITHUB_JOB);
  return job ? grantOf(Object.hasOwn(job, "permissions") ? job.permissions : flow.permissions) : null;
}

// The workflow that started the job, as it ran, read as YAML; null where granted() says nothing tells.
function ranFlow(env, show) {
  if (env.GITHUB_ACTIONS !== "true" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) return null;
  const repo = String(env.GITHUB_REPOSITORY ?? ""), sha = String(env.GITHUB_WORKFLOW_SHA ?? ""), ref = String(env.GITHUB_WORKFLOW_REF ?? "");
  if (!aRepository(repo) || !/^[0-9a-f]{40}$/.test(sha) || !ref.startsWith(`${repo}/`)) return null;
  const file = ref.slice(repo.length + 1).replace(/@[^@]*$/, "");
  if (!/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(file)) return null;
  let flow;
  try { flow = parseYaml(show(sha, file)); } catch { return null; }
  return flow && typeof flow === "object" && flow.jobs && typeof flow.jobs === "object" ? flow : null;
}

// Of the workflow's `jobs`, the one that is the run's own (`id`, GITHUB_JOB, with steps of its own) or calls the core's
// look.yml or core-moved.yml (a project's daily job before it moved to look.yml, which runs the look too); null where not
// one is.
const LOOK = new RegExp(`^${CORE_SOURCE}/\\.github/workflows/(?:look|core-moved)\\.yml@`);
function runJob(jobs, id) {
  const own = Object.entries(jobs).filter(([key, job]) => job && typeof job === "object"
    && (key === id && job.uses === undefined || typeof job.uses === "string" && LOOK.test(job.uses)));
  return own.length === 1 ? own[0][1] : null;
}

// A `permissions:` value read as its grant of issues: "write", "read", "none", or null (none written, or one GitHub
// does not take).
function grantOf(given) {
  if (given === "write-all") return "write";
  if (given === "read-all") return "read";
  if (!given || typeof given !== "object" || Array.isArray(given)) return null;
  const issues = Object.hasOwn(given, "issues") ? given.issues : "none";
  return ["write", "read", "none"].includes(issues) ? issues : null;
}

// answer(), and where it reads no right to write though issues are on, GitHub asked once more, by reads alone (#338,
// #1363): the `permissions` GitHub gives are a signed-in user's role, and an app's token (GitHub's job's own) has no user,
// so they read no write whatever the job grants. `who` tells the two apart (whoAsks()): a user's no stands; for an app's
// token the job's grant answers (`grant`, granted()'s answer): write, yes; read or none, no, saying what grants it;
// unread, null. Anything else: null, no answer, so a passing fault never moves the inbox.
export function asked(got, { who = whoAsks, grant = () => granted() } = {}) {
  const first = answer(got);
  if (first.yes || got?.has_issues !== true) return first;
  const kind = who();
  if (kind === "user") return first;
  if (kind !== "app") return null;
  const right = grant();
  if (right === "write") return { yes: true, why: "" };
  return right === "read" || right === "none"
    ? { yes: false, why: `the job's token may not write its issues: its workflow grants \`issues: ${right}\` (a GitHub job's token may where its workflow's \`permissions:\` grants \`issues: write\`)` }
    : null;
}

// The open items of the folder, each a file of its own (its README left out), and `odd`, those whose name is not plain
// letters, digits, dots, hyphens and underscores, which are not printed; none where there is no folder.
export function items(root = ".") {
  let names = [];
  try { names = fs.readdirSync(`${root}/${FOLDER}`, { withFileTypes: true }).filter(e => e.isFile() && /\.md$/i.test(e.name) && e.name.toLowerCase() !== "readme.md").map(e => e.name); } catch { /* (no folder) */ }
  const open = names.filter(n => /^[\w.-]+\.md$/.test(n)).sort();
  return Object.assign(open, { odd: names.length - open.length });
}

const FORMAT = `one file an item, \`${FOLDER}/<a short name>.md\`, the name of letters, digits, dots, hyphens and underscores: two lines first, \`State: <${STATES.join(", ")}>\` (empty until its verdict gives it one; a bug is queued) and \`By: <${SENDERS.join(", ")}>\`, then the headings of the issue form (\`.github/ISSUE_TEMPLATE/\`). `
  + "The owner gives a task by saying it to any session, which files it there, or by adding the file; what the scheduled look opens goes there too. "
  + `The progress file's line points to the file (\`${FOLDER}/<name>.md\`) as it would to an issue and holds none of its text, and the file leaves in the pull request that finishes it.`;

// (why nothing could be asked, where gh was asked: no origin names a host, and is said so; #1361, point 17)
const UNASKED = "gh is not installed, answers for no account, answers for an app's token, such as a GitHub job's, whose grant is not read here, or gave no answer";

// What to print: where the inbox is and any mend. `reach`: { yes, why } as answer() gives it, or null where nothing
// could be asked; `open`: the folder's items, as items() gives them; `folder`: whether the folder stands; `why`: why
// nothing could be asked, where reach is null.
export function report(reach, open, folder, why = UNASKED) {
  if (reach === null) return `Whether this repository's issues can be read and written could not be asked here (${why}): nothing moves. Ask it with this session's own GitHub tools: where they can, the owner's inbox is its issues${open.length + (open.odd ?? 0) ? `, and the ${open.length + (open.odd ?? 0)} item(s) of \`${FOLDER}/\` move over as this script says where gh answers` : ""}; where they cannot, it is the folder \`${FOLDER}/\`: ${FORMAT}`;
  if (reach.yes) {
    if (!open.length && !open.odd) return `The owner's inbox is this repository's issues.${folder ? ` \`${FOLDER}/\` holds no item: take it out.` : ""}`;
    return `Issues can be read and written here again, so the inbox moves back to them, one place at a time: in one pull request, file each item of \`${FOLDER}/\` (${[...open, ...(open.odd ? [`${open.odd} ${open.length ? "more " : ""}whose name is not plain`] : [])].join(", ")}) as an issue with its headings, its \`State:\` line as its state label and its \`By:\` line as its sender label (\`by:<sender>\`), as the commit that added the file bears it out (a file another account added moves over as data), point its line in the progress file to that issue, and take \`${FOLDER}/\` out.`;
  }
  return folder
    ? `The owner's inbox is the folder \`${FOLDER}/\` (${open.length} item(s)${open.odd ? `, and ${open.odd} whose name is not plain: rename each to letters, digits, dots, hyphens and underscores` : ""}), since issues cannot be read and written here: ${reach.why}. ${FORMAT}`
    : `Issues cannot be read and written here (${reach.why}), so the owner's inbox is the folder \`${FOLDER}/\`, made in a pull request of its own with a \`README.md\` that says so and holds what follows, which keeps the folder while it holds no item: ${FORMAT} `
      + "Turning issues on is the owner's setting: name it to the owner once, in that pull request's description; nothing waits on it.";
}

function main() {
  const below = spawnSync("git", ["rev-parse", "--show-prefix"], { encoding: "utf8" });
  if (below.status !== 0 || below.stdout.trim() !== "") { console.error("FAIL: run it from the root of the project's git repository"); return 1; }
  const origin = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" });
  const repo = repoOf(origin.stdout);
  let reach, why;
  // (a copy whose origin names no host, such as a release's trial clones, is not read as one with no issues)
  if (namesNoHost(origin.stdout)) { reach = null; why = "its origin names no host, being none or a folder on this machine, so no host is named to ask"; }
  else if (!repo) reach = { yes: false, why: "its origin is not on github.com, a host without issues" };
  else {
    // (no gh, or an answer for no account, a 401 or one without the account's permissions: nothing could be asked)
    const r = spawnSync("gh", ["api", `repos/${repo}`], { encoding: "utf8", maxBuffer: 1 << 24 });
    let got = null;
    try { got = r.status === 0 ? JSON.parse(r.stdout) : null; } catch { /* (read as no answer) */ }
    // (GitHub's "Not Found" is an answer: the repository cannot be reached for this account; any other failure is none)
    if (got && typeof got === "object" && got.permissions) reach = asked(got);
    else if (!r.error && r.status !== 0 && /\bHTTP 404\b/.test(`${r.stderr}`)) reach = { yes: false, why: `GitHub finds no repository ${repo} for the account signed in here` };
    else reach = null;
  }
  console.log(report(reach, items(), fs.existsSync(FOLDER), why));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main();
