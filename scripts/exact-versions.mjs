// The exact-versions check (floor rule 7, floor/topics.md: "every package, tool and script at one exact version, never
// a range"), for every project that takes the core, on every PR. It fails a package list of npm's (a tracked
// package.json outside core/) that asks for a package by a range, a tag or an address that can move. What passes:
//   - one exact version (1.2.3, with or without a pre-release or build part), also behind an alias (npm:name@1.2.3);
//   - a package of the project's own: a file: or link: path that stays inside the project, or a workspace (a
//     package.json that a package list's "workspaces" names and no "!" there leaves out) asked for as * or by
//     workspace:, by that list or another of its workspaces, which npm then fills from the project itself;
//   - a git address, in a form npm reads as one, at a full commit SHA (a plain https address only on the hosts npm
//     knows: elsewhere npm downloads it as a file, so there it is written git+https://).
// What another installer holds, the project's own checks do (README.md, "How a project takes the core", point 5). Reads
// only; Node's own modules. It checks the project it lies in, whatever the directory it is started from. Run by the
// copies workflow (.github/workflows/copies.yml).
//
//   node core/scripts/exact-versions.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION = "\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?";
const EXACT = new RegExp(`^(?:npm:(?:@[^/@]+/)?[^/@]+@)?${VERSION}$`, "u");
const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
// The forms npm reads as a git address. A plain https address is one only on the hosts npm knows; anywhere else npm
// downloads it as a file, whatever follows the #, so there a git address says so (git+https://).
const GIT = new RegExp(`^(?:${[
  "git\\+(?:ssh|https?|file):\\/\\/\\S+", "git:\\/\\/\\S+", "(?:github|gitlab|bitbucket|gist):\\S+", "[^@\\s/]+@[^:.\\s/]+\\.[^:\\s/]+:\\S+",
  "https:\\/\\/(?:github\\.com|gitlab\\.com|bitbucket\\.org)\\/[\\w.-]+\\/[\\w.-]+", "[A-Za-z0-9][\\w-]*\\/[\\w.-]+",
].join("|")})$`, "u");
const git = spec => { const at = spec.lastIndexOf("#"); return at > 0 && /^[0-9a-f]{40}$/u.test(spec.slice(at + 1)) && GIT.test(spec.slice(0, at)); };
const dirOf = file => file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
// A file: or link: path, read from the package list's folder (dir), that names a place inside the project.
const inside = (spec, dir) => {
  const to = /^(?:file|link):(.*)$/u.exec(spec)?.[1];
  if (!to || /^([/\\~]|[A-Za-z]:)/u.test(to)) return false;
  const parts = [];
  for (const part of [...dir.split("/"), ...to.split(/[/\\]/u)].filter(p => p && p !== ".")) {
    if (part !== "..") parts.push(part);
    else if (!parts.length) return false;
    else parts.pop();
  }
  return true;
};
const exact = (spec, dir) => EXACT.test(spec) || inside(spec, dir) || git(spec);

// Whether a name fits a pattern whose only sign is *, any run of characters; in time that grows with their lengths.
const fits = (pattern, name) => {
  let p = 0, n = 0, star = -1, mark = 0;
  while (n < name.length) {
    if (pattern[p] === "*") { star = p++; mark = n; }
    else if (pattern[p] === name[n]) { p++; n++; }
    else if (star < 0) return false;
    else { p = star + 1; n = ++mark; }
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
};
// Whether a folder is one a "workspaces" pattern names: part by part, ** standing for any number of folders.
const names = (pattern, folder) => {
  const want = pattern.split("/").filter(part => part && part !== "."), have = folder.split("/").filter(Boolean), dead = new Set();
  const from = (w, h) => {
    if (w === want.length) return h === have.length;
    if (dead.has(`${w} ${h}`)) return false;
    let ok = false;
    if (want[w] === "**") for (let skip = h; skip <= have.length && !ok; skip++) ok = from(w + 1, skip);
    else ok = h < have.length && fits(want[w], have[h]) && from(w + 1, h + 1);
    if (!ok) dead.add(`${w} ${h}`);
    return ok;
  };
  return from(0, 0);
};

// The project's workspaces: for each package list given (each { file, pkg }) that names "workspaces", and for each of
// those workspaces, the names npm fills from the project itself when that list asks for them. A file to its names.
export function workspaces(lists) {
  const own = new Map();
  for (const { file, pkg } of lists) {
    const globs = Array.isArray(pkg?.workspaces) ? pkg.workspaces : Array.isArray(pkg?.workspaces?.packages) ? pkg.workspaces.packages : [];
    const named = globs.filter(g => typeof g === "string"), base = dirOf(file);
    const under = folder => base === "" ? folder : folder.startsWith(`${base}/`) ? folder.slice(base.length + 1) : null;
    // A folder a "!" leaves out is no workspace, wherever the "!" stands in the list.
    const member = folder => folder !== null && named.some(g => !g.startsWith("!") && names(g, folder)) && !named.some(g => g.startsWith("!") && names(g.slice(1), folder));
    const mine = lists.filter(l => l.file !== file && typeof l.pkg?.name === "string" && member(under(dirOf(l.file))));
    for (const at of mine.length ? [file, ...mine.map(l => l.file)] : []) own.set(at, new Set([...own.get(at) ?? [], ...mine.map(l => l.pkg.name)]));
  }
  return own;
}

// What is wrong in one package list, each as a line of text; own is the set of workspaces' names it may ask for as its
// project's own, and dir the folder it lies in.
export function problems(pkg, own = new Set(), dir = "") {
  const found = [];
  const check = (field, name, spec) => {
    if (own.has(name) && typeof spec === "string" && (spec === "*" || spec.startsWith("workspace:"))) return;
    if (typeof spec !== "string" || !exact(spec, dir)) found.push(`${field}: "${name}" at ${JSON.stringify(spec)} is no one exact version (floor rule 7)`);
  };
  for (const field of FIELDS) for (const [name, spec] of Object.entries(pkg[field] ?? {})) check(field, name, spec);
  const overrides = (node, field) => {
    for (const [name, spec] of Object.entries(node ?? {})) {
      if (spec && typeof spec === "object") overrides(spec, `${field} > ${name}`);
      else if (!(typeof spec === "string" && spec.startsWith("$"))) check(field, name === "." ? field : name, spec);
    }
  };
  overrides(pkg.overrides, "overrides");
  return found;
}

// The files the check reads, of those git tracks.
export const reads = files => files.filter(f => !f.startsWith("core/") && !f.split("/").includes("node_modules") && /(^|\/)package\.json$/u.test(f));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  process.chdir(fileURLToPath(new URL(".", import.meta.url)));
  process.chdir(run(["rev-parse", "--show-toplevel"]).trim());
  const files = reads(run(["ls-files", "-z"]).split("\0").filter(Boolean));
  const lists = files.map(file => {
    try { return { file, pkg: JSON.parse(fs.readFileSync(file, "utf8")) }; }
    catch { return { file, pkg: null }; }
  });
  const own = workspaces(lists);
  let failed = 0;
  for (const { file, pkg } of lists) {
    const found = pkg && typeof pkg === "object" && !Array.isArray(pkg) ? problems(pkg, own.get(file), dirOf(file)) : ["cannot be read as a package list, so what it asks for is unknown"];
    for (const what of found) { failed++; console.log(`FAIL ${file}: ${what}`); }
  }
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} package lists of npm's read: ${failed} asking for no one exact version`);
  process.exit(failed ? 1 : 0);
}
