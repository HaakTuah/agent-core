#!/usr/bin/env node
// The brief of a release's trial (#1413, point 1; AGENTS.md, "A trial's brief is written by a tested script"): what the
// orchestrator gives the builder that tries the commit under trial on real projects, step by step, as the trial's rules
// set it (AGENTS.md, "Each release is tried on a real project first", #1084; "A release's trial opens its update as a
// draft in the owner's own projects", #1334; "The trial's machine fetches what a project pins", #1361), each step's
// command one the script it names takes. It finds the owner's own projects as scripts/state-report.mjs --projects finds
// them; a project of another owner's it takes only by --other, from the orchestrator in private, never found, kept or
// written anywhere but in what it prints. It prints the brief and writes nothing; where gh gives no answer it prints no
// brief, since nothing read is not none found (#1112). gh and Node's own modules.
//
//   node scripts/trial-brief.mjs <the commit tried, a full SHA> [--other <owner>/<name>]... [--repo <owner>/<name>]...
//         --repo names the repositories to read in place of the account's, where gh lists none (as state-report.mjs)
import { aCommit, aRepository } from "./guards.mjs";
import { CORE } from "./core-address.mjs";
import { ownTakers } from "./state-report.mjs";
import { started } from "./started.mjs";

// The place outside every repository that holds the clones, the verdicts and the readings, and the clone of the core at
// the commit tried, as the brief names them.
const SCRATCH = "<scratch>", AT = `${SCRATCH}/core`;
const NOWHERE = "no-push://the-trial";
// The draft's branch, one name whatever the commit, so a trial moved to a newer commit moves the same draft (#1334);
// the steps' writes are committed on a branch of their own, never pushed, so the draft holds the pure sync alone.
const BRANCH = "core-trial", AFTER = "core-trial-after";
const short = sha => sha.slice(0, 7);
const folder = name => `${SCRATCH}/${name.replace("/", "--")}`;

// What the brief says of each project: the owner's own are tried and get a draft; another owner's is tried alone, its
// code run only through the release's check.mjs, on a machine shown to hold no sign-in of the owner's (floor rule 18).
function projectLines(own, other) {
  if (!own.length && !other.length) return ["- None: no project of the owner's takes the core, and none of another owner's was given. Step 8 records a trial of none."];
  return [
    ...own.map(n => `- \`${n}\`, the owner's own: tried read-only, its sync opened as a draft pull request (step 6). Its clone: \`${folder(n)}\`.`),
    ...other.map(n => `- \`${n}\`, of another owner, which allows it: tried read-only, nothing at all written to it, on a machine of its own after the owner's own projects, its code run only as step 1 says. Name it in no public text: no commit, pull request, issue, comment or record. Its clone: \`${folder(n)}\`.`),
  ];
}

