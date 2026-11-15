// A project beside a fresh start (AGENTS.md, "Nothing locks a project"; core archive 215): what the starter kit of the
// copy this file lies in would write for a new project of the same kind today, against what the project holds, so
// that an earlier sync taken in part, or a row filled poorly, shows where no step's check reads it (steps.mjs, beside
// this file). It lists each difference: a file the kit writes that the project lacks; of a rule file, the manifest or
// an issue form, a paragraph of the kit's that the project holds nowhere in that file (the words compared with their
// spacing made one, so a reflowed line is no difference), and of a table, a row whose first cell it lacks (a row's
// value is the project's to fill); of a workflow or the hooks' settings, a line of the kit's it lacks (a pin and its
// version comment made one, since a sync and Dependabot move them); of a check's config, a key of the kit's it lacks.
// A paragraph the kit leaves to the project ("FILL IN") and the progress file, the project's own, are not compared.
// Each difference is one the manifest's "Differences" declares on purpose, on the owner's word, by a line that quotes
// the file's path ("AGENTS.md"), so that file is not compared, or a task the project's agents take. The kind is read
// from the project: its owner and name from the manifest and AGENTS.md, npm and NuGet from its calls to the core's
// signature and NuGet checks, a private repository from its having neither the CodeQL nor the licence workflow, a game
// from "Modules: all". It reads only and fails nothing. Node's own modules and git only.
//
//   node core/scripts/fresh.mjs          from a project's root: the differences, or that there are none
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEMPLATES, files } from "./init.mjs";
import { ownerOf } from "./releases.mjs";
import { started } from "./started.mjs";
import { call, project } from "./steps.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED = new Set(["docs/PROGRESS.md"]); // (the progress file: the project's own from its first task)

// The starter kit's options for a project of the same kind as `p` (steps.mjs reads it), and the pin its manifest names.
export function kind(p) {
  const pin = /^Core: \S+ at ([0-9a-f]{40}),/m.exec(p.manifest)?.[1] ?? "0".repeat(40);
  const o = { owner: ownerOf(p.manifest) ?? "the-owner", name: /^# (.+)$/m.exec(p.read("AGENTS.md") ?? "")?.[1]?.trim() ?? path.basename(p.root) };
  const npm = call(p, "signatures.yml")?.with?.directory;
  if (npm !== undefined) o.packages = String(npm).replace(/\/+$/, "") || ".";
  if (call(p, "nuget.yml")) o.nuget = /package-ecosystem:\s*"?nuget"?\s*\n\s*directory:\s*"?\/?([^"\n]*)"?/.exec(p.read(".github/dependabot.yml") ?? "")?.[1]?.replace(/\/+$/, "") || ".";
  if (!p.workflows["codeql.yml"] && !p.workflows["licences.yml"]) o.private = true;
  if (/^Floor: whole\. Modules: all\.$/m.test(p.manifest)) o.game = true;
  return { o, pin };
}

const oneSpace = t => t.replace(/\s+/g, " ").trim();
const pinsAsOne = t => t.replace(/@[0-9a-f]{40}(\s*#\s*v?[\w.-]+)?/g, "@<pin>");
const blocks = t => t.replace(/\r\n/g, "\n").split(/\n\s*\n/).map(b => b.trim()).filter(b => b && !b.includes("FILL IN"));
const firstCell = row => /^\|([^|]*)\|/.exec(row)?.[1]?.trim();

// The differences between what the kit writes, `kit` ([path, text]), and the project `p`: each a line to print.
export function differences(p, kit) {
  const out = [];
  for (const [to, want] of kit) {
    if (SKIPPED.has(to) || p.differences.some(l => l.includes(`"${to}"`))) continue;
    const have = p.read(to);
    if (have === null) { out.push(`${to}: missing (the starter kit writes it today)`); continue; }
    const lacks = [];
    if (/\.md$/.test(to)) {
      const rows = new Set(have.split("\n").filter(l => l.startsWith("|")).map(firstCell));
      const prose = oneSpace(pinsAsOne(have.split("\n").filter(l => !l.startsWith("|")).join("\n")));
      for (const b of blocks(want)) {
        const tableRows = b.split("\n").filter(l => l.startsWith("|"));
        for (const r of tableRows) if (!/^\|[\s|:-]+\|$/.test(r) && !rows.has(firstCell(r))) lacks.push(`the row "${firstCell(r)}"`);
        const rest = b.split("\n").filter(l => !l.startsWith("|")).join("\n");
        if (rest.trim() && !prose.includes(oneSpace(pinsAsOne(rest)))) lacks.push(`the paragraph "${oneSpace(rest).slice(0, 70)}${oneSpace(rest).length > 70 ? "…" : ""}"`);
      }
    } else if (/\.json$/.test(to)) {
      let had = null;
      try { had = JSON.parse(have); } catch { lacks.push("its content as JSON"); }
      if (had) for (const key of Object.keys(JSON.parse(want))) if (!(key in had)) lacks.push(`the key "${key}"`);
    } else {
      const lines = new Set(have.split("\n").map(l => pinsAsOne(l).trim()));
      for (const l of want.split("\n").map(l => pinsAsOne(l).trim()).filter(l => l && !l.startsWith("#") && !l.includes("FILL IN")))
        if (!lines.has(l)) lacks.push(`the line "${l.slice(0, 70)}"`);
    }
    if (lacks.length) out.push(`${to}: lacks ${lacks.join("; ")}`);
  }
  return out;
}

// What the kit of this copy would write for the project at `root`.
export function fresh(p) {
  const { o, pin } = kind(p);
  const modules = fs.readdirSync(path.join(HERE, "modules")).filter(n => n.endsWith(".md"));
  return files(o, pin, modules, name => fs.readFileSync(path.join(HERE, TEMPLATES, name), "utf8"));
}

export function report(found) {
  return found.length
    ? [`Beside a fresh start (\`core/scripts/fresh.mjs\`): ${found.length} differences from what the starter kit writes today. Each is declared in the manifest's "Differences", on the owner's word, by a line that quotes the file's path, or is a task the project's agents take.`, ...found.map(d => `- ${d}`)].join("\n")
    : "Beside a fresh start (`core/scripts/fresh.mjs`): no difference from what the starter kit writes today.";
}


if (started(import.meta.url)) {
  try {
    const p = project(process.cwd());
    console.log(report(differences(p, fresh(p))));
  } catch (e) {
    console.error(`FAIL: the project could not be compared (${e.message}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
