// Where the owner's inbox is (modules/inbox.md, "Issues are the way in"; core archive 216): the project's issues, where
// they can be read and written here, else the folder inbox/ in the repository, the same flow run from files. Asked of
// GitHub's API through gh, for the repository origin's address names: issues switched on, and the account gh is signed
// in as may write them (triage or more). Switched off, not reachable, no right to write, or a host without them (an
// origin not on github.com, or none) all count as no. Where gh is not installed or answers for no account, nothing is asked: it
// says what to ask with the session's own GitHub tools. It prints where the inbox is and, where the place must change,
// the mend, worded so a session acts on it with no rule file open; one place at a time, the open files are moved over
// once issues can be reached. It reads only and fails nothing (exit 0), save where it is not run from a repository's root.
// Run at each sync (sync.mjs, beside this file) and on the scheduled look. Git, gh and Node's own modules.
//
//   node core/scripts/inbox.mjs          from a project's root: where the owner's inbox is, and any mend
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { started } from "./started.mjs";

export const FOLDER = "inbox";
// The two lines above an item's headings, in place of labels (#244): its state and its sender.
export const STATES = ["new", "needs-owner", "queued", "later", "on-hold"];
export const SENDERS = ["owner", "design", "chat", "builder", "orchestrator", "project"];

// The repository origin's address names on github.com ("owner/name"), or null: another host, or no origin.
export const repoOf = url => /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(String(url ?? "").trim())?.[1] ?? null;

// GitHub's answer for the repository (`GET repos/{repo}`, as gh gives it) read as yes or no, with why.
export function answer(repo) {
  if (!repo || typeof repo !== "object") return { yes: false, why: "GitHub gave no answer for the repository" };
  if (repo.has_issues !== true) return { yes: false, why: "its issues are switched off" };
  const p = repo.permissions ?? {};
  if (!(p.admin || p.maintain || p.push || p.triage)) return { yes: false, why: "the account signed in here may not write its issues" };
  return { yes: true, why: "" };
}

// The open items of the folder, each a file of its own (its README left out); [] where there is no folder.
export function items(root = ".") {
  let names = [];
  try { names = fs.readdirSync(`${root}/${FOLDER}`, { withFileTypes: true }).filter(e => e.isFile() && /\.md$/i.test(e.name) && e.name.toLowerCase() !== "readme.md").map(e => e.name); } catch { /* (no folder) */ }
  return names.sort();
}

const FORMAT = `one file an item, \`${FOLDER}/<a short name>.md\`: two lines first, \`State: <${STATES.join(", ")}>\` and \`By: <${SENDERS.join(", ")}>\`, then the headings of the issue form (\`.github/ISSUE_TEMPLATE/\`). `
  + "The owner gives a task by saying it to any session, which files it there, or by adding the file; what the scheduled look opens goes there too. "
  + `The progress file's line points to the file (\`${FOLDER}/<name>.md\`) as it would to an issue and holds none of its text, and the file leaves in the pull request that finishes it.`;

// What to print: where the inbox is and any mend. `reach`: { yes, why } as answer() gives it, or null where nothing
// could be asked; `open`: the folder's items; `folder`: whether the folder stands.
export function report(reach, open, folder) {
  if (reach === null) return `Whether this repository's issues can be read and written could not be asked here (gh is not installed, or answers for no account). Ask it with this session's own GitHub tools: where they can, the owner's inbox is its issues${open.length ? `, and the ${open.length} item(s) of \`${FOLDER}/\` move over as this script says where gh answers` : ""}; where they cannot, it is the folder \`${FOLDER}/\`: ${FORMAT}`;
  if (reach.yes) {
    if (!open.length) return `The owner's inbox is this repository's issues.${folder ? ` \`${FOLDER}/\` holds no item: take it out.` : ""}`;
    return `Issues can be read and written here again, so the inbox moves back to them, one place at a time: in one pull request, file each item of \`${FOLDER}/\` (${open.join(", ")}) as an issue with its headings, its \`State:\` and \`By:\` lines as its labels, point its line in the progress file to that issue, and take \`${FOLDER}/\` out.`;
  }
  return folder
    ? `The owner's inbox is the folder \`${FOLDER}/\` (${open.length} item(s)), since issues cannot be read and written here: ${reach.why}. ${FORMAT}`
    : `Issues cannot be read and written here (${reach.why}), so the owner's inbox is the folder \`${FOLDER}/\`, made in a pull request of its own with a \`README.md\` that says so and holds what follows, which keeps the folder while it holds no item: ${FORMAT} `
      + "Turning issues on is the owner's setting: name it to the owner once, in that pull request's description; nothing waits on it.";
}

function main() {
  const below = spawnSync("git", ["rev-parse", "--show-prefix"], { encoding: "utf8" });
  if (below.status !== 0 || below.stdout.trim() !== "") { console.error("FAIL: run it from the root of the project's git repository"); return 1; }
  const origin = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" });
  const repo = repoOf(origin.stdout);
  let reach;
  if (!repo) reach = { yes: false, why: origin.stdout.trim() ? "its origin is not on github.com, a host without issues" : "it has no origin, so no host with issues" };
  else {
    // (no gh, or an answer for no account, a 401 or one without the account's permissions: nothing could be asked)
    const r = spawnSync("gh", ["api", `repos/${repo}`], { encoding: "utf8", maxBuffer: 1 << 24 });
    let got = null;
    try { got = r.status === 0 ? JSON.parse(r.stdout) : null; } catch { /* (read as no answer) */ }
    if (r.error || /\b401\b|gh auth login|authenticat/i.test(`${r.stderr}`) || (got && typeof got === "object" && !got.permissions)) reach = null;
    else reach = got ? answer(got) : { yes: false, why: `GitHub could not be reached for ${repo}, or did not answer` };
  }
  console.log(report(reach, items(), fs.existsSync(FOLDER)));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main();