// The brief for the commit `sha`, the owner's own projects `own` and another owner's `other`, as one text.
export function brief(sha, own, other = []) {
  const c = `\`${sha}\``, s = short(sha);
  const each = (lines) => lines.map(l => `   - ${l}`);
  return [
    `# The trial of the release at ${s}`,
    "",
    `You build the trial of the core's release at the commit ${c} (AGENTS.md of the core, "Each release is tried on a real project first"; "A release's trial opens its update as a draft in the owner's own projects"; "The trial's machine fetches what a project pins"). This brief was printed by \`node scripts/trial-brief.mjs\`; it names projects, so it is given in private and copied into no public text. Read the core's stop switch (\`git ls-remote https://github.com/${CORE} refs/heads/agents-stop\`) at your start; where it stands, stop.`,
    "",
    "The projects:",
    ...projectLines(own, other),
    "",
    "Do each step for each project in turn. `<n>` below is the project's clone, `<owner>/<name>` its name.",
    "",
    "0. **Set up.**",
    ...each([
      `A scratch folder outside every repository, \`${SCRATCH}\`, holds the clones, every verdict and every reading; none of them goes into a repository.`,
      `The core at the commit tried: \`git clone https://github.com/${CORE} ${AT} && git -C ${AT} checkout --detach ${sha}\`. \`${AT}\` below is that clone.`,
    ]),
    "1. **Read-only, and the blocks on the clone.**",
    ...each([
      `\`git clone https://github.com/<owner>/<name> <n>\`, keeping its remote \`origin\`: the sync's reading and the privacy reader read it, and a clone with no remote crashed both (release 7's trial).`,
      `Block its pushes: \`git -C <n> remote set-url --push origin ${NOWHERE}\`. Check the block by reading it: \`git -C <n> remote get-url --push origin\` prints \`${NOWHERE}\`. Never check it by trying a push and waiting for a refusal: on a project the account can write, the push goes through.`,
      "Nothing is written to the project's repository but the draft step 6 opens in a project of the owner's own: no other branch, no issue, comment, label or setting.",
      `Of a project of another owner, its own code runs only on a machine of its own, holding no clone, verdict or reading of another project's, so it is tried after the owner's own, in a scratch folder of its own, and only where that machine is shown to hold no sign-in or key of the owner's by any route (floor rule 18): none in its tools (\`gh auth status\` fails, and \`printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill\` gives no password), none in its files, and none its network adds to a request on the way out. Where that is not shown, as on a machine whose network may add one, run nothing of it, give it no pair in step 8, and say in the record's pull request that its checks were not run, and why. Where it is, run its checks only through \`${AT}/scripts/check.mjs\`, whose steps get an environment of their own, never through the scripts of its copy, which its owner can change.`,
    ]),
    "2. **The toolchain the project pins.** Before the first run, from `<n>`: `node " + AT + "/scripts/toolchain.mjs .`, and set what its line prints for both runs. Where it fetches nothing, its line says why: go on.",
    "3. **The run before the sync, the baseline.** From `<n>`, on its default branch: `node core/scripts/check.mjs --base \"$(git rev-parse origin/HEAD)\" --own --verdicts " + SCRATCH + "/<name>-before.json`.",
    ...each([
      `Where the copy holds no check.mjs, or one without \`--verdicts\`, and for every project of another owner, run \`node ${AT}/scripts/check.mjs\` with the same options from \`<n>\` instead, the verdicts still under \`${SCRATCH}\`. Note which way each baseline was taken, for step 8.`,
    ]),
    "4. **The sync.** In `<n>`: `git switch -c " + BRANCH + "`, then `node " + AT + "/scripts/sync.mjs " + sha + "`, then commit what it wrote (`git add -A && git commit -m \"Sync the core to " + s + " for the release's trial\"`). The steps' writes it sets aside stay in their stash until step 7.",
    "5. **The pure-sync reading.** With that branch checked out and committed: `node " + AT + "/scripts/pure-sync.mjs --trial " + sha + " > " + SCRATCH + "/<name>-sync.txt`. Its answer stops no cut; a trial recorded without it for a project does.",
    "6. **The draft, in each project of the owner's own.**",
    ...each([
      "Read the project's stop switch: `git -C <n> ls-remote origin refs/heads/agents-stop`. Where it stands, open no draft, and take the reading as for another owner's below.",
      `Else push the sync's branch alone, by its fetch address named outright, the push address staying blocked: \`git -C <n> push "$(git -C <n> remote get-url origin)" --force HEAD:refs/heads/${BRANCH}\`, the branch the trial's own. Where no draft of an earlier commit's trial is open from it, open it as a draft pull request against the default branch (\`gh api repos/<owner>/<name>/pulls -f head=${BRANCH} -f base=<its default branch> -F draft=true -f title=... -f body=...\`), its description saying it is the release's trial, pinned to ${s}, and that the session that syncs the project takes it once the release is cut. It holds the pure sync alone: never the steps' writes, never marked ready, never merged before the cut.`,
      `Once its checks finish: \`node ${AT}/scripts/trial-draft.mjs <owner>/<name> <its number> ${sha} > ${SCRATCH}/<name>-draft.txt\`, with \`--gate <the check>\` only for a check that fails, or skips after passing on main, for being a draft alone (setup/sync-notes/680), each named in the record's pull request.`,
      `A project of another owner's, or one whose stop switch stands, gets no draft: \`node ${AT}/scripts/trial-draft.mjs <owner>/<name> none ${sha} > ${SCRATCH}/<name>-draft.txt\`.`,
      `Where a fix of the release moves the trial to a newer commit, the same draft moves forward to it: the trial starts again from step 0 in a fresh scratch folder, and step 6's push to \`${BRANCH}\`, the same name whatever the commit, replaces the draft's sync with the new one; open no second draft, and say the new pin in its description.`,
    ]),
    "7. **The run after the sync.** In `<n>`, on a branch of its own off the sync's (`git switch -c " + AFTER + "`), so the draft's stays the pure sync: take the steps' writes the sync set aside (`git stash pop`, where it set them aside) and commit them there, never pushed, as the session that syncs commits them after the merge. Then: `node core/scripts/check.mjs --base \"$(git rev-parse origin/HEAD)\" --own --verdicts " + SCRATCH + "/<name>-after.json`.",
    ...each([
      `For every project of another owner, run \`node ${AT}/scripts/check.mjs\` with the same options instead, as in step 3, never the copy's.`,
      "A check that passed before and failed after, or failed after alone, is the release's, and so is one that ran before and was stopped, not run or not read after: find its fault in the core, mend it there in a pull request of its own, and try again at the new commit, as step 6 says.",
    ]),
    "8. **The record,** in a pull request of the core's own, branched from its main, that changes `reports/release-trial.json` alone:",
    ...each([
      `\`node scripts/release.mjs --trial ${sha} ${SCRATCH}/<name>-before.json ${SCRATCH}/<name>-after.json --sync ${SCRATCH}/<name>-sync.txt --draft ${SCRATCH}/<name>-draft.txt\`, the four files given for each project tried in turn.`,
      `Where no project allowed a trial: \`node scripts/release.mjs --trial ${sha}\` alone, which it refuses where a project of the owner's takes the core.`,
      "Its description gives counts and conclusions alone, naming no project: how each baseline was taken, each check set apart by `--gate` and why, which steps a writer did and which a session mended by hand, and why any project has no pair or no draft.",
    ]),
  ].join("\n");
}

