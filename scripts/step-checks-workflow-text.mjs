// What the steps read of the text of the project's workflows: a key given twice, a line break the YAML package does
// not read, and the NuGet check's paths (steps.mjs, beside this file, holds the steps, and step-checks.mjs the words
// they share). Each piece takes the project as steps.mjs's `project` reads it and returns the mend, or null where the
// step is done; a step names the ones it needs, none runs by itself. It reads only. Node's own modules and git only.
import { CORE } from "./core-address.mjs";
import { installed } from "./packages.mjs";
import { projectFilesByContent } from "./nuget.mjs";
import { copyAt, readable } from "./workflow-calls.mjs";
import { pathsLetThrough } from "./workflow-run.mjs";
import { foreignBreaks, keysTwice, reads } from "./workflows.mjs";
import { DEEPEST, LONGEST } from "./yaml-keys.mjs";
import { importsOf, readProject as readBuildFile } from "./nuget.mjs";

// Each key given twice in one mapping of a workflow or an action of the project's own, as the workflow check reads
// them (workflows.mjs and yaml-keys.mjs, beside this file), which GitHub refuses, running none of the file's jobs: the
// old ones, which the check notes and passes, listed here at every sync until they are gone (#393). Null where none is.
export function keysOnce(p) {
  // (with the core's packages not installed, as after a sync made by a copy from before #654, this step cannot be read:
  // it says so, with the install, and every other step is still told)
  if (!installed("yaml")) return `The core's packages are not installed, so the workflows could not be read for a key given twice: run \`if [ -f ${copyAt(p)}scripts/install.mjs ]; then node ${copyAt(p)}scripts/install.mjs; fi\`, then \`node ${copyAt(p)}scripts/steps.mjs\` again.`;
  const read = reads(p.files, copyAt(p)).map(f => [f, keysTwice(p.read(f) ?? "")]);
  const all = read.flatMap(([f, keys]) => keys.filter(k => k.key !== null).map(k => `\`${f}\` line ${k.line}, "${k.key}" (first on line ${k.first})`));
  const found = all.length > 25 ? [...all.slice(0, 25), `and ${all.length - 25} more, which show once these are mended`] : all; // (a hostile file gives a key for each line: #970)
  const unread = by => read.filter(([, keys]) => keys.some(k => k.key === null && Boolean(k.size) === by)).map(([f]) => `\`${f}\``), deep = unread(false), long = unread(true);
  const said = [
    found.length ? `In one pull request, keep one of the two keys where a workflow or an action of the project's gives one twice in a mapping, with what both said in it (two \`if:\` conditions joined by \`&&\`, two \`env:\` mappings as one), since GitHub runs none of such a file's jobs: ${found.join("; ")}.` : "",
    deep.length ? `In one pull request, nest the lists and mappings of these workflows or actions no deeper than a workflow needs, a few levels, since past ${DEEPEST} deep a key given twice in them cannot be read: ${deep.join("; ")}.` : "",
    long.length ? `In one pull request, cut these workflows or actions to under ${LONGEST} characters, the steps they repeat moved to a script or a workflow of their own, since past that a key given twice in them cannot be read: ${long.join("; ")}.` : ""];
  return said.filter(Boolean).join(" ") || null;
}

// Each workflow or action of the project's own that holds a line break YAML 1.1 reads and the YAML package the workflow check
// reads with does not (U+0085, U+2028, U+2029), as the workflow check reads them (workflows.mjs, foreignBreaks): the old
// ones, which the check notes and passes, listed here at every sync until they are gone (#876). Null where none is.
export function lineBreaksMended(p) {
  const found = reads(p.files, copyAt(p)).map(f => [f, foreignBreaks(p.read(f) ?? "")]).filter(([, b]) => b)
    .map(([f, b]) => `\`${f}\` line ${b.line}, ${b.code}${b.count > 1 ? ` and ${b.count - 1} more` : ""}`);
  return found.length ? `In one pull request, replace each U+0085, U+2028 or U+2029 of a workflow or an action of the project's with an ordinary line feed (inside a double-quoted string, with the escape of its own code, \\u0085, \\u2028 or \\u2029), since a reader of YAML 1.1 reads each as a line end and the workflow check's does not: ${found.join("; ")}.` : null;
}

// Where the project's call to the NuGet check starts only on the paths it names, each build file a build reads by
// another name than those (an Import's, a property's MSBuild's targets import, a file whose root is a Project), as the
// core's NuGet check lists them, that the filter lets through no change to; null where it names none.
export function nugetPathsHold(p) {
  readable(p, text => /\/\.github\/workflows\/nuget\.yml@/i.test(text));
  const filtered = Object.entries(p.workflows).filter(([, w]) => Array.isArray(w.yaml?.on?.pull_request?.paths) && Object.values(w.yaml?.jobs ?? {})
    .some(job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/nuget.yml@`.toLowerCase())));
  if (!filtered.length) return null;
  const at = copyAt(p), own = p.files.filter(f => !f.startsWith(at)), byContent = projectFilesByContent(p.root, own);
  const read = [...new Set([...byContent, ...importsOf(own, f => readBuildFile(p.root, f), byContent).brought.keys()])];
  const wrong = filtered.map(([f, w]) => [f, read.filter(r => !pathsLetThrough(w.yaml.on.pull_request.paths, [r]))]).filter(([, missed]) => missed.length);
  // (each as a pattern that matches only itself, its glob characters taken as themselves, and quoted as YAML quotes it;
  // a name that holds a control character is named with "?" in its place, to be renamed)
  const asPattern = f => `'${f.replace(/[\\[\]*?!+]/g, c => `\\${c}`).replace(/'/g, "''")}'`.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029`]/gu, "?");
  return wrong.length ? `The \`paths:\` of a call to the NuGet check let through a change to every file a build of the project's reads, or the check starts on none of its changes: add each, by its exact path, to ${wrong.map(([f, missed]) => `\`.github/workflows/${f}\`: ${missed.map(asPattern).join(", ")}`).join("; ")} (a name shown with "?" holds a control character or a backtick: rename it).` : null;
}
