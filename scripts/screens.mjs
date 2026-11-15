// The screen checks' baseline (modules/screens.md, "What holds it"; core archive 227; #284): a project that turns on a
// check of a screen names it in its config, and its own tool, which the core leaves to it, writes what it found; this
// script holds that against the check's baseline, in the shape check's form (shape.mjs, beside this file; its
// `unclaimed`), so nothing gets worse. A finding no listed entry covers is new: one of a check the config marks
// "binds" fails, saying its mend, and one of a check that "reports" is said and fails nothing ("Nothing locks a
// project" in the core's AGENTS.md). A listed entry may shrink and may not grow. A run covers only the screens a pull
// request changes, so an entry of a screen not run is never read as gone. Against the pull request's base
// (SCREENS_BASE, set by the project's workflow) an entry may join the baseline only with its reason under "grown", as
// in the shape check's (modules/code-shape.md, "Never worse").
//
// The config (left out: the one the manifest's *screen checks* row names, in backticks, else checks/screens.json; with
// none, every check is off and nothing is read): { "baseline": "<path>", "checks": { "<check>": "reports" | "binds" } },
// each check one of CHECKS. What was found (a file the project's tool writes): { "screens": [<the screens it ran>],
// "found": { "<check>: <screen>: <what>": true | { "count": <n> } } }.
//
//   node core/scripts/screens.mjs <found> [<config>]           the check
//   node core/scripts/screens.mjs <found> [<config>] --first   write the first baseline; only where none exists yet
//   node core/scripts/screens.mjs <found> [<config>] --write   lower the baseline to what still stands on the screens run
// Run from the project's root by the project's own workflow, after its tool. Reads only, but for the baseline it writes
// when told; git and Node's own modules.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { notLinked, parseBaseline, unclaimed } from "./shape.mjs";
import { started } from "./started.mjs";

export const CHECKS = ["values", "rendered", "pictures", "timing", "console"];
export const KIT = "checks/screens.json";
const MODES = ["reports", "binds"];

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
const isObject = v => !!v && typeof v === "object" && !Array.isArray(v);
const json = (text, at, mend) => { try { return JSON.parse(text); } catch { return refuse(`${at} could not be read as JSON`, mend); } };
const tolerant = read => { try { return read(); } catch { return null; } };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// An entry's check and screen, from its id: "<check>: <screen>: <what>".
export const partsOf = id => { const [check, screen] = id.split(": "); return { check, screen }; };
// Each id is its own group: a finding is claimed only by the entry of its own id, never one of another screen.
const own = id => ({ kind: partsOf(id).check, group: id });

// The config the manifest's *screen checks* row names (its first path to a .json file, in backticks), else the kit's.
export const where = manifest => /`([\w./-]+\.json)`/u.exec(/^.*\*screen checks\*.*$/mu.exec(String(manifest ?? ""))?.[0] ?? "")?.[1] ?? KIT;

// The config's text as the check reads it: { baseline, checks: Map of check to mode }; it throws where it cannot.
export function parseConfig(text, at) {
  const form = `write it as {"baseline": "<path>", "checks": {"<check>": "reports" or "binds"}}, each check one of ${CHECKS.join(", ")} (core/modules/screens.md, "What holds it")`;
  const c = json(text, at, form);
  if (!isObject(c) || typeof c.baseline !== "string" || !/^[\w.-][\w./-]*$/u.test(c.baseline) || c.baseline.includes("..") || !isObject(c.checks)) refuse(`${at} is not in the form the check reads`, form);
  const unknown = Object.keys(c).filter(k => !["baseline", "checks"].includes(k));
  if (unknown.length) refuse(`${at} holds ${unknown.join(", ")}, which the check does not read`, `take ${unknown.length === 1 ? "it" : "them"} out: ${form}`);
  for (const [name, mode] of Object.entries(c.checks)) {
    if (!CHECKS.includes(name)) refuse(`${at} names the check "${name}", which is none of the module's`, `name it as one of ${CHECKS.join(", ")}`);
    if (!MODES.includes(mode)) refuse(`${at} gives the check "${name}" the mode ${JSON.stringify(mode)}`, `give it "reports", which fails nothing, or "binds", where a session can mend what it finds`);
  }
  return { baseline: c.baseline, checks: new Map(Object.entries(c.checks)) };
}