// The brief at `sha` with another owner's projects `other`, the owner's own found through `gh` among those `named`, or
// all the account reaches, or { why } it is none.
export function briefFor(sha, other, gh, named = []) {
  if (!aCommit(sha)) return { why: "the commit tried is no full SHA. Mend: give the full 40-character SHA of the core's commit under trial, as `git rev-parse <it>` prints it" };
  if ([...other, ...named].some(n => !aRepository(n))) return { why: "an --other or --repo is no <owner>/<name> of a repository. Mend: give each repository as its owner and name, joined by a slash" };
  let own;
  try { own = gh ? ownTakers(named, gh) : ownTakers(named); } catch { return { why: "gh gave no answer, or none that could be read, for the owner's projects, and nothing read is not none found. Mend: run it again where gh answers for the owner's account" }; }
  const twice = other.find(n => own.some(o => o.toLowerCase() === n.toLowerCase()));
  if (twice !== undefined) return { why: "an --other names one of the owner's own projects, which the brief finds itself and tries with a draft. Mend: give --other only for a project of another owner" };
  return { text: brief(sha, own, other) };
}

// The brief for the command line `args` (the commit, then --other and --repo, each with its name), or { why } not.
export function run(args, gh) {
  const [sha, ...rest] = args;
  const flag = a => a === "--other" || a === "--repo";
  const loose = rest.some((a, i) => !flag(a) && !flag(rest[i - 1])) || rest.some((a, i) => flag(a) && (i === rest.length - 1 || flag(rest[i + 1])));
  const of = f => rest.filter((a, i) => rest[i - 1] === f);
  return loose ? { why: "it takes the commit tried, then --other <owner>/<name> for each project of another owner, and --repo <owner>/<name> for each repository to read in place of the account's. Mend: run `node scripts/trial-brief.mjs <the full SHA> [--other <owner>/<name>]... [--repo <owner>/<name>]...`" } : briefFor(sha, of("--other"), gh, of("--repo"));
}

if (started(import.meta.url)) {
  const got = run(process.argv.slice(2));
  if (got.why) { console.error(`FAIL: ${got.why}`); process.exitCode = 1; } else console.log(got.text);
}
