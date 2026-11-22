// What the core owns of a project's files, and how the one process takes each (#1083; converge.mjs, init.mjs): the
// marks that say a file or a part of one is the core's, the kinds of file, and, of one file, what the process makes of
// what stands. No file is read or written here. Node's own language only.

// The first line of each workflow and Dependabot config the kit writes, which says the file is the core's, and the two
// lines that hold the core's part of a rule file of the project's own (AGENTS.md, CLAUDE.md), as their templates write them.
// (the part's marks name no path: a project whose copy stands elsewhere has each core/ in the kit's text written as its
// copy's path, and the marks are read word for word; the workflows' mark is read by its opening alone; the opening
// mark holds fewer words than the copies check's window of twelve, so the two rule files that hold it hold no copy)
export const MARK = "# The core's file: core/scripts/converge.mjs writes it from the starter kit at each sync. To keep a change of the project's own, take this line out and name the file in core-manifest.md's \"Differences\".";
export const BEGIN = "<!-- The core's part: a sync writes it; write yours outside. -->";
export const END = "<!-- The core's part ends. -->";
export const marked = to => /^\.github\/(?:workflows\/[^/]+\.yml|dependabot\.yml)$/u.test(to);

// The kinds: the rule files the core holds a part of; the kit's files that are the project's own from its first
// commit, written only where they are not there; and the core's whole files, every other the kit writes.
export const BLOCKS = ["AGENTS.md", "CLAUDE.md"];
export const OWN = new Set(["core-manifest.md", "SECURITY.md", "docs/threat-model.md", "docs/PROGRESS.md", "docs/choices.md", "checks/copies.json", "checks/shape.json", "checks/licences-audit.json"]);
const WHOLE = [".github/dependabot.yml", ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md", ".claude/settings.json", ".codex/hooks.json", ".kiro/steering/core.md", ".kiro/hooks/work-saved.json", ".agents/rules/core.md"];
export const whole = to => /^\.github\/workflows\/[^/]+\.yml$/u.test(to) || WHOLE.includes(to);

export const lf = t => t.replace(/\r\n/gu, "\n");
// (a file as the comparison reads it: its line ends made one, the core's mark taken out and every pin made one, since
// the sync and Dependabot move pins)
const plainOf = t => lf(t).replace(/^# The core's file:[^\n]*\n/u, "").replace(/@[0-9a-f]{40}(\s*#\s*v?[\w.-]+)?/gu, "@<pin>");
export const blockOf = t => { const b = lf(t).indexOf(BEGIN), e = lf(t).indexOf(END); return b < 0 || e < b ? null : lf(t).slice(b, e + END.length); };
const imports = l => /^@\S+$/u.test(l);

// Where the core's part stands in a rule file's text: { at, end } (end past its last line, its line end kept outside),
// null where it has none, or "many" where it cannot be told which run of import lines it is. `kitLines` are the lines
// every kit's part holds.
export function partIn(text, kitLines) {
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b >= 0 && e > b && text.indexOf(BEGIN, b + 1) < 0) return { at: b, end: e + END.length };
  if (b >= 0 || e >= 0) return "many";
  const lines = text.split("\n"), runs = [];
  let offset = 0, run = null;
  lines.forEach((l, i) => {
    const bare = l.replace(/\r$/u, "");
    if (imports(bare)) { run ??= { at: offset, lines: [] }; run.lines.push(bare); run.end = offset + bare.length; } else if (run) { runs.push(run); run = null; }
    offset += l.length + (i < lines.length - 1 ? 1 : 0);
  });
  if (run) runs.push(run);
  const core = runs.filter(r => r.lines.every(l => kitLines.has(l)));
  return core.length === 1 ? core[0] : core.length ? "many" : null;
}

// One file after the process, from what stands, `now` (null where nothing does), the kit's text `want` and the earlier
// kits' (`older`): { text } to write, {} where it is left as it stands, and `left` where it is left as the project's.
export function converged(to, now, want, older = []) {
  if (now === null) return { text: want };
  if (BLOCKS.includes(to)) return partConverged(now, want, older);
  if (!whole(to)) return {};
  const core = (marked(to) && /^# The core's file:/u.test(now)) || [want, ...older].some(t => t && plainOf(t) === plainOf(now));
  if (!core) return { left: "is not the core's (no mark of the core's, and not what a starter kit writes for the project): left as it is" };
  return now === want ? {} : { text: want };
}

// Whether a whole file of the core's that the kit no longer writes, standing as `now`, is to be taken out: it carries
// the core's mark, or it is, but for its mark and its pins, what an earlier kit wrote (`older`); any other is the
// project's and stays.
export const dropped = (to, now, older) => whole(to) && ((marked(to) && /^# The core's file:/u.test(now)) || older.some(t => plainOf(t) === plainOf(now)));

// A rule file of the project's own after the process: its core's part written where it stands, or at its end.
function partConverged(now, want, older) {
  const part = blockOf(want);
  if (part === null) return {};
  const kitLines = new Set([want, ...older].flatMap(t => (blockOf(t) ?? t).split("\n").map(l => l.replace(/\r$/u, "")).filter(imports)));
  const at = partIn(now, kitLines);
  if (at === "many") return { left: "its part of the core cannot be told apart (the core's marks stand more than once or apart, or more than one run of import lines is the kit's): left as it is" };
  const eol = now.includes("\r\n") ? "\r\n" : "\n", block = part.replaceAll("\n", eol);
  const text = at === null ? `${now}${now.endsWith("\n") || now === "" ? "" : eol}${eol}${block}${eol}` : `${now.slice(0, at.at)}${block}${now.slice(at.end)}`;
  if (text === now) return {};
  // (a run of imports from before the marks that no kit wrote as it stands, one the project took an import out of or
  // reordered, is written as the kit writes it all the same, and named, so the change to its rule file is seen)
  const runOf = t => (blockOf(t) ?? t).split("\n").map(l => l.replace(/\r$/u, "")).filter(imports).join("\n");
  if (at?.lines && ![want, ...older].some(t => runOf(t) === at.lines.join("\n"))) return { text, left: "held a run of the kit's imports that no kit writes as it stood (one taken out or moved): the core's part is written over it as this kit writes it, so check that no import the project took out on purpose came back" };
  return { text };
}