// What the project's tool found, as the check reads it: { screens: Set, found: Map of id to numbers or true, off: the
// count of findings of checks the config leaves off }; it throws where it cannot.
export function parseFound(text, at, config) {
  const form = `have the project's tool write {"screens": [<the screens it ran>], "found": {"<check>: <screen>: <what>": true or {"count": <n>}}}`;
  const f = json(text, at, form);
  if (!isObject(f) || !Array.isArray(f.screens) || !f.screens.every(s => typeof s === "string" && s) || !isObject(f.found)) refuse(`${at} is not in the form the check reads`, form);
  const found = new Map();
  let off = 0;
  for (const [id, n] of Object.entries(f.found)) {
    const { check, screen } = partsOf(id);
    if (!CHECKS.includes(check) || !f.screens.includes(screen) || id.split(": ").length < 3) refuse(`${at} holds the finding "${id}", which names no check of the module's and screen it ran`, form);
    if (!(n === true || (isObject(n) && Number.isInteger(n.count) && n.count > 0 && Object.keys(n).length === 1))) refuse(`${at} gives "${id}" what is neither true nor a count`, form);
    if (config.checks.has(check)) found.set(id, n); else off++;
  }
  return { screens: new Set(f.screens), found, off };
}

// The verdict on what was found against the baseline and, where known, the base's baseline: { fail, said, listed }.
export function verdict({ config, at, self, found, baseline, base }) {
  const fail = [], said = [];
  for (const id of unclaimed(found.found, baseline.listed, {}, own)) {
    if (config.checks.get(partsOf(id).check) === "binds") fail.push(`FAIL: ${id}: new, and the check ${partsOf(id).check} binds here. Mend: mend the screen as core/modules/screens.md says of it, then run the project's tool and this check again`);
    else said.push(`said ${id}: new; the check ${partsOf(id).check} reports here and fails nothing`);
  }
  if (base?.listed) {
    const joined = unclaimed(baseline.listed, base.listed, {}, own).filter(id => !(baseline.grown[id] ?? "").trim());
    if (joined.length) fail.push(`FAIL: ${config.baseline} lists ${plural(joined.length, "entry", "entries")} that ${base.name} did not, and the baseline only shrinks. Mend: take each out of the baseline (git checkout ${base.name} -- ${config.baseline}, then node ${self} <found> ${at} --write) and mend the screen; only where there is no other way, give each its reason under "grown" by its id, and in the pull request, with a fresh session's word there that it found no other way`, ...joined.map(id => `  ${id}`));
  }
  return { fail, said, listed: baseline.listed.size };
}

// A baseline as the check writes it: what grew kept for what stays, the entries sorted.
const written = (listed, grown) => {
  const kept = Object.fromEntries(Object.entries(grown).filter(([id]) => listed.has(id)));
  return `${JSON.stringify({ ...(Object.keys(kept).length ? { grown: kept } : {}), listed: Object.fromEntries([...listed].sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`;
};

// The baseline lowered to what still stands: an entry of a screen that was run stays only where it was found again,
// at the smaller count; one of a screen not run stays as it is.
export function lowered(listed, found) {
  const out = new Map();
  for (const [id, n] of listed) {
    if (!found.screens.has(partsOf(id).screen)) { out.set(id, n); continue; }
    const now = found.found.get(id);
    if (now === undefined) continue;
    out.set(id, now === true || n === true ? n : { count: Math.min(now.count, n.count) });
  }
  return out;
}

// A path of the project's own, relative and inside it, read through no link (floor rule 13), or refused with its mend.
const inside = (file, what) => {
  if (path.isAbsolute(file) || file.split(/[\\/]/u).includes("..")) refuse(`${what} ${file} is not inside the project`, `give a path relative to the project's root with no "..": the check reads nothing outside it`);
  return notLinked(file);
};

// The base a pull request merges into, as SCREENS_BASE names it: { name, show: file => its text there or null }, or
// null where none is named.
function baseOf() {
  const name = process.env.SCREENS_BASE || "";
  if (!name) return null;
  if (!/^\w[\w./^~-]*$/u.test(name)) refuse(`SCREENS_BASE (${JSON.stringify(name).slice(0, 80)}) is no plain name of a commit or branch`, "set it to the pull request's base, such as origin/main");
  const git = args => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  try { git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]); } catch { refuse(`${name} is not a commit here`, `fetch it (git fetch origin ${name.replace(/^origin\//u, "")}), or set SCREENS_BASE to the pull request's base`); }
  return { name, show: file => tolerant(() => git(["show", `${name}:${file}`])) };
}

