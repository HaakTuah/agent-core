// Is this sync PR pure (floor rule 8)? Its merger runs it from a checkout of the core's `main`, never from the PR's own
// copy under core/, which the PR could change, in the project's clone with the sync branch's head checked out:
//
//   node <the core's main>/scripts/pure-sync.mjs
//
// It reads the branch's head commit, not the working tree, and passes only when, against the project's main, the diff
// touches only core/, core-manifest.md and .github/workflows/*.yml; outside core/, each changed line differs from the
// one it replaces only in a commit SHA, and each new SHA is the new pin; the new pin is a commit of the core's main at
// or past the old one; core/ is the core's tree at that pin exactly; and every call to a core workflow is pinned to a
// commit of the core's main. It prints the head it checked, for the merge call's `sha` (`modules/github-calls.md`), so
// nothing pushed after the check can merge. Git and Node's own modules only; it changes nothing.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = "https://github.com/HaakTuah/agent-core.git";
const git = (args, cwd) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 }).trim();
const ok = (args, cwd) => { try { git(args, cwd); return true; } catch { return false; } };
const SHA = /\b[0-9a-f]{40}\b/gu;
const PIN = /^Core: HaakTuah\/agent-core at ([0-9a-f]{40}), copied whole under core\//mu;
const CALL = /HaakTuah\/agent-core\/\.github\/workflows\/[\w.-]+@([0-9a-f]{40})/gu;
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/u;
const fail = [];

const head = git(["rev-parse", "HEAD"]);
git(["fetch", "-q", "--no-tags", "origin", "refs/heads/main"]);
const base = git(["merge-base", "FETCH_HEAD", head]);
const show = (rev, file) => { try { return git(["show", `${rev}:${file}`]); } catch { return ""; } };
const oldPin = show(base, "core-manifest.md").match(PIN)?.[1];
const pin = show(head, "core-manifest.md").match(PIN)?.[1];
if (!oldPin || !pin) fail.push("core-manifest.md has no \"Core: HaakTuah/agent-core at <full SHA>, copied whole under core/\" line on both sides");

// what the merge would bring: only the copy, the manifest's pin and the workflows' call pins, each moved to the new pin
const files = git(["diff", "--no-renames", "--name-only", base, head]).split("\n").filter(Boolean);
for (const line of git(["diff", "--no-renames", "--summary", base, head]).split("\n").filter(Boolean)) {
  if (!line.trim().replace(/^.*\b\d{6} /u, "").startsWith("core/")) fail.push(`a file created, deleted or given a new mode: ${line.trim()}`);
}
for (const f of files) {
  if (f.startsWith("core/")) continue;
  if (f !== "core-manifest.md" && !WORKFLOW.test(f)) { fail.push(`${f}: not the core's copy, its pin or a workflow`); continue; }
  const diff = git(["diff", "--no-renames", "-U0", base, head, "--", f]).split("\n");
  const count = new Map();
  const hunks = diff.findIndex((d) => d.startsWith("@@"));
  for (const l of hunks < 0 ? [] : diff.slice(hunks)) {
    if (l[0] !== "+" && l[0] !== "-") continue;
    const shas = l.slice(1).match(SHA);
    if (!shas) { fail.push(`${f}: a changed line with no commit SHA: ${l.slice(0, 80)}`); continue; }
    if (l[0] === "+" && shas.some((s) => s !== pin)) fail.push(`${f}: a new SHA that is not the new pin: ${l.slice(0, 80)}`);
    const key = l.slice(1).replace(SHA, "<sha>");
    count.set(key, (count.get(key) ?? 0) + (l[0] === "+" ? 1 : -1));
  }
  for (const [key, n] of count) if (n !== 0) fail.push(`${f}: a change beyond a pin: ${key.slice(0, 80)}`);
}

// every pin the branch ends with: the manifest's and each call's
const pins = new Set(pin ? [pin] : []);
for (const f of git(["ls-tree", "--name-only", head, "--", ".github/workflows/"]).split("\n").filter((n) => WORKFLOW.test(n))) {
  for (const m of show(head, f).matchAll(CALL)) pins.add(m[1]);
}
const dir = mkdtempSync(join(tmpdir(), "core-main-"));
try {
  git(["init", "-q", "--bare"], dir);
  git(["fetch", "-q", "--no-tags", CORE, "refs/heads/main"], dir);
  for (const sha of pins) if (!ok(["merge-base", "--is-ancestor", sha, "FETCH_HEAD"], dir)) fail.push(`${sha} is not a commit of the core's main`);
  if (oldPin && pin && !ok(["merge-base", "--is-ancestor", oldPin, pin], dir)) fail.push(`the pin goes back: ${pin} is not past ${oldPin}`);
  if (pin && ok(["cat-file", "-e", `${pin}^{commit}`], dir) && git(["rev-parse", `${pin}^{tree}`], dir) !== git(["rev-parse", `${head}:core`])) {
    fail.push(`core/ is not the core's tree at ${pin}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (fail.length) {
  for (const f of fail) console.log(`  NOT PURE ${f}`);
  console.log("not a pure sync: it gets its reviews as any PR (floor rule 8)");
  process.exit(1);
}
console.log(`a pure sync: core ${oldPin.slice(0, 7)} -> ${pin.slice(0, 7)}, ${files.length} files, ${pins.size} pins on the core's main`);
console.log(`merge it with sha=${head}`);
