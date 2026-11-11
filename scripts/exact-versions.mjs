// The exact-versions check (floor rule 7, floor/topics.md: "every package, tool and script at one exact version, never
// a range"), for every project that takes the core, on every PR. It fails a package list of npm's (a tracked
// package.json outside core/) that asks for a package by a range, a tag or an address that can move. What passes:
//   - one exact version (1.2.3, with or without a pre-release or build part), also behind an alias (npm:name@1.2.3);
//   - a package of the project's own: one a package.json of the project names, or a file: or link: path;
//   - a git address at a full commit SHA.
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
const exact = spec => EXACT.test(spec) || /^(file|link):/u.test(spec) || /^(git\+|git:|github:)[^#]*#[0-9a-f]{40}$/u.test(spec);

// What is wrong in one package list, each as a line of text; own is the set of the project's own packages' names.
export function problems(pkg, own = new Set()) {
  const found = [];
  const check = (field, name, spec) => {
    if (own.has(name)) return;
    if (typeof spec !== "string" || !exact(spec)) found.push(`${field}: "${name}" at ${JSON.stringify(spec)} is no one exact version (floor rule 7)`);
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
  const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  process.chdir(fileURLToPath(new URL(".", import.meta.url)));
  process.chdir(git(["rev-parse", "--show-toplevel"]).trim());
  const files = reads(git(["ls-files", "-z"]).split("\0").filter(Boolean));
  const lists = files.map(file => {
    try { return { file, pkg: JSON.parse(fs.readFileSync(file, "utf8")) }; }
    catch { return { file, pkg: null }; }
  });
  const own = new Set(lists.map(l => l.pkg?.name).filter(n => typeof n === "string"));
  let failed = 0;
  for (const { file, pkg } of lists) {
    const found = pkg && typeof pkg === "object" && !Array.isArray(pkg) ? problems(pkg, own) : ["cannot be read as a package list, so what it asks for is unknown"];
    for (const what of found) { failed++; console.log(`FAIL ${file}: ${what}`); }
  }
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} package lists of npm's read: ${failed} asking for no one exact version`);
  process.exit(failed ? 1 : 0);
}