// What the base's baseline listed, read where the base's own config put it: null only where the base had no config
// (the pull request turns the checks on, and writes the first baseline); an empty list where its baseline is gone.
function baseListed(base, at) {
  const text = base.show(at);
  if (text === null) return null;
  const was = tolerant(() => parseConfig(text, `${base.name}:${at}`));
  const listed = was && tolerant(() => parseBaseline(base.show(was.baseline) ?? "", `${base.name}:${was.baseline}`, "").listed);
  return listed ?? new Map();
}

function first(config, at, self, found) {
  if (fs.existsSync(inside(config.baseline, "the baseline"))) refuse(`${config.baseline} stands already`, `lower it with node ${self} <found> ${at} --write instead`);
  fs.mkdirSync(path.dirname(config.baseline), { recursive: true });
  fs.writeFileSync(inside(config.baseline, "the baseline"), written(found.found, {}));
  console.log(`${config.baseline}: ${plural(found.found.size, "entry", "entries")} listed, the first baseline`);
  return 0;
}

function run(config, at, self, found, command) {
  if (command === "--first") return first(config, at, self, found);
  if (!fs.existsSync(inside(config.baseline, "the baseline"))) refuse(`there is no baseline at ${config.baseline}`, `write the project's first with node ${self} <found> ${at} --first, and commit it`);
  const restore = `take it back as the base holds it, or write it again with node ${self} <found> ${at} --first, in a pull request the reviews read`;
  const baseline = parseBaseline(fs.readFileSync(config.baseline, "utf8"), config.baseline, restore);
  if (command === "--write") {
    const kept = lowered(baseline.listed, found);
    fs.writeFileSync(config.baseline, written(kept, baseline.grown));
    return console.log(`${config.baseline}: ${plural(kept.size, "entry", "entries")} listed, ${baseline.listed.size} before`), 0;
  }
  const b = baseOf(), listed = b && baseListed(b, at);
  const v = verdict({ config, at, self, found, baseline, base: b && { name: b.name, listed } });
  for (const line of v.said) console.log(line);
  if (found.off) console.log(`note ${plural(found.off, "finding")} of checks the config leaves off, not read`);
  if (!b) console.log("note no base to compare with (set SCREENS_BASE to the branch the work started from), so the baseline was not checked for what joined it");
  else if (listed === null) console.log(`note ${b.name} had no config at ${at}: this pull request turns the checks on, and its baseline is the first`);
  for (const line of v.fail) console.error(line);
  if (v.fail.length) return 1;
  console.log(`ok   nothing new that binds on ${plural(found.screens.size, "screen")}; ${plural(v.listed, "old finding")} listed in ${config.baseline}`);
  return 0;
}

// Where no config stands: every check is off, unless the base held one, which no pull request takes out.
function off(at, named) {
  if (named) refuse(`there is no config at ${at}`, `write it as core/modules/screens.md, "What holds it", says, or run with no config named`);
  const b = baseOf();
  if (b?.show(at) != null) refuse(`${at} is gone, and ${b.name} holds it: no pull request takes the screen checks' config out`, `take it back as ${b.name} holds it (git checkout ${b.name} -- ${at})`);
  console.log(`ok   no screen check is on here (${at} does not stand): each is off until the project names it`);
  return 0;
}

function main(argv) {
  const self = path.relative(process.cwd(), fileURLToPath(import.meta.url)).replace(/\\/gu, "/");
  const command = ["--first", "--write"].includes(argv.at(-1)) ? argv.at(-1) : null;
  const args = command ? argv.slice(0, -1) : argv;
  if (args.length < 1 || args.length > 2 || args.some(a => a.startsWith("--"))) refuse(`the check does not know ${argv.join(" ") || "a run with no file of findings"}`, `run node ${self} <found> [<config>] [--first | --write]`);
  const at = args[1] ?? where(tolerant(() => fs.readFileSync("core-manifest.md", "utf8")));
  if (!fs.existsSync(inside(at, "the config"))) return off(at, args[1]);
  const config = parseConfig(fs.readFileSync(at, "utf8"), at);
  if (!fs.existsSync(inside(args[0], "the file of findings"))) refuse(`there is no file of findings at ${args[0]}`, "run the project's tool first, which writes it inside the project");
  return run(config, at, self, parseFound(fs.readFileSync(args[0], "utf8"), args[0], config), command);
}

if (started(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused) && !/\. Mend: /u.test(e.message)) throw e; console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
