// Whether a project's `.github/workflows/security-review.yml` calls the core's security review so that it posts its
// status on every pull request (#1085): read for owner-settings.mjs, which asks the owner to require that status only
// where it does, since a status required that never comes holds every pull request. Read in the kit's form alone
// (setup/template/workflows/security-review.yml.tmpl), and whatever else said not known. Node's own modules.

import path from "node:path";
import { CORE_SOURCE } from "./core-address.mjs";
import { parseYaml } from "./parse-yaml.mjs";

// Whether a workflow's triggers (`on`) start it on each of `name`'s events: no filter but its types, and those holding
// `kinds`, or left to GitHub's own where `byDefault` (GitHub's hold them).
function onEach(on, name, kinds, byDefault) {
  if (on === name || (Array.isArray(on) && on.includes(name))) return byDefault;
  const given = on && typeof on === "object" && !Array.isArray(on) && Object.hasOwn(on, name) ? on[name] : undefined;
  if (given === null) return byDefault;
  if (!given || typeof given !== "object" || Array.isArray(given) || !Object.keys(given).every(k => k === "types")) return false;
  return given.types === undefined ? byDefault : Array.isArray(given.types) && kinds.every(t => given.types.includes(t));
}

// Whether they start it on every pull request as the kit's do. A pull request's own events must name the kit's types,
// since GitHub's own leave out `ready_for_review`, on which alone a draft marked ready gets the status. Its comments are
// needed too, through which alone the check posts its status on a pull request from Dependabot or a fork (the core's
// `security-review.yml`).
const onEveryPull = on => onEach(on, "pull_request", ["opened", "reopened", "synchronize", "ready_for_review"], false)
  && onEach(on, "issue_comment", ["created", "edited"], true);

// What each of the core's workflows a project calls asks of its token (their own `permissions`), and the inputs it
// defines with their types (its `workflow_call`): GitHub refuses the whole run of a file in which a call is granted
// less, or given an input its workflow does not define.
const ASKS = { "security-review": { contents: "read", "pull-requests": "read", statuses: "write" }, "queue-only": { contents: "read", "pull-requests": "read", issues: "read" } };
const INPUTS = { "security-review": { advisory: "boolean", root: "string", private: "boolean", queue: "string", reviewers: "string" }, "queue-only": { root: "string", private: "boolean" } };
const LEVEL = { read: 1, write: 2 };
// (a call of the core's own repository, whose two workflows' asks and inputs are those above; a workflow of the same
// name in any other repository is not read, nor what it asks)
const CALL = new RegExp(`^${CORE_SOURCE}/\\.github/workflows/(security-review|queue-only)\\.yml@[\\w./-]+$`, "i");
const keysIn = (o, allowed) => o !== null && typeof o === "object" && !Array.isArray(o) && Object.keys(o).every(k => allowed.includes(k));

// Whether a token's `permissions` (`p`) grant all `asks`; none given at all leaves them to the repository's default,
// which is not read.
function grants(p, asks) {
  if (p === "write-all") return true;
  if (p === "read-all") return Object.values(asks).every(a => a === "read");
  return p !== null && typeof p === "object" && !Array.isArray(p) && Object.entries(asks).every(([k, a]) => (LEVEL[p[k]] ?? 0) >= LEVEL[a]);
}

// Whether job `j` of a workflow whose `permissions` are `top` is a call as the kit's are: of one of the core's two
// workflows, holding no key but these, given only inputs that workflow defines, each of its type (a boolean plainly so, since GitHub fails a call whose boolean input reads otherwise),
// granted what it asks, and needing only jobs `ids` holds.
function callWhole(j, ids, top) {
  if (!keysIn(j, ["needs", "if", "permissions", "uses", "with"])) return false;
  const core = typeof j.uses === "string" && CALL.exec(j.uses);
  if (!core) return false;
  const defined = INPUTS[core[1]], given = j.with ?? {};
  if (!keysIn(given, Object.keys(defined)) || !Object.entries(given).every(([k, v]) => typeof v === defined[k])) return false;
  const needs = j.needs === undefined ? [] : typeof j.needs === "string" ? [j.needs] : j.needs;
  return Array.isArray(needs) && needs.every(n => typeof n === "string" && ids.includes(n)) && grants(Object.hasOwn(j, "permissions") ? j.permissions : top, ASKS[core[1]]);
}

