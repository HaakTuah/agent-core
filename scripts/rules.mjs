// The rules of the floor and the modules, as a machine reads them (AGENTS.md, "Every rule says what holds it"; #235,
// part D): each paragraph or item of a list in floor/*.md and modules/*.md whose text opens with a bold lead is a rule,
// named by its file and that lead ("floor/security.md: 1. Nothing secret in the repository"). Its text runs to the next
// rule at its own depth or above, a heading, or a line that leaves its item, so an item's own items are part of it as
// well as rules of their own. What holds each is named in holders.json, beside this file (holders.mjs); a staged case
// names the rules it holds (staged/, staged.mjs). Node's own modules only.
//
//   import { rules, ruleKey } from "./rules.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FOLDERS = ["floor", "modules"];

// A line that opens a rule: its depth (the spaces before its marker, or -1 for a paragraph) and its lead.
const OPENS = /^( *)(?:(?:[-*]|\d+\.) +)?\*\*(.+?)\*\*/u;
const ITEM = /^( *)(?:[-*]|\d+\.) /u;

// The lead as a rule is named by it: the bold text, its closing stop, colon or comma left out.
export const leadOf = bold => bold.replace(/\s+/gu, " ").trim().replace(/[.:,;]+$/u, "").trim();

export const ruleKey = (file, lead) => `${file}: ${lead}`;

// The rules of one file's text: [{ file, lead, key, text }], in the order they stand.
export function rulesOf(file, text) {
  const lines = String(text).replace(/\r\n/gu, "\n").split("\n");
  const out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^ *```/u.test(lines[i])) fence = !fence;
    if (fence) continue;
    const m = OPENS.exec(lines[i]);
    if (!m) continue;
    const listed = ITEM.test(lines[i]);
    const depth = listed ? m[1].length : -1;
    // (a bold word inside a paragraph's running text opens nothing: only one at a line's start, after its marker)
    if (!listed && m[1].length) continue;
    let end = i + 1;
    for (; end < lines.length; end++) {
      const l = lines[end];
      if (/^#/u.test(l)) break;
      // (a paragraph's rule runs to the next paragraph that opens one; an item's, to the next line not indented under it)
      if (depth < 0) { if (/^\*\*/u.test(l)) break; continue; }
      const next = l.trim() ? l : lines.slice(end + 1).find(x => x.trim());
      if (next === undefined || /^ */u.exec(next)[0].length <= depth) break;
    }
    const lead = leadOf(m[2]);
    out.push({ file, lead, key: ruleKey(file, lead), text: lines.slice(i, end).join("\n").trimEnd() });
  }
  return out;
}

// Every rule of the floor and the modules under `root` (the core's own, by default); with `agents`, the core's own
// rules in its AGENTS.md as well, which a staged case may hold.
export function rules(root = ROOT, { agents = false } = {}) {
  const out = [];
  if (agents && fs.existsSync(path.join(root, "AGENTS.md"))) out.push(...rulesOf("AGENTS.md", fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")));
  for (const folder of FOLDERS) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort()) out.push(...rulesOf(`${folder}/${f}`, fs.readFileSync(path.join(dir, f), "utf8")));
  }
  return out;
}

// A short fingerprint of a rule's text, which changes when any word of it does: what a staged case's run records, so
// that a change to a rule it holds makes the case due again.
export const fingerprint = text => crypto.createHash("sha256").update(String(text).replace(/\s+/gu, " ").trim()).digest("hex").slice(0, 12);
