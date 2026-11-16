// The core's archive in its two forms (#252): each item's reasoning, in the core's words, in archive/instructions/,
// which a project's copy carries and "core archive N" leads to; and, for the items written before 16 November 2026, the
// owner's words, in words/, which stays in the core's own repository (its .gitattributes line). An item is a line that
// opens with its number and a stop, at the start of a line, in a file named items-NNN.md. The two are in step where
// every item of the words has its reasoning under the same number, none past LAST_WORDS stands in the words, each
// form numbers each item once and in the file its number puts it in (#394), the reasoning from 1 with none left out, no reasoning item quotes (a line opening with ">"), each that has words says what was decided
// ("Decided:"), and each written since (point 6 of #252) names the issue that holds the owner's word ("#N").
// holders.mjs, beside this file, reads it for the items its list names and fails what inStep() finds. Node's own modules.
//
//   import { items, inStep } from "./archive.mjs";
import fs from "node:fs";
import path from "node:path";

export const REASONS = "archive/instructions";
export const WORDS = "words";
// The last item whose words stand in words/: from the next on, the words stay on the issue the item names.
export const LAST_WORDS = 245;
const FILE = /^items-\d+\.md$/u;
const OPENS = /^(\d+)\. /u;

// The items of one folder under `root`: a Map of number to { file, text }, in the order they stand, and where each
// number stands (`places`: number to its "file:line"s and files, in the order they stand, more than one where it stands
// twice).
export function itemsIn(root, folder) {
  const out = new Map(), places = new Map();
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) return { items: out, places };
  for (const f of fs.readdirSync(dir).filter(f => FILE.test(f)).sort()) {
    let at = null;
    for (const [i, line] of fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/gu, "\n").split("\n").entries()) {
      const m = OPENS.exec(line);
      if (m) {
        at = Number(m[1]);
        places.set(at, [...(places.get(at) ?? []), { file: `${folder}/${f}`, at: `${folder}/${f}:${i + 1}` }]);
        out.set(at, { file: `${folder}/${f}`, text: line });
      } else if (/^#/u.test(line)) at = null;
      else if (at !== null) out.get(at).text += `\n${line}`;
    }
  }
  return { items: out, places };
}

// The file an item's number puts it in: the one whose first number is the highest at or below it
// (`archive/instructions.md`).
function fileOf(root, folder, n) {
  const dir = path.join(root, folder);
  const firsts = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => FILE.test(f)).map(f => [Number(/\d+/u.exec(f)[0]), f]).sort((x, y) => x[0] - y[0]) : [];
  const f = firsts.filter(([first]) => first <= n).at(-1)?.[1];
  return f ? `${folder}/${f}` : undefined;
}

// Both forms: { reasons, words }, each a Map as itemsIn() gives it.
export function items(root) {
  return { reasons: itemsIn(root, REASONS).items, words: itemsIn(root, WORDS).items };
}

// An item numbered twice, or standing in a file its number does not put it in, each a line with its mend (#394):
// "core archive N" would lead to either, or the index to the wrong file. Of two, the one outside its number's file
// moves, since the index already leads to the other, else the later; it takes the next free number, at the end of the
// newest file, or in the words the number its reasoning has.
function outOfPlace(root, r, w) {
  const wrong = [], newest = fileOf(root, REASONS, Infinity);
  let next = Math.max(0, ...r.items.keys()); // (each item told to move takes a number of its own)
  const file = (folder, n) => fileOf(root, folder, n) ?? `no file of ${folder}/, since none starts at or below ${n}`;
  for (const [folder, form] of [[REASONS, r], [WORDS, w]]) for (const [n, at] of form.places) {
    const astray = at.filter(x => x.file !== fileOf(root, folder, n)), moves = astray.length && astray.length < at.length ? astray[0] : at.at(-1);
    const renumber = () => folder === REASONS ? `the next free number, ${++next}, at the end of ${newest}, and change each "core archive ${n}" that means it` : `the number its reasoning has in ${REASONS}/`;
    if (at.length > 1) wrong.push(`${folder}: item ${n} stands ${at.length === 2 ? "twice" : `${at.length} times`}, at ${at.map(x => x.at).join(" and ")}. Mend: give the one at ${moves.at} ${renumber()}`);
    else if (astray.length) wrong.push(`${at[0].at}: item ${n} stands outside ${file(folder, n)}, the file its number puts it in. Mend: move it there${folder === REASONS ? `, or give it ${renumber()}` : ""}`);
  }
  return wrong;
}

// What keeps the two forms out of step, each a line with its mend: an empty list where they are in step.
export function inStep(root) {
  const r = itemsIn(root, REASONS), w = itemsIn(root, WORDS), wrong = [];
  wrong.push(...outOfPlace(root, r, w));
  for (const [n, it] of w.items) if (n > LAST_WORDS) wrong.push(`${it.file}: item ${n} adds the owner's words here, where nothing is added after item ${LAST_WORDS}. Mend: take it out of ${WORDS}/ and write it in ${REASONS}/ alone, naming the issue that holds the words`);
  for (const [n, it] of w.items) if (!r.items.has(n)) wrong.push(`${it.file}: item ${n} has no reasoning under its number in ${REASONS}/. Mend: write it there, in the core's words, with what was asked, what was decided and what it stands behind (\`archive/instructions.md\`)`);
  const last = Math.max(0, ...r.items.keys());
  for (let n = 1; n <= last; n++) if (!r.items.has(n)) wrong.push(`${REASONS}: item ${n} is missing, though item ${last} stands. Mend: number the items from 1 with none left out, a new one after the last`);
  for (const [n, it] of r.items) {
    if (/^\s*>/mu.test(it.text)) wrong.push(`${it.file}: item ${n} quotes (a line opening with ">"). Mend: say in the core's own words what was decided; the owner's words stay on the issue, or in ${WORDS}/`);
    if (w.items.has(n) && !/\bDecided:/u.test(it.text)) wrong.push(`${it.file}: item ${n} does not say what was decided. Mend: add "Decided:" and what the owner decided, in plain words`);
    if (!w.items.has(n) && !/#\d+/u.test(it.text)) wrong.push(`${it.file}: item ${n} names no issue. Mend: name the issue that holds the owner's word ("#N"), as \`archive/instructions.md\` says a new item does`);
  }
  return wrong;
}
