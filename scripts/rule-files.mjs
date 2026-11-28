// The project's rule files, so the list stands in one place: those floor rule 3 names (`AGENTS.md`, `CLAUDE.md`,
// `SECURITY.md` and the core manifest, where they exist), and those its SECURITY.md adds in rule 3 (its "the rule
// files:" line, ended by ";"). With `{ tools: true }` it adds the files an agent tool takes its instructions from
// (floor rule 3; tasks/tools.md; `toolFiles`): GEMINI.md, the entry files the starter kit writes for Kiro and
// Antigravity (ENTRY_FILES, which entry-files.mjs beside this file reads), and every file git tracks under a tool's
// folders of instructions (FOLDERS). The copies and pointer checks (copies.mjs, pointers.mjs), the code-review wait and
// the state report read them all; what a project held in a tool's files before the two checks read them is kept as a
// baseline there (core-changes/projects.md of the core, "Nothing locks a project"; #405). Run from the project's root. Node's own
// modules and git only. `read` gives a file's text, or null where it is not there, and `list` the files git tracks
// under a folder: by default the work tree's, each a file of the project's own that no link leads out of (guards.mjs),
// and a check passes a `read` and a `list` that read a commit's tree, to hold the base's list.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { leadsOut } from "./guards.mjs";
// Each agent tool's entry file, as the starter kit writes it (tasks/tools.md, "One door in").
export const ENTRY_FILES = Object.freeze({ claude: "CLAUDE.md", kiro: ".kiro/steering/core.md", antigravity: ".agents/rules/core.md" });
// The folders a tool takes its instructions from (floor rule 3; tools/kiro.md and antigravity.md): every file in them.
export const FOLDERS = Object.freeze([".kiro/steering", ".kiro/agents", ".agents/rules", ".agent/rules"]);
// (a file of the work tree is read only where, every link on its way followed, it lies inside the project and is a
// file: one that leads out, or to a folder, reads as not there)
const inside = f => !leadsOut(process.cwd(), f);
const tracked = dir => { try { return execFileSync("git", ["ls-files", "-z", "--", dir], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(f => f && inside(f)); } catch { return []; } };
export const readHere = f => { try { return inside(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, "utf8") : null; } catch { return null; } };
export const FLOOR = Object.freeze(["AGENTS.md", "CLAUDE.md", "SECURITY.md", "core-manifest.md"]);
export const TOOL_FILES = Object.freeze(["GEMINI.md", ...Object.values(ENTRY_FILES)]);
// A reader of the files of a commit's tree, as the work tree's reader reads them, for a check that holds a pull request
// to its base: every link on a path followed, the file's own and a folder's on its way, while it leads inside that tree,
// at most 40 in all; null where one leads out of it or nowhere, and for what is no file (a folder, a submodule). Run
// from the project's root. `place`, where given, is placeAt(commit)'s, so that the tree is listed once; `bound`, where
// given, the most bytes a file it reads may hold, a larger one read as none.
export function readAt(commit, place = placeAt(commit), { bound } = {}) {
  return f => { const at = place(f); return at === null || (bound !== undefined && !(place.size(at) <= bound)) ? null : place.show(at); };
}
// (a link's text that leads out of any tree: none read, or one written from a root)
const outward = to => to === null || /^([\\/]|[A-Za-z]:)/u.test(to);
// Where a path leads, from the root, read part by part as a system reads it: each part that `isLink` says is a link
// has its text (`text`, null where none is read) put in its place, read from the link's own folder, a `..` steps back
// from the folder reached, and a part with more after it must be a folder (`isFolder`), while it leads inside the
// tree, at most 40 links; the path it ends at, or null where a link leads out, the links run past 40 or a part with
// more after it is no folder. placeAt reads a commit's tree through it and entry-files.mjs the work tree, so the two
// read a link alike.
export function followLinks(f, isLink, text, isFolder) {
  if (String(f).startsWith("/")) return null;
  let todo = String(f).split("/");
  const cur = [];
  for (let hops = 0; todo.length;) {
    const p = todo.shift();
    if (cur.length && !isFolder(cur.join("/"))) return null;
    if (p === "" || p === ".") continue;
    if (p === "..") { if (!cur.length) return null; cur.pop(); continue; }
    const next = [...cur, p].join("/");
    if (!isLink(next)) { cur.push(p); continue; }
    const to = ++hops > 40 ? null : text(next);
    if (outward(to)) return null;
    todo = to.replace(/\\/gu, "/").split("/").concat(todo);
  }
  return cur.join("/");
}
// Where readAt(commit) reads a path from: the path, from the root, of the file it leads to, every link on its way
// followed as readAt follows it, or null where readAt reads nothing there; `show` reads a file of the tree by its path,
// `size` gives its bytes, and `held` says whether the tree holds anything at a path: a link on its way it cannot follow,
// one that leads to nothing in the tree, and what it does not read (a folder, a submodule) included.
export function placeAt(commit) {
  const run = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  let modes = null;
  const sizes = new Map();
  const mode = f => {
    if (!modes) {
      modes = new Map();
      try { for (const e of run(["ls-tree", "-r", "-l", "-z", commit]).split("\0")) { const m = /^(\d+) \S+ \S+ +(\S+)\t([\s\S]+)$/u.exec(e); if (m) { modes.set(m[3], m[1]); sizes.set(m[3], Number(m[2])); } } } catch { /* (no such commit: nothing there) */ }
    }
    return modes.get(f);
  };
  const show = at => { try { return run(["show", `${commit}:${at}`]); } catch { return null; } };
  const size = at => (mode(at) === undefined ? undefined : sizes.get(at));
  let folders = null;
  const isFolder = at => {
    if (!folders) { mode(""); folders = new Set([...modes.keys()].flatMap(k => k.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/")))); }
    return folders.has(at);
  };
  // (a link's text, read only where it is at most 4096 bytes, as a system's paths are; a longer one is none)
  const linkText = at => (size(at) <= 4096 ? show(at) : null);
  const place = f => { const at = followLinks(f, p => mode(p) === "120000", linkText, isFolder); return at !== null && /^100/u.test(mode(at) ?? "") ? at : null; };
  // (whether the tree holds anything at a path, read part by part as a system reads it: each link's text put in its
  // place and read from the link's own folder; a part a link's text brings that the tree lacks makes it a link that
  // leads nowhere, held, while a part of the path's own that the tree lacks, past every link, holds nothing; a link
  // that leads out of the tree, one past 4096 bytes, a submodule on the way and more than 40 links are held)
  const held = f => {
    const todo = path.posix.normalize(f).split("/").map(p => ({ p, linked: false }));
    for (let cur = "", hops = 0; todo.length;) {
      const { p, linked } = todo.shift();
      if (p === "" || p === ".") continue;
      if (mode(cur) === "160000") return true;
      if (p === "..") { if (cur === "" || !isFolder(cur)) return true; cur = cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/")) : ""; continue; }
      const next = cur ? `${cur}/${p}` : p, m = mode(next);
      if (m === "120000") {
        const to = ++hops > 40 ? null : linkText(next);
        if (outward(to)) return true;
        todo.unshift(...to.replace(/\\/gu, "/").split("/").map(q => ({ p: q, linked: true })));
        continue;
      }
      if (m === undefined && !isFolder(next)) return linked;
      cur = next;
    }
    return true;
  };
  return Object.assign(place, { show, size, held });
}
// The files an agent tool takes its instructions from, as `read` and `list` find them: those of TOOL_FILES, then those
// git tracks under FOLDERS, each that `read` reads (so a link that leads out of the project is none, at a commit too).
export const toolFiles = (read = readHere, list = tracked) => TOOL_FILES.concat(FOLDERS.flatMap(d => list(d))).filter(f => read(f) !== null);
// A rule file or protected folder by its name alone (floor rule 3): what a tool takes its instructions from, wherever
// it lies, the threat model, the manifest, the copy of the core, and the folders of what runs by itself.
export const RULES = /(?:^|\/)(?:AGENTS|CLAUDE|SECURITY|GEMINI|REVIEW)(?:\.[\w-]+)?\.md$|threat-model|^core-manifest\.md$|^core\/|(?:^|\/)\.(?:github|claude|agents?)\//iu;

export function ruleFiles(read = readHere, list = tracked, { tools = false } = {}) {
  const security = read("SECURITY.md");
  if (security === null) throw new Error('the project has no SECURITY.md yet, where the checks read its rule files. Mend: write it from the starter kit\'s template (core/setup/template/SECURITY.md.tmpl), its rule 3 with the line "**the rule files:** ...;"');
  const rule = /\*\*the rule files:\*\*([^;]*);/.exec(security);
  if (!rule) throw new Error('SECURITY.md, rule 3, has no "the rule files:" line, where the checks read the project\'s own. Mend: add to rule 3 the line "**the rule files:** `<each file>`, ...;" as the starter kit\'s template (core/setup/template/SECURITY.md.tmpl) writes it');
  const own = tools ? toolFiles(read, list) : [];
  return [...new Set(FLOOR.filter(f => read(f) !== null).concat(own, [...rule[1].matchAll(/`([^`]+)`/g)].map(m => m[1])))];
}
