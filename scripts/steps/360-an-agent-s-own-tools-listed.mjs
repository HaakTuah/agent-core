// The step of setup/sync-notes/360-an-agent-s-own-tools-listed.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { coreOf, kitHooks, check as toolsCheck } from "../agent-tools.mjs";
import { listed, markOf, show } from "../agent-tools-entries.mjs";
import { NOT_KIT_WHY } from "../agent-tools-read.mjs";
import { listing } from "../agent-tools-listing.mjs";
import { fetchedBy, libraryOf } from "../hook-source.mjs";
import { readProject } from "../agent-tools-project.mjs";
import { installed } from "../packages.mjs";
import { calls, copyAt } from "../workflow-calls.mjs";
import { licenceConfig } from "../check-configs.mjs";
import { runFiles } from "../own-runs.mjs";
import { COST } from "../step-checks.mjs";
import { Unwritten, inEnds, put, writable } from "../step-writers.mjs";

// The agent-tools check's own reading, with a missing list read as an empty one: what it would fail once written. The
// core's licences.yml runs the check itself; a project that runs the licence script from a workflow of its own runs it
// beside it, as of exact versions, and the config is the one that workflow passes: check-configs.mjs. { unread } where
// a Codex config cannot be read, since the core's packages are not installed (every other step is still told).
function reading(p) {
  const own = calls(p, "licences.yml").length ? [] : runFiles(p, "licences.mjs");
  const beside = own.some(f => runFiles(p, "agent-tools.mjs").includes(f));
  const file = licenceConfig(p);
  let config = null;
  try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as no list, below) */ }
  if (p.read(".codex/config.toml") !== null && !installed("smol-toml")) return { unread: `The core's packages are not installed, so \`.codex/config.toml\` could not be read for the tools it configures: run \`if [ -f ${copyAt(p)}scripts/install.mjs ]; then node ${copyAt(p)}scripts/install.mjs; fi\`, then \`node ${copyAt(p)}scripts/steps.mjs\` again.` };
  const head = readProject(p.root), list = listed(config, file) ?? { keys: new Set(), problems: [] };
  const { problems, missing, pins, sources } = toolsCheck(head, list, kitHooks(undefined, coreOf(p.manifest)), file);
  // (a hook whose command is not the kit's form is weighed, below; any other source, a setting of a kind no kit writes or a
  // file fetched that is no plain file, keeps the check's own mend, which only narrows what runs with power)
  const toWeigh = sources.filter(([k]) => head.sources.get(k)?.why === NOT_KIT_WHY);
  return { own, beside, file, config, head, problems, missing, pins, sources, toWeigh };
}

// What a script lists exactly (#1361, point 2): each skill and hook the project's own files configure that the list
// lacks, a file of the project's own ("this project", as the list's mend says of one), that stood before the step came,
// as a baseline does. Only where both what configures it and what it runs are plain files committed at HEAD, with no
// change not yet committed (`busy`), outside the
// copy of the core and any submodule: a skill whose SKILL.md is one, and a hook every one of whose commands is in the
// starter kit's form and fetches one from main, no library's. Never a plug-in or a tool server, whose publisher and
// version are no file's to read; a hook of any other kind, which a session weighs; nor a tool whose source
// the check questions: each is a security judgement, never a mend, and left to the step's.
function exactly(r, p, busy) {
  const { blobs } = listing(p.root, "HEAD"), copy = copyAt(p);
  const own = at => typeof at === "string" && blobs.has(at) && !at.startsWith(copy) && !busy.has(at);
  // (an entry the list holds for the tool already, in a form the check refuses, is the check's to name, never written twice)
  const stands = k => (Array.isArray(r.config?.agentTools) ? r.config.agentTools : []).some(e => e && `${e.kind} ${e.name}` === k);
  const ran = k => { const hook = r.head.runs.get(k); return hook?.runs && hook.commands.length && hook.commands.every(c => !libraryOf(c) && own(fetchedBy(c))); };
  return r.missing.map(([k]) => k).filter(k => /^(?:skill|hook) /u.test(k) && !r.sources.some(([s]) => s === k) && own(r.head.tools.get(k))
    && (k.startsWith("skill ") || ran(k)) && !stands(k));
}

