// Tests of git-objects.mjs (#732), the long-lived `git cat-file --batch` the agent-tools check reads a commit's objects
// through: each answer is what the single call, `git show rev:file`, gave, and where the batch cannot answer so, the
// single call is made. Each case a made-up repository in a temporary folder. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/git-objects-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exactPath, objectAt, textAt } from "../scripts/git-objects.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const base = fs.mkdtempSync(path.join(os.tmpdir(), "git-objects-"));
// (git's own settings of this machine left out, as the core's other tests leave them)
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(base, "none"), GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "false" };
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
const show = (dir, spec) => { try { return execFileSync("git", ["show", spec], { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

const dir = path.join(base, "repo");
fs.mkdirSync(path.join(dir, "d"), { recursive: true });
git(dir, "init", "-q", "-b", "main");
const big = `${"a line of text that is long enough to fill many pipe reads\n".repeat(20000)}`;
fs.writeFileSync(path.join(dir, "a"), "first\n");
fs.writeFileSync(path.join(dir, "d", "f"), "in a folder\n");
fs.writeFileSync(path.join(dir, "big"), big);
fs.writeFileSync(path.join(dir, "bom"), "﻿with a mark\n");
git(dir, "add", "-A");
git(dir, "commit", "-q", "-m", "one");
fs.writeFileSync(path.join(dir, "a"), "second\n");
git(dir, "commit", "-q", "-am", "two");

// A file's text is what git show gives, at a commit, a name for it and the one before, and where there is none, null.
ok(textAt(dir, "HEAD", "a") === "second\n" && textAt(dir, "HEAD^1", "a") === "first\n" && textAt(dir, "HEAD", "d/f") === "in a folder\n", "a file's text is read at each commit");
ok(textAt(dir, "HEAD", "nothing") === null && textAt(dir, "HEAD", "d/nothing") === null && textAt(dir, "nobody", "a") === null, "a path or a commit that holds nothing is null, never an empty text");
ok(textAt(dir, "HEAD", "bom") === "﻿with a mark\n", "a file's mark of its order is kept, as git show keeps it");
// (a text too long for one read of the pipe, asked again and again, each answer its own: the end of one is not the start of the next)
ok([1, 2, 3, 4].every(() => textAt(dir, "HEAD", "big") === big && textAt(dir, "HEAD", "a") === "second\n"), "long texts, one after another, are each read whole");
ok(textAt(dir, "HEAD", "d") === show(dir, "HEAD:d") && textAt(dir, "HEAD", "d").startsWith("tree "), "a folder is what git show prints of it, no file's text");

// A path git reads from the folder it runs in: the root's own, which `./` names; one that leaves it is outside the repository, which git refuses.
ok(textAt(dir, "HEAD", "./a") === "second\n" && textAt(dir, "HEAD", "./d/f") === "in a folder\n", "a path that opens with ./ is read from the root");
ok(textAt(dir, "HEAD", "../a") === null && textAt(dir, "HEAD", "../../a") === null && textAt(dir, "HEAD", "..") === null, "a path that leaves the repository is null");
ok(textAt(dir, "HEAD", "a") === "second\n", "and the next answer after one git refused is still the right one");
// A name that holds a line's end cannot be asked a line at a time: it is asked alone, and what it names is nothing, not the file before its line's end.
ok(textAt(dir, "HEAD", "a\nnothing") === null && textAt(dir, "HEAD", "a\rnothing") === null && textAt(dir, "HEAD\nHEAD", "a") === null, "a name with a line's end in it is null, never read as two");

// What git holds at a path, by its kind: a file's, a folder's, nothing where there is none.
const blob = objectAt(dir, "HEAD", "a"), tree = objectAt(dir, "HEAD", "d");
ok(blob?.type === "blob" && blob.oid === git(dir, "rev-parse", "HEAD:a") && blob.size === 7, "a file's object, its kind and its size");
ok(tree?.type === "tree" && tree.oid === git(dir, "rev-parse", "HEAD:d"), "a folder's object is a tree");
ok(objectAt(dir, "HEAD", "nothing") === null, "a path that holds nothing is null");
ok(objectAt(dir, "HEAD", "./a") === undefined && objectAt(dir, "HEAD", "../a") === undefined && objectAt(dir, "HEAD", "a\nb") === undefined, "a path the batch cannot ask is undefined, left to the single call");

// Replace objects: git show reads them, the check's own calls do not, and the batch keeps each as its call did (in a
// repository whose process starts after the replacement is made: git reads its replace objects once, as it starts).
const swapped = fs.mkdtempSync(path.join(base, "swapped-"));
git(swapped, "init", "-q", "-b", "main");
fs.writeFileSync(path.join(swapped, "a"), "first\n");
git(swapped, "add", "-A");
git(swapped, "commit", "-q", "-m", "one");
fs.writeFileSync(path.join(swapped, "a"), "second\n");
git(swapped, "commit", "-q", "-am", "two");
const first = git(swapped, "rev-parse", "HEAD^1:a"), second = git(swapped, "rev-parse", "HEAD:a");
git(swapped, "replace", second, first);
ok(textAt(swapped, "HEAD", "a") === show(swapped, "HEAD:a") && textAt(swapped, "HEAD", "a") === "first\n", "a replaced file is read as git show reads it, replaced");
ok(objectAt(swapped, "HEAD", "a")?.oid === second && objectAt(swapped, "HEAD", "a").size === 7, "and asked for its object, replace objects are left unread: the real object and its size, not the replacement's (6)");

// Where the repository is not the root's own `.git`, or git's variables name another, the single call is made.
const nested = path.join(dir, "d");
ok(textAt(nested, "HEAD", "d/f") === "in a folder\n" && textAt(nested, "HEAD", "../a") === show(nested, "HEAD:../a"), "a folder inside the repository is read by the single call, as before");
const named = fs.mkdtempSync(path.join(base, "named-"));
git(named, "init", "-q", "-b", "main");
fs.writeFileSync(path.join(named, "a"), "another repository\n");
git(named, "add", "-A");
git(named, "commit", "-q", "-m", "other");
for (const variable of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"]) {
  const was = process.env[variable];
  process.env[variable] = variable === "GIT_DIR" ? path.join(named, ".git") : variable === "GIT_WORK_TREE" ? named : path.join(named, ".git", variable === "GIT_COMMON_DIR" ? "" : "objects");
  const took = textAt(dir, "HEAD", "a"), kind = objectAt(dir, "HEAD", "a");
  if (was === undefined) delete process.env[variable]; else process.env[variable] = was;
  ok(kind === undefined, `with ${variable} set the batch is not asked`);
  if (variable === "GIT_DIR") ok(took === "another repository\n", "and the single call reads what git's own variable names");
}

// A repository whose `.git` is a file (a working tree of another's): the batch asks it by that file.
const tree2 = path.join(base, "second-tree");
git(dir, "worktree", "add", "-q", "--detach", tree2, "HEAD");
ok(fs.statSync(path.join(tree2, ".git")).isFile() && textAt(tree2, "HEAD", "a") === "second\n" && objectAt(tree2, "HEAD", "a")?.type === "blob", "a linked working tree is read through its .git file");
// (and a root that is no repository, or has no `.git` of its own)
const none = fs.mkdtempSync(path.join(base, "none-"));
ok(textAt(none, "HEAD", "a") === null && objectAt(none, "HEAD", "a") === undefined, "a folder that is no repository holds nothing");

// More repositories than are kept at once: each is still read, the one asked least recently closed and asked again.
const roots = [];
for (let i = 0; i < 7; i++) {
  const r = fs.mkdtempSync(path.join(base, "many-"));
  git(r, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(r, "n"), `repository ${i}\n`);
  git(r, "add", "-A");
  git(r, "commit", "-q", "-m", "n");
  roots.push(r);
}
ok([...roots, ...roots].every((r, i) => textAt(r, "HEAD", "n") === `repository ${i % 7}\n`), "each of seven repositories is read, twice round");

// Where git cannot be started at all, the batch fails and the single call is made, which fails too: nothing is read, and nothing is thrown.
const lost = fs.mkdtempSync(path.join(base, "lost-")), path_ = process.env.PATH;
git(lost, "init", "-q", "-b", "main");
fs.writeFileSync(path.join(lost, "n"), "x\n");
git(lost, "add", "-A");
git(lost, "commit", "-q", "-m", "n");
process.env.PATH = "";
let thrown = false, lostText, lostObject;
try { lostText = textAt(lost, "HEAD", "n"); lostObject = objectAt(lost, "HEAD", "n"); } catch { thrown = true; }
process.env.PATH = path_;
ok(!thrown && lostText === null && lostObject === undefined, "with git out of reach a text is null and an object is left to the single call");

// The paths the listing may answer for: written as git reads them.
ok(["a", "d/f", ".claude/settings.json", "a b", "a\\b", "..a", "a..", ".x/y."].every(exactPath), "a path of plain steps is exact");
ok(["", ":a", "a//b", "/a", "a/", "./a", "a/./b", "../a", "a/../b", "a/..", "a\nb", "a\rb"].every(p => !exactPath(p)), "a path with an empty step, a . or .. step, magic or a line's end is not");

fs.rmSync(base, { recursive: true, force: true });
console.log(`${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
