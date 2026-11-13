// The core's releases (README.md, "How a project takes the core", point 1): a release is a tag `release-N` on a commit
// of the core's main, cut on the owner's word (AGENTS.md, "A release is cut on the owner's word"; release.mjs, beside
// this file). A project follows either the core's main or its releases: what its manifest's *follows* row says, and
// with no such row, main where its *owner's account* is the account the core is under, the releases where its owner is
// another, who then takes only what the core's owner chose to hand on. The sync and the core-moved check (sync.mjs,
// core-moved.mjs) ask here what a project follows and which release is the newest. Every function reads; none writes
// but fetchCore, into the empty folder it is given. Git and Node's own modules only.
import { execFileSync } from "node:child_process";
import { CORE, OWNER } from "./core-address.mjs";

const SHA = /^[0-9a-f]{40}$/;
// a release's name: the word and a whole number above zero, written without leading zeros
export const RELEASE = /^release-([1-9][0-9]{0,8})$/;
// the core's sync notes: what a sync asks of a project beyond the copy
export const NOTES = "setup/sync-notes.md";
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const holds = (args, cwd) => { try { git(args, cwd); return true; } catch { return false; } };

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
  git(["init", "-q", "--bare"], dir);
  git(["fetch", "-q", "--no-tags", url, "+refs/heads/main:refs/heads/main", "+refs/tags/release-*:refs/tags/release-*"], dir);
}

// Whether the commit `older` is `newer` or one it came from; false too where either is no commit there.
export const past = (older, newer, dir) => SHA.test(older) && holds(["merge-base", "--is-ancestor", older, newer], dir);

// The releases in a repository that holds the core's main and its tags, the newest (the highest number) first. A tag
// counts only where its name is a release's and its commit is one of main: a tag on anything else is no release.
export function releasesIn(dir) {
  return git(["for-each-ref", "--format=%(refname:strip=2) %(objectname) %(*objectname)", "refs/tags/"], dir)
    .split("\n").filter(Boolean)
    .map(line => { const [name, sha, commit] = line.split(" "); return { name, n: Number(RELEASE.exec(name)?.[1]), sha: commit || sha }; })
    .filter(r => Number.isSafeInteger(r.n) && past(r.sha, "refs/heads/main", dir))
    .sort((a, b) => b.n - a.n);
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