export default { lead: "16 November 2026, an agent's own tools listed", cost: COST.line,
  check: p => {
    const r = reading(p);
    if (r.unread) return r.unread;
    const { own, beside, file, head, problems, missing, pins, sources, toWeigh } = r;
    // (a hook to be weighed is listed by the sentence on it below, never told to be taken out as an unlisted tool is)
    const weighed = new Set(missing.filter(([k]) => toWeigh.some(([s]) => s === k)).map(([, problem]) => problem));
    const wrong = [...head.problems, ...problems.filter(problem => !weighed.has(problem)), ...[...pins, ...sources.filter(s => !toWeigh.includes(s))].map(([, problem]) => problem)];
    if (own.length && !beside) wrong.push(`the workflow that runs the licence check, ${own.join(", ")}, runs \`node ${copyAt(p)}scripts/agent-tools.mjs ${file}\` beside it, as the core's \`licences.yml\` does`);
    // (a hook whose command is not the kit's form may still run its copy on main, which no check reads exactly: whether it
    // does, and what becomes of it, is a security judgement, never a mend; it is marked, which fails nothing, and given to
    // a task; #1248, point 6; its mark read from its command, #1273, point 2)
    const judged = toWeigh.length ? `Each hook below runs a command not in the starter kit's form, so nothing the check reads shows that it runs its copy on main (floor rule 3); whether it does is a security judgement, not a mend: list it under "agentTools" in \`${file}\` with the "from" named after it, "main" where its command has git show its file from main (\`git show refs/remotes/origin/main:<the file>\`), which marks what the command names and never shows that main's copy is what runs, else "the working tree", which marks it as standing before and fails nothing, and file one task, an issue, for a session at the strongest tier to weigh each, with the security reviews of a change to what runs with power, before it is rewritten in the starter kit's form or taken out, never taking one out before then: ${toWeigh.map(([k, problem]) => `${problem.replace(/\. Mend: [^]*$/u, "")} ("from": ${show(markOf(head.sources.get(k)))})`).join("; ")}.` : "";
    return wrong.length || judged ? [wrong.length ? `List under "agentTools" in \`${file}\` every plug-in, tool server, skill and hook the project configures for its agents beyond the starter kit's hooks, each as { "kind", "name", "publisher", "version" }, a plug-in or tool server at one exact version, the one its configuration pins where it can pin one, or take out what nobody meant to configure; and see that its check runs: ${wrong.join("; ")}` : "", judged].filter(Boolean).join(" ") : null;
  },
  // (the list written with what it lacks exactly, its other entries and keys kept; what is left, the check says again)
  write: (p, busy) => {
    const r = reading(p);
    if (r.unread) throw new Unwritten("the core's packages are not installed, so the Codex config could not be read");
    const add = exactly(r, p, busy), { file, config } = r;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Unwritten(`the licence check's config \`${file}\` is not there or is no JSON object`);
    if (Object.hasOwn(config, "agentTools") && !Array.isArray(config.agentTools)) throw new Unwritten(`"agentTools" in \`${file}\` is no list`);
    // (what is left, a plug-in or a tool server whose publisher and version a session gives, or a tool whose source is to
    // be weighed, the check's own mend says; nothing is written, and nothing said beside it)
    if (!add.length) return [];
    writable(p, file, busy);
    const entries = add.map(k => ({ kind: k.slice(0, k.indexOf(" ")), name: k.slice(k.indexOf(" ") + 1), publisher: "this project" }));
    put(p, file, inEnds(p, file, `${JSON.stringify({ ...config, agentTools: [...(config.agentTools ?? []), ...entries] }, null, 2)}\n`));
    return [file];
  } };
