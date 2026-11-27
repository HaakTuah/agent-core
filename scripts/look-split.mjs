// The scheduled look's reader of the files past the *size marks*' split mark whose question stands (look.mjs; #1413,
// point 6): a pull request that changes one fails nothing for it, so the question it asks (split-mark.mjs, beside this
// file) is kept here, in one issue, as a task, until a split or its line under "past" answers it, as a cap the default
// branch stands past is kept (size.mjs, `due`; #750, point 6). A file is listed only where a commit the default branch
// holds from ASKED_SINCE on changed it, the day a pull request stopped failing for it: before then a pull request that
// changed one was failed until its question was answered, and one no change touched asks nothing (tasks/cleaning.md,
// "Size asks"). In every project: the marks are read where its run of the reading-size check reads them
// (check-configs.mjs), in the core its own. Git and Node's own modules.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marksConfig } from "./check-configs.mjs";
import { corePath, floorCopy } from "./core-path.mjs";
import { sizeOf } from "./file-size.mjs";
import { leadsOut, parseBounded } from "./guards.mjs";
import { project } from "./steps.mjs";
import { entryFor, unanswered } from "./split-mark.mjs";

export const ASKED_SINCE = "2026-11-28";
export const SPLIT_TITLE = "A file past the split mark asks how a split lets someone read less";
export const CORE_MARKS = ".github/sizes.json";

// The look's reader, ({ manifest, root }) => { title, body } (a body of null closes the issue) or { title, unread }
// (leaving it as it stands), where the marks or the history cannot be read; null where no repository or marks stand.
export function splitAsked({ manifest, root = "." }) {
  const git = args => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  const unread = why => ({ title: SPLIT_TITLE, unread: why });
  // (no repository here: no history, so nothing changed asks anything)
  try { git(["rev-parse", "--is-inside-work-tree"]); } catch { return null; }
  let config;
  try { config = manifest === null ? CORE_MARKS : marksConfig(project(root)); } catch (e) { return unread(`the size marks' file could not be told (${e.message})`); }
  const file = path.join(root, config);
  if (!fs.existsSync(file)) return null;
  let marks;
  try { marks = parseBounded(fs.readFileSync(file, "utf8")); } catch { return unread(`\`${config}\` could not be read as JSON`); }
  if (!Number.isInteger(marks?.split) || marks.split <= 0) return unread(`\`${config}\` holds no "split"`);
  const past = marks.past && typeof marks.past === "object" && !Array.isArray(marks.past) ? marks.past : {};
  let changed;
  try {
    if (git(["rev-parse", "--is-shallow-repository"]).trim() !== "false") return unread("the history is shallow, so what the default branch changed is not read whole");
    changed = new Set(git(["log", `--since=${ASKED_SINCE}T00:00:00Z`, "--format=", "--name-only", "HEAD"]).split("\n").filter(Boolean));
  } catch { return unread("git could not read the default branch's history"); }
  const skip = [corePath(root) || "core/", floorCopy(root), ...(Array.isArray(marks.skip) ? marks.skip : [])].filter(s => typeof s === "string" && s);
  const lines = [];
  for (const f of [...changed].sort()) {
    const at = path.join(root, f);
    if (skip.some(s => f.startsWith(s)) || leadsOut(root, at) || !fs.statSync(at, { throwIfNoEntry: false })?.isFile()) continue;
    if (fs.statSync(at).size <= marks.split || fs.readFileSync(at).subarray(0, 8000).includes(0)) continue;
    const n = sizeOf(at), why = n > marks.split && unanswered(n, past[f]);
    if (why) lines.push(`- \`${f}\`, ${n} bytes: ${why}. Its line, once no split lets anyone read less: \`${entryFor(n)}\`.`);
  }
  if (!lines.length) return { title: SPLIT_TITLE, body: null };
  return { title: SPLIT_TITLE, body: [`Files past the split mark (${marks.split} bytes, "split" in \`${config}\`) that the default branch changed since ${ASKED_SINCE}, whose question no split or line under "past" answers yet (core/tasks/cleaning.md, "Size asks; a reader who reads less answers"). A task, which fails no pull request (#1413, point 6): for each, ask in what ways it could be split so that someone reads less; split it along one in a pull request of its own that proves its behaviour unchanged, or, where there is none, write its line under "past".`, "", ...lines].join("\n") };
}
