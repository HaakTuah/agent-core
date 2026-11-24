// What the steps of the modules a project takes read and write (#1094): the modules its manifest's list neither takes
// nor leaves out, each placed from what is read exactly (manifest-reads.mjs, `factsOf` and `placeOf`), and the line
// "Modules to confirm:" that asks the owner once where a module's taking is a choice. The steps of the sync notes 160,
// 470, 480 and 500 name the modules they place, written by step-writers.mjs's `writePlaced`; that of 23 November 2026,
// the confirmation. It reads only. Node's own modules only.
import { GAME_ROWS } from "./init.mjs";
import { CONFIRM, factsOf, moduleNames, modulesOf, toConfirm, toPlace } from "./manifest-reads.mjs";
import { HERE, shown } from "./step-checks.mjs";
import { Unread } from "./workflow-calls.mjs";

const MANIFEST = "core-manifest.md";
// The modules of the core this script stands in (`only` of them, where given; those of `except` left aside) the project's
// manifest neither takes nor leaves out, each with its place; Unread where its "Modules:" line cannot be read.
export function places(p, { only = null, except = [] } = {}) {
  const facts = factsOf({ manifest: p.manifest, files: p.files, gameSlots: GAME_ROWS.map(([slot]) => slot) });
  const known = moduleNames(HERE), left = toPlace(p.manifest, known.filter(n => !except.includes(n)), facts, only, known);
  if (left === null) {
    const { line } = modulesOf(p.manifest);
    throw new Unread(line ? `the "Modules:" line of \`${MANIFEST}\` ("${line.slice(0, 120)}") is neither "all" nor a list of the core's modules, each by its name, parted by commas` : `\`${MANIFEST}\` has no "Modules:" line to read`);
  }
  return left;
}
export const named = list => list.map(p => `\`${shown(p.name)}\``).join(", ");
// A step's check: null where it places nothing; else its mend, which `node core/scripts/steps.mjs --write` makes.
export const placing = opts => p => {
  const left = places(p, opts);
  if (!left.length) return null;
  const take = left.filter(l => l.take && !l.choice), out = left.filter(l => !l.take), chosen = left.filter(l => l.choice);
  return [`In one small pull request, place in \`${MANIFEST}\` each module its "Modules:" list neither takes nor leaves out, as \`node core/scripts/steps.mjs --write\` writes them:`,
    take.length && `add ${named(take)} to the "Modules:" list, which what the project holds calls for (${take.map(l => `${l.name}: ${l.why}`).join("; ")});`,
    out.length && `add ${out.map(l => `\`${l.name}\` (${l.why})`).join(", ")} to the line "Not taken:";`,
    chosen.length && `add ${named(chosen)} to the "Modules:" list, as the starter kit takes them, and to the line "${CONFIRM}", which asks the owner once whether each fits.`]
    .filter(Boolean).join(" ");
};
// The confirmation's check: null where the manifest has no line "Modules to confirm:" or it names none.
export const confirmed = p => {
  const asked = [...toConfirm(p.manifest)].sort();
  return !asked.length ? null : `The owner confirms that ${asked.map(n => `\`${shown(n)}\``).join(", ")}, taken as the starter kit takes them, fit the project; meanwhile each binds, and nothing waits. Then, in one small pull request, a session moves each the owner leaves out from the "Modules:" list of \`${MANIFEST}\` to its line "Not taken:" with the owner's reason, and takes the line "${CONFIRM}" out.`;
};
