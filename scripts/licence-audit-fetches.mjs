// An audit entry's "fetches" (#1495), for the licence scan (licence-scan.mjs, beside this file): a map from a tracked
// file's path to the lines of the fetches the entry audits there, each as the scan prints it (its whitespace
// collapsed) and each standing for one fetch word for word, so that any other fetch in that file is read as in any
// other file. Here: what fails in the map itself, the fetches no entry names, and the lines named that no fetch matches.

/** Whether the entry `e`'s "fetches" is there and not a map of paths to lists of lines. */
export const badFetches = (e) => e.fetches !== undefined && (!e.fetches || typeof e.fetches !== "object" || Array.isArray(e.fetches)
  || Object.entries(e.fetches).some(([f, lines]) => !f || !Array.isArray(lines) || !lines.length || lines.some((l) => typeof l !== "string" || !l.trim())));
/** The lines the entry `e` names in its "fetches" for the file `f`, as the scan prints them; none of the owner's own. */
export const fetchesIn = (e, f) => (e && typeof e === "object" && e.kind !== "own" && !badFetches(e) && Object.hasOwn(e.fetches ?? {}, f) ? e.fetches[f].map((l) => l.replace(/\s+/gu, " ").trim()) : []);
/** Whether an entry of `entries` names a fetch of the file `f`. */
export const namesFetches = (entries, f) => entries.some((e) => fetchesIn(e, f).length);
/** How a fetch of the file `f` that no entry of `entries` audits is mended: by its line in the "fetches" an entry names
 *  for `f`, where one does, so that the file stays read; else by the file in an entry's "files". */
export const auditMend = (entries, f) => (namesFetches(entries, f) ? `add its line, whitespace collapsed, to the "fetches" for ${f} of the entry that audits it` : `name ${f} in the "files" of the entry that audits it`);

/** Of the fetches `found` in the file `f`, those no entry of `entries` names in its "fetches" there (`left`), each line
 *  it names standing for one; and `stale`, the lines named there that no fetch of `f` matches. */
export const audited = (entries, f, found) => takeEach(found, entries.flatMap((e) => fetchesIn(e, f)));

/** Of the lines `found`, those `named` does not hold (`left`), each line of `named` taking one; and `stale`, those of
 *  `named` left over. The scan takes what stood at the base so too. */
export function takeEach(found, named) {
  const rest = [...named];
  const left = found.filter((line) => { const i = rest.indexOf(line); if (i < 0) return true; rest.splice(i, 1); return false; });
  return { left, stale: rest };
}
/** A fetch's line as a failure shows it, cut to 80 characters. */
export const shown = (line) => (line.length > 80 ? `${line.slice(0, 79)}…` : line);
export const unnamed = (entries, f, found) => audited(entries, f, found).left;

/** The fetches `found` in the file `f` that no entry of the scan `c` names, each line named there that no fetch
 *  matches failing, saying its mend. */
export function fetchesLeft(c, f, found) {
  const { left, stale } = audited(c.entries, f, found);
  for (const line of stale) c.fail(`${c.auditPath}: "fetches" names, for ${f}, ${shown(line)}, which is no fetch the scan reads there. Mend: write it as the scan prints that fetch, or take it out where the fetch is gone`);
  return left;
}

/** What fails in the audit entry `e`'s "fetches" in the scan `c`; false where it cannot be read at all. */
export function fetchesHeld(c, e) {
  const { auditPath, fail } = c;
  if (badFetches(e)) { fail(`${auditPath}: ${e.name}: "fetches" is not a map of paths to the fetches it audits there. Mend: write it as { "<a file's path>": ["<a fetch's line, as the scan prints it>"] }`); return false; }
  if (e.fetches && e.kind === "own") fail(`${auditPath}: ${e.name}: the owner's own work audits no fetch. Mend: take "fetches" out, and audit what it fetches in an entry of its own`);
  for (const p of Object.keys(e.fetches ?? {})) if (!c.tracked.includes(p)) fail(`${auditPath}: ${e.name}: "fetches" names ${p}, no tracked file. Mend: correct the path, or take it out`);
  return true;
}
