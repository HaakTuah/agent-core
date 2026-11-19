// A rule's reasons in one step (#756, point 2): given a rule of the floor, the modules or AGENTS.md, by its file and
// bold lead as holders.json, beside this file, names it (or a part of that, any case), it prints the core archive's
// items listed behind it under "behind", each with its date, its issues and its reasoning, and the items behind its
// file's text as a whole; the issues' addresses, to read with them; and the outcome its number stands for ("numbers").
// A session reads it before it questions a rule of the core or proposes a difference from one (tasks/updates.md, "A
// question or difference about a rule of the core starts from its reasons"). It reads the list as holders.mjs reads it
// and the archive as archive.mjs does, both beside this file, so it runs the same from a project's copy, the paths it
// prints under the copy. Reads only; Node's own modules.
//
//   node scripts/reasons.mjs "<the rule's file and lead, or a part of it>"
//   node core/scripts/reasons.mjs "<...>"                               in a project, from its copy
import path from "node:path";
import { items } from "./archive.mjs";
import { CORE } from "./core-address.mjs";
import { named } from "./holders.mjs";
import { ROOT, rules } from "./rules.mjs";
import { started } from "./started.mjs";

const ISSUE = /#(\d+)\b/gu;

// One item of the archive as it is printed: { key, date, file, text, issues }, or null where it is not there.
function itemOf(reasons, key) {
  const it = reasons.get(key);
  if (!it) return null;
  const text = it.text.replace(/\s+/gu, " ").trim().replace(/^(?:\d+|#\d+(?:\.\d+)?)\. /u, "");
  const date = /^\*\*([^*]+)\*\*/u.exec(text)?.[1] ?? null;
  return { key, date, file: it.file, text: date ? text.slice(date.length + 4).replace(/^[\s,.]+/u, "") : text, issues: [...new Set([...text.matchAll(ISSUE)].map(m => Number(m[1])))] };
}

// The rule a query names, as the rules and the list hold it: { rule, file, number, items, fileItems, missing }, or
// { matches } where none or several do (several: the keys, for the session to give more of the one it means).
export function reasonsOf(root, query) {
  const read = named(root), keys = [...new Set([...rules(root, { agents: true }).map(r => r.key), ...Object.keys(read.behind)])];
  const q = String(query ?? "").replace(/\s+/gu, " ").trim().toLowerCase();
  const exact = keys.filter(k => k.toLowerCase() === q), matches = exact.length ? exact : q ? keys.filter(k => k.toLowerCase().includes(q)) : [];
  if (matches.length !== 1) return { matches };
  const rule = matches[0], file = rule.includes(": ") ? rule.slice(0, rule.indexOf(": ")) : rule, { reasons } = items(root);
  const list = key => (read.behind[key] ?? []).map(k => itemOf(reasons, k) ?? { key: k, missing: true });
  return { rule, file, number: read.numbers[rule] ?? null, items: list(rule), fileItems: file === rule ? [] : list(file), wrong: read.wrong ?? null };
}

// The lines it prints for what reasonsOf() gave, the paths as seen from `cwd`.
export function lines(found, root = ROOT, cwd = process.cwd()) {
  // (relative where it lies under `cwd`, as a project's root holds its copy; whole elsewhere)
  const where = f => { const at = path.join(root, f), rel = path.relative(cwd, at); return (rel.startsWith("..") || path.isAbsolute(rel) ? at : rel).replace(/\\/gu, "/"); };
  const outcome = found.number ? /outcome: (\w+)/u.exec(found.number)?.[1] : null;
  const each = list => list.map(it => it.missing ? `- Core archive ${it.key}: not in the archive (holders.mjs fails it).` : `- Core archive ${it.key}${it.date ? `, ${it.date}` : ""} (${where(it.file)}): ${it.text}`);
  const issues = [...new Set([...found.items, ...found.fileItems].flatMap(it => it.issues ?? []))].sort((a, b) => a - b);
  return [
    found.rule,
    found.number ? `Its number: ${found.number}${outcome ? `; the outcome it stands for: ${outcome}` : ""}.` : "Its number: none named in holders.json yet.",
    found.items.length ? `Behind it, ${found.items.length} item${found.items.length === 1 ? "" : "s"} of the core's archive:` : "Behind it: no item of the archive is listed yet.",
    ...each(found.items),
    ...(found.fileItems.length ? [`Behind ${found.file}'s text as a whole:`, ...each(found.fileItems)] : []),
    ...(issues.length ? ["Read each issue the items name too, all public, where the owner's word and the discussion stand:", ...issues.map(n => `- https://github.com/${CORE}/issues/${n}`)] : []),
  ];
}

if (started(import.meta.url)) {
  const query = process.argv.slice(2).join(" ");
  const found = reasonsOf(ROOT, query);
  if (found.matches) {
    const run = `node ${path.relative(process.cwd(), path.join(ROOT, "scripts/reasons.mjs")).replace(/\\/gu, "/")}`;
    if (!found.matches.length) console.log(`FAIL no rule of the floor, the modules or AGENTS.md is named "${query}". Mend: give the rule's file and bold lead as a rule file holds it, or a part of it, in quotes, as \`${run} "security.md: 3. The protected files"\``);
    else console.log([`FAIL "${query}" names ${found.matches.length} rules. Mend: give more of the one you mean, in quotes, as one of these:`, ...found.matches.map(k => `  ${k}`)].join("\n"));
    process.exitCode = 1;
  } else {
    if (found.wrong) console.log(`FAIL ${found.wrong}`);
    console.log(lines(found).join("\n"));
  }
}