// Whether the workflow `doc` starts whole, in the kit's form and no other, since what GitHub refuses or leaves waiting
// in any other is not read: no key at its top but a name, its triggers, its `permissions` and its jobs (no
// `concurrency`, by which a later run could cancel the one that posts); each job named as GitHub allows, no two alike but for case, and a call
// whole (`callWhole`), so none waits on a runner or an approval; and no job needing itself, at any depth.
function startsWhole(doc, jobs) {
  const ids = Object.keys(jobs);
  if (!keysIn(doc, ["name", "on", "permissions", "jobs"]) || !ids.length || new Set(ids.map(id => id.toLowerCase())).size < ids.length || !ids.every(id => /^[A-Za-z_][\w-]*$/.test(id) && callWhole(jobs[id], ids, doc.permissions))) return false;
  const needsOf = id => [jobs[id].needs ?? []].flat(), done = new Set();
  const settles = (id, path) => done.has(id) || (!path.includes(id) && needsOf(id).every(n => settles(n, [...path, id])) && done.add(id));
  return ids.every(id => settles(id, []));
}

// Whether the project's `security-review.yml` (`text`) calls the core's security review so that it posts its status on
// every pull request: in a public repository whatever its inputs, in a private one (`open` false) only with
// `private: true` or `advisory: false`. True or false, as GitHub reads its YAML; null where it is no YAML here, calls no
// such workflow of the core's repository, gives it a `root` that does not hold the core (`holdsCore`), gives either input of a private one's call a value that is no plain boolean (an expression GitHub reads
// at its run), starts on some pull requests alone, runs its call on a condition other than the kit's, or may not start
// whole (`startsWhole`), since that cannot be told.
// Whether `root`, the folder a call of the security review is given, holds the core in the project (`has`: whether the
// project holds a file by its path), as the call needs to post: its Node's version and the check's script, without
// which the workflow fails or says nothing. A value read only at its run, or a path out of the project, is not read.
function holdsCore(root, has) {
  if (typeof root !== "string" || /\$\{\{/.test(root)) return false;
  const at = path.posix.normalize(root.replace(/\/+$/, "") || ".");
  if (path.posix.isAbsolute(at) || at === ".." || at.startsWith("../")) return false;
  return [".node-version", "scripts/security-review.mjs"].every(f => has(path.posix.join(at, f)));
}

export function callsPosting(text, open, has) {
  let doc;
  try { doc = parseYaml(text); } catch { return null; }
  const jobs = doc?.jobs && typeof doc.jobs === "object" && !Array.isArray(doc.jobs) ? doc.jobs : {};
  const calls = Object.values(jobs).filter(j => typeof j?.uses === "string" && CALL.exec(j.uses)?.[1] === "security-review");
  if (!calls.length) return null;
  const everyPull = onEveryPull(doc.on) && startsWhole(doc, jobs);
  // (its job runs whatever a job it needs did: the kit's condition, or none and no job needed)
  const always = j => j.if === "${{ !cancelled() }}" || (j.if === undefined && j.needs === undefined);
  const said = calls.map(j => {
    const given = j.with && typeof j.with === "object" ? j.with : {};
    if (open || given.private === true || given.advisory === false) return everyPull && always(j) && holdsCore(given.root ?? "core", has) ? true : null;
    return [given.private, given.advisory].every(v => v === undefined || typeof v === "boolean") ? false : null;
  });
  return said.includes(true) ? true : said.includes(null) ? null : false;
}
