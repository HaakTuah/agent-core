// The core's releases (README.md, "How a project takes the core", point 1): a release is a tag `release-N` on a commit
// of the core's main, cut on the owner's word (AGENTS.md, "A release is cut on the owner's word"; release.mjs, beside
// this file). A project follows either the core's main or its releases: what its manifest's *follows* row says, and
// with no such row, main where its *owner's account* is the account the core is under, the releases where its owner is
// another, who then takes only what the core's owner chose to hand on. The sync and the core-moved check (sync.mjs,
// core-moved.mjs) ask here what a project follows, which release is the newest, and whether it asks a sync of the
// project at all (staysAt). Every function reads; none writes but fetchCore, into the empty folder it is given. Git and
// Node's own modules only.
import { execFileSync } from "node:child_process";
import { CORE, OWNER } from "./core-address.mjs";
import { modulesOf } from "./manifest-reads.mjs";
import { MODULES } from "./reading.mjs";

const SHA = /^[0-9a-f]{40}$/;
// a release's name: the word and a whole number above zero, written without leading zeros
export const RELEASE = /^release-([1-9][0-9]{0,8})$/;
// the core's sync notes: what a sync asks of a project beyond the copy
export const NOTES = "setup/sync-notes.md";
// Git's own variables that point a command at another repository than the folder it is run in (a hook, or a shell
// that set them, hands them on): left out of every call here and in release.mjs, so each lands in the folder it names
// and nowhere else.
export const elsewhere = /^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE)$/i;
export const plainEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !elsewhere.test(name)));
// Git in the bare repository at `dir`, which every call names outright (--git-dir), never finding it from the folder it
// runs in: git refuses that where its safe.bareRepository is `explicit`, as Git 3.0 makes it by default. Each script
// that makes such a repository (fetchCore, sync.mjs, pure-sync.mjs, release.mjs) reaches it through this alone.
export const inBare = (dir, args, options = {}) =>
  execFileSync("git", [`--git-dir=${dir}`, ...args], { cwd: dir, env: plainEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
const git = (args, dir) => inBare(dir, args).trim();
const holds = (args, dir) => { try { git(args, dir); return true; } catch { return false; } };

// The manifest's *owner's account* (core.yml checks the row's form), or null where it has no one such row.
export function ownerOf(manifest) {
  const found = [...manifest.matchAll(/^\| \*owner's account\* \| `([A-Za-z0-9-]+)` \|$/gm)];
  return found.length === 1 ? found[0][1] : null;
}

// What the project follows, "main" or "releases": its manifest's *follows* row (| *follows* | `releases` |), and with
// no such row, by whose project it is. Null where the row is there twice or says anything else, or where there is no
// row and no one owner's account to go by: a script that gets null stops, and never guesses.
export function followsOf(manifest) {
  const rows = [...manifest.matchAll(/^\|[ \t]*\*follows\*[ \t]*\|(.*)\|[ \t]*$/gm)];
  if (rows.length > 1) return null;
  if (rows.length === 1) return /^`(main|releases)`$/.exec(rows[0][1].trim())?.[1] ?? null;
  const owner = ownerOf(manifest);
  if (owner === null) return null;
  return owner.toLowerCase() === OWNER.toLowerCase() ? "main" : "releases";
}

// The core's main and its release tags, with their history, fetched into the empty folder `dir`, so that which commit
// is past which can be told there. (`url` is the tests' own: every other caller takes the core's address.)
export function fetchCore(dir, url = `https://github.com/${CORE}`) {
  git(["init", "-q", "--bare", dir], dir); // (the folder named outright: never a repository git was pointed at)
  git(["fetch", "-q", "--no-tags", url, "+refs/heads/main:refs/heads/main", "+refs/tags/release-*:refs/tags/release-*"], dir);
}

// Whether the commit `older` is `newer` or one it came from; false too where either is no commit there.
export const past = (older, newer, dir) => SHA.test(older) && holds(["merge-base", "--is-ancestor", older, newer], dir);

// Every tag there with a release's name, by its number, lowest first, with the commit it stands on: followed through
// to a commit however the tag was made (a tag of a tag too), so a release is never anything but a commit; null where
// it leads to none.
export function namedReleases(dir) {
  return git(["for-each-ref", "--format=%(refname:strip=2)", "refs/tags/"], dir).split("\n")
    .map(name => ({ name, n: Number(RELEASE.exec(name)?.[1]) })).filter(r => Number.isSafeInteger(r.n))
    .map(r => { let sha = null; try { sha = git(["rev-parse", "--verify", "--quiet", `refs/tags/${r.name}^{commit}`], dir); } catch { /* (no commit) */ } return { ...r, sha: SHA.test(sha ?? "") ? sha : null }; })
    .sort((a, b) => a.n - b.n);
}

// The releases in a repository that holds the core's main and its tags, the newest (the highest number) first. A tag
// counts only where its name is a release's, its commit is one of main, and it is at or past the release numbered
// before it: a tag on anything else, or one numbered high on an older commit by mistake, is no release, so the newest
// by number is always the newest in main's history too.
export function releasesIn(dir) {
  const kept = [];
  for (const r of namedReleases(dir)) {
    if (r.sha && past(r.sha, "refs/heads/main", dir) && (!kept.length || past(kept.at(-1).sha, r.sha, dir))) kept.push(r);
  }
  return kept.reverse();
}

// The newest release there, with whether it is past the pin (`moved`: the project's copy is behind it), or null where
// the core has cut none. A pin at or past the newest release has nothing to take: a project never goes back.
export function newestRelease(pin, dir) {
  const [newest] = releasesIn(dir);
  return newest ? { ...newest, moved: newest.sha !== pin && past(pin, newest.sha, dir) } : null;
}

// What taking the core from `old` to `pin` asks of a project beyond the copy: the entries the sync notes gained between
// the two (a commit from before the notes gives every entry), or null where they cannot be read: never an all-clear.
export function asksBetween(old, pin, dir) {
  try {
    return git(["diff", "--unified=0", "--no-color", "--no-ext-diff", "--no-textconv", old, pin, "--", NOTES], dir)
      .split("\n").filter(l => l.startsWith("+- ")).map(l => l.slice(1));
  } catch { return null; }
}

// The core's own files that no project reads (#342): its queue, and each of its workflows that no project can call,
// named one by one, never by a pattern (each has no workflow_call trigger and no starter-kit file names it:
// releases-test.mjs).
export const OWN_FILES = ["QUEUE.md", ".github/workflows/own-description.yml", ".github/workflows/own-look.yml",
  ".github/workflows/own-security-review.yml", ".github/workflows/release.yml", ".github/workflows/size.yml",
  ".github/workflows/tests.yml"];

// What never matters to a project (#242; README.md, point 1): a list exact and short, never a guess. A module its
// manifest's "Modules:" line does not name and its "Not taken:" line does (any other module matters: one the list
// forgot, or every one where the line says "all" or cannot be read), a test of the core's own scripts (which nothing a
// project runs names: releases-test.mjs), the core's own issue forms, and OWN_FILES. Every other file of the core is
// something the project takes.
export function matters(file, manifest) {
  if (/^scripts\/[^/]+-test\.mjs$/.test(file) || file.startsWith(".github/ISSUE_TEMPLATE/") || OWN_FILES.includes(file)) return false;
  const module = MODULES.includes(file.slice(0, Math.max(0, file.lastIndexOf("/")))) && file.endsWith(".md") ? file.slice(file.lastIndexOf("/") + 1) : undefined;
  const { taken, notTaken } = modulesOf(manifest);
  return !(module && taken instanceof Set && !taken.has(module) && notTaken.has(module));
}

// What of what the project takes changed from `old` to `pin` (each file, a removed or renamed one by both its names),
// or null where the change cannot be read: never an all-clear.
export function takenBetween(old, pin, manifest, dir) {
  let files;
  try { files = inBare(dir, ["diff", "--name-only", "--no-renames", "-z", old, pin]).split("\0").filter(Boolean); } catch { return null; }
  return files.filter(f => matters(f, manifest));
}

// Whether a project that follows the releases stays at its pin, the newest release asking no sync of it (#242): its pin
// is the release just before the newest, and nothing it takes changed between the two. One release at most is passed
// over: the upgrade test proves a sync from each of the last two (upgrade-test.mjs), so a project that stayed syncs at
// the next release, whatever that one changes. In doubt it syncs.
export function staysAt(pin, manifest, dir) {
  const [newest, before] = releasesIn(dir);
  if (!newest || before?.sha !== pin || newest.sha === pin) return false;
  return takenBetween(pin, newest.sha, manifest, dir)?.length === 0;
}
