#!/usr/bin/env node
// Which updates from main of a pull request bring in main alone, the pull request's own change unchanged (#323; #750,
// point 3)? The review statuses (scripts/security-review.mjs and scripts/code-review-wait.mjs) let a review of an
// earlier commit stand for the head where only updates from main follow it, merges whose second parent is no commit of
// the pull request's; read by their parents alone, such a merge could carry a change of its own that no review saw.
// This proves, of each merge that walk passes (standsFrom), that its tree is git's own merge of its two parents
// (`git merge-tree --write-tree`, git 2.38 and later, the strategy GitHub's "Update branch" uses too), with each file in
// conflict, where there are any, settled by keeping both sides' lines whole, one side's after the other's in either
// order (`git merge-file --union`, git 2.43 and later): so two pull requests that add to the same place in a file bring
// in no new content when the second is brought up to date. A merge it cannot prove so (a conflict settled any other
// way, which changes the pull request's own lines or main's, a file added, deleted or moved on one side in conflict, a
// change of its own, parents other than GitHub says, an object missing, a git too old) is left out, and the statuses
// stop there: a review of that merge or of a later commit is then what stands. Run by the core's workflow
// security-review.yml from the default branch's copy, inside a clone of its own that holds the head's commits and
// checks nothing out, so that nothing of the pull request's runs; it reads git's objects and writes only the trees and
// files git's merge makes into that clone. It prints, as JSON, the SHAs of the merges proved ([] where none is). Git and
// Node's own modules only.
//
// Usage (in that clone):  node scripts/clean-merges.mjs <the pull request, as GitHub's API gives it> <its commits, the same>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { standsFrom } from "./security-review.mjs";
import { started } from "./started.mjs";

const SHA = /^[0-9a-f]{40}$/u;
const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 }).trim();

// whether the commit's tree is git's merge of its two parents, as the pull request's list gives them, each file in
// conflict settled by keeping both sides' lines whole
export function isGits(at, parents, cwd) {
  if (![at, ...parents].every((sha) => typeof sha === "string" && SHA.test(sha)) || parents.length !== 2) return false;
  try {
    // (its parents as git holds them, so that a list that names others proves nothing)
    if (git(["show", "-s", "--format=%P", at], cwd) !== parents.join(" ")) return false;
    // (a conflict exits 1, and lists each file in conflict by its stages; anything else proves nothing)
    const run = spawnSync("git", ["merge-tree", "--write-tree", "--no-messages", "-z", parents[0], parents[1]], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
    if (run.error || (run.status !== 0 && run.status !== 1)) return false;
    const [made, ...listed] = run.stdout.split("\0").filter((field) => field !== "");
    const tree = git(["rev-parse", `${at}^{tree}`], cwd);
    if (!SHA.test(made ?? "")) return false;
    if (run.status === 0) return listed.length === 0 && made === tree;
    return bothKept(made, tree, listed, cwd);
  } catch {
    return false;
  }
}

// whether a tree differs from git's merge (made, its files in conflict written with markers) only in those files, each
// of them, as git's merge left it in conflict (listed: its three stages, as merge-tree's `-z` gives them), both sides'
// lines whole in either order and the mode both sides give it
const STAGE = /^(100644|100755) ([0-9a-f]{40}) ([123])\t(.+)$/su;
function bothKept(made, tree, listed, cwd) {
  const stages = new Map();
  for (const entry of listed) {
    const m = STAGE.exec(entry);
    if (!m) return false;
    const [, mode, blob, stage, file] = m;
    if (!stages.has(file)) stages.set(file, {});
    stages.get(file)[stage] = { mode, blob };
  }
  // (every file that differs from git's merge is one in conflict, and only in its content)
  const raw = git(["diff-tree", "-r", "-z", "--no-renames", made, tree], cwd).split("\0").filter((field) => field !== "");
  for (let i = 0; i < raw.length; i += 2) if (!stages.has(raw[i + 1]) || !/^:(\d{6}) \1 /u.test(raw[i])) return false;
  for (const [file, { 1: base, 2: ours, 3: theirs }] of stages) {
    if (!base || !ours || !theirs || ours.mode !== theirs.mode) return false;
    const kept = git(["ls-tree", "-z", tree, "--", file], cwd).split("\0")[0];
    const both = [[ours, theirs], [theirs, ours]].map(([first, second]) => git(["merge-file", "--object-id", "--union", first.blob, base.blob, second.blob], cwd));
    if (!both.some((blob) => SHA.test(blob) && kept === `${ours.mode} blob ${blob}\t${file}`)) return false;
  }
  return true;
}

// the merges proved, of those the walk from the head passes: each in turn, from the head, until one is not, since the
// walk stops there
export function proved(pull, commits, cwd) {
  const head = pull?.head?.sha;
  if (typeof head !== "string" || !SHA.test(head)) return [];
  const list = flat(commits);
  const by = new Map(list.filter((commit) => typeof commit.sha === "string").map((commit) => [commit.sha, commit]));
  const out = [];
  for (const at of standsFrom(pull, list, head)) {
    const parents = by.get(at)?.parents;
    if (!Array.isArray(parents) || parents.length !== 2 || by.has(parents[1]?.sha)) break;
    if (!isGits(at, parents.map((parent) => parent?.sha), cwd)) break;
    out.push(at);
  }
  return out;
}

if (started(import.meta.url)) {
  const [pullFile, commitsFile] = process.argv.slice(2);
  if (!pullFile || !commitsFile) {
    console.error("usage: node scripts/clean-merges.mjs <the pull request, as JSON> <its commits, as JSON>");
    process.exit(2);
  }
  const read = (file) => JSON.parse(readFileSync(file, "utf8"));
  console.log(JSON.stringify(proved(read(pullFile), read(commitsFile), process.cwd())));
}
