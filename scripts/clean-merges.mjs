#!/usr/bin/env node
// Which updates from main of a pull request bring in main alone, the pull request's own change unchanged (#323; #750,
// point 3)? The review statuses (scripts/security-review.mjs and scripts/code-review-wait.mjs) let a review of an
// earlier commit stand for the head where only updates from main follow it, merges whose second parent is no commit of
// the pull request's; read by their parents alone, such a merge could carry a change of its own that no review saw.
// This proves, of each merge that walk passes (standsFrom), that its tree is git's own merge of its two parents (`git
// merge-tree --write-tree`, git 2.38 and later, the strategy GitHub's "Update branch" uses too), with each file in
// conflict, where there are any, settled by keeping both sides' lines whole, one side's after the other's in either
// order, the same for the whole file (built from `git merge-file --diff3`, git 2.43 and later), where in each conflict
// both sides only added lines, none taken from the base: so two pull requests that add to the same place in a file
// bring in no new content when the second is brought up to date. A merge it cannot prove so (a conflict where either
// side changed or deleted a line, which keeping both would settle for one side, any conflict settled another way, which
// changes the pull request's own lines or main's, a file added, deleted or moved on one side in conflict, a change of
// its own, parents other than GitHub says, an object missing, a git too old) is left out, and the statuses stop there:
// a review of that merge or of a later commit is then what stands. Run by the core's workflow security-review.yml from
// the default branch's copy, inside a clone of its own that holds the head's commits and checks nothing out, so that
// nothing of the pull request's runs; it reads git's objects and writes only the trees and files git's merge makes into
// that clone. It prints, as JSON, the SHAs of the merges proved ([] where none is). Git and Node's own modules only.
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
// conflict, where both sides only added lines, settled by keeping both sides' lines whole
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
// lines whole in either order and the mode both sides give it, where each conflict in it only adds lines on both sides
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
    const kept = git(["--literal-pathspecs", "ls-tree", "-z", tree, "--", file], cwd).split("\0")[0];
    const both = keptBoth(base.blob, ours.blob, theirs.blob, cwd);
    if (both === null || !both.some((blob) => SHA.test(blob) && kept === `${ours.mode} blob ${blob}\t${file}`)) return false;
  }
  return true;
}

// the blobs of the file with both sides kept, ours' part before theirs in every conflict and theirs' before ours', or
// null where a conflict's base part is not empty: there a side changed or deleted a line, and keeping both would undo
// one side's change (#750, point 3). Built from git's diff3 form, which leaves each conflict as git's merge finds it
// (merge-file's --union joins conflicts a few lines apart, and so would move a side's line past lines both share), with
// markers longer than any line of the blobs holds, so that a marker is never a line of the file's own.
const MARK = 41;
function keptBoth(base, ours, theirs, cwd) {
  for (const blob of [base, ours, theirs]) if (git(["cat-file", "blob", blob], cwd).split("\n").some((line) => /^([<|=>])\1{40}/u.test(line))) return null;
  const run = spawnSync("git", ["merge-file", "-p", "--object-id", "--diff3", `--marker-size=${MARK}`, ours, base, theirs], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  if (run.error || !(run.status > 0) || typeof run.stdout !== "string") return null;
  const first = [], second = [];
  let part = "out", mine = [], yours = [];
  for (const line of run.stdout.split("\n")) {
    if (part === "out" && line.startsWith("<".repeat(MARK))) part = "ours";
    else if (part === "ours" && line.startsWith("|".repeat(MARK))) part = "base";
    else if (part === "base" && line === "=".repeat(MARK)) part = "theirs";
    else if (part === "theirs" && line.startsWith(">".repeat(MARK))) {
      first.push(...mine, ...yours); second.push(...yours, ...mine);
      part = "out"; mine = []; yours = [];
    } else if (part === "out") { first.push(line); second.push(line); }
    else if (part === "ours") mine.push(line);
    else if (part === "theirs") yours.push(line);
    else return null; // (a line of the base's: a side changed or deleted it)
  }
  if (part !== "out") return null;
  return [first, second].map((lines) => {
    const hashed = spawnSync("git", ["hash-object", "--stdin"], { cwd, input: lines.join("\n"), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return hashed.status === 0 ? hashed.stdout.trim() : null;
  });
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
