// The core takes its own modules (AGENTS.md, "The core abides by its own rules"; core archive 213; #255): each file of
// modules/ is named in the section of the core's AGENTS.md that says what this repository takes, read there at the
// start of every task or when needed, or is listed under that section's "Not taken" with the reason it cannot apply to
// a repository of rules and scripts. It fails a module the section names nowhere, a name there that is no module, a
// module listed as not taken with no reason or in no form it can read, and one both listed so and named elsewhere in
// the section. Whether a reason holds stays with the reviews. This repository only; no project runs it. Its tests
// workflow runs it on every pull request here and every push to main (.github/workflows/tests.yml). It checks the
// repository it lies in, from any directory; Node's own modules only.
//
//   node scripts/own-modules.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { started } from "./started.mjs";

export const SECTION = "## The core this repository takes";
const NOT_TAKEN = /^Not taken\b/u;
const NAMED = /(?:^@|`)modules\/([^`\s/]+\.md)/gmu;
const BULLET = /^- `modules\/([^`\s/]+\.md)`:(.*)$/u;

// What is wrong, one line each, with how AGENTS.md (its text) holds the modules (their file names): an empty list where
// nothing is.
export function faults(agents, modules) {
  const lines = String(agents).split(/\r?\n/u);
  const start = lines.indexOf(SECTION);
  if (start < 0) return [`AGENTS.md has no section "${SECTION.slice(3)}", which names the modules this repository takes`];
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  const section = lines.slice(start + 1, end);
  const found = [];
  // the "Not taken" list: the bullets right after its line, each `modules/<name>`: its reason, a reason going on in
  // lines indented by two spaces
  const notTaken = new Map(), inList = new Set();
  const head = section.findIndex(l => NOT_TAKEN.test(l));
  if (head >= 0) {
    let i = head + 1;
    while (i < section.length && section[i].trim() === "") i++;
    let current = null;
    for (; i < section.length && (section[i].startsWith("- ") || (current !== null && section[i].startsWith("  "))); i++) {
      inList.add(i);
      if (section[i].startsWith("  ")) { notTaken.set(current, `${notTaken.get(current)} ${section[i].trim()}`); continue; }
      const m = BULLET.exec(section[i]);
      if (!m) { found.push(`AGENTS.md, "Not taken": "${section[i]}" is not in the form - \`modules/<name>\`: <the reason>`); current = null; continue; }
      if (notTaken.has(m[1])) found.push(`AGENTS.md, "Not taken": modules/${m[1]} is listed twice`);
      current = m[1];
      notTaken.set(current, m[2].trim());
    }
  }
  const taken = new Set();
  section.forEach((l, i) => { if (!inList.has(i)) for (const m of l.matchAll(NAMED)) taken.add(m[1]); });
  const all = new Set(modules);
  for (const name of [...taken, ...notTaken.keys()].filter(n => !all.has(n)).sort()) {
    found.push(`AGENTS.md, "${SECTION.slice(3)}", names modules/${name}, which is no module of modules/`);
  }
  for (const name of [...all].sort()) {
    if (notTaken.has(name)) {
      if (notTaken.get(name) === "") found.push(`AGENTS.md, "Not taken": modules/${name} has no reason; give why it cannot apply to a repository of rules and scripts, or take it`);
      if (taken.has(name)) found.push(`AGENTS.md, "${SECTION.slice(3)}": modules/${name} is both taken and listed as not taken; keep one`);
    } else if (!taken.has(name)) {
      found.push(`modules/${name} is neither taken nor given a reason: name it in AGENTS.md, "${SECTION.slice(3)}", where it is read, or list it there under "Not taken" with why it cannot apply here`);
    }
  }
  return found;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let agents, modules;
  try {
    agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
    modules = fs.readdirSync(path.join(root, "modules")).filter(f => f.endsWith(".md"));
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    return 1;
  }
  const found = faults(agents, modules);
  for (const f of found) console.error(`FAIL: ${f}`);
  if (found.length) return 1;
  console.log(`each of the ${modules.length} modules is taken here, or given its reason`);
  return 0;
}

if (started(import.meta.url)) process.exitCode = main();
