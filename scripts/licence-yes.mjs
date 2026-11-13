// The owner's yes (floor rule 10, in floor/topics.md beside this folder: "one the owner wants anyway waits for the
// owner's yes"), for the licence check (licences.mjs, beside this file) and the NuGet check (nuget.mjs): how a config
// names what is off its list and accepted all the same, and what no yes takes in. A package is named with its one
// exact version, as { "package": "<name>@<version>", "licence": what it is under (an SPDX expression of ids the
// licence check knows, or LicenseRef-<a name for it>, as LicenseRef-Vendor-EULA for one that was bought, so that a
// machine can read it), "ships": true or false, "yes": the owner's words and their date, "notice": its notice, where
// it ships }; in the licence check's "accepted" an audit entry (a font, an image, a tool a script installs) is named
// as { "entry": its name in the audit, "yes": ... }, its licence, "ships" and notice being the entry's own. A yes for
// one version is no yes for the next, a yes for a tool none for what ships, and none takes in terms the floor never
// allows (non-commercial, no-derivatives, source-available); each check fails one that nothing needs any more, so a
// list only shrinks by itself. Whether the owner said what a "yes" quotes, the reviews hold, the config being a
// protected file. Node's own modules only; it reads no file.

/**
 * A list of what the owner accepted off a list (this config's "accepted", the NuGet check's "nuget.accepted"),
 * checked: `key` is its name in the config, `named` what a package's "<name>@<version>" looks like there, `shape` the
 * words for it, and `same` what makes two names one. With `entries`, an item may name an audit entry instead. A key or
 * a shape it does not know would check less without a word.
 */
export function acceptedList(list = [], key, named, shape, { entries = false, same = (name) => name } = {}) {
  const text = (v) => typeof v === "string" && v.trim() !== "";
  const only = (a, keys) => Object.keys(a).every((k) => keys.includes(k));
  const whole = (a) => a && typeof a === "object" && !Array.isArray(a) && text(a.yes) && (a.package !== undefined
    ? only(a, ["package", "licence", "ships", "yes", "notice"]) && text(a.package) && named.test(a.package) && text(a.licence)
      && typeof a.ships === "boolean" && (a.notice === undefined || typeof a.notice === "string")
    : entries && only(a, ["entry", "yes"]) && text(a.entry));
  if (!Array.isArray(list) || !list.every(whole)) throw new Error(`the config's "${key}" is not a list of { "package": "${shape}", "licence": ..., "ships": true or false, "yes": ..., and "notice" where it ships }${entries ? ', or { "entry": an audit entry\'s name, "yes": ... }' : ""}`);
  const names = list.map((a) => (a.package !== undefined ? `package ${same(a.package)}` : `entry ${a.entry}`));
  const again = names.filter((n, i) => names.indexOf(n) !== i);
  if (again.length) throw new Error(`the config's "${key}" names one twice: ${[...new Set(again)].join(", ")}`);
  return list;
}

/**
 * What stands against an owner's yes for `name`, which is off its list: the lines that fail it. `a` is what is
 * accepted ({ licence, ships, notice }), `shipped` whether it is held as what ships, `others` what else names its
 * licence (a lockfile, a manifest, an audit entry), `lists` the licence check's `policy`, and `where` the place its notice
 * stands, or null where another rule holds the notice.
 */
export function yesFaults(name, a, shipped, others, lists, where) {
  // (named so that a machine can read it: ids this check knows, or LicenseRef-<name>; after WITH, an exception's id)
  const ids = new Set([...lists.tools, ...lists.allowedFor("", true, "data"), ...lists.allowedFor("", true, "font")]);
  const words = typeof a.licence === "string" ? a.licence.match(/\(|\)|[^\s()]+/gu) ?? [] : [];
  const readable = words.length > 0 && words.every((w, i) => ["(", ")", "AND", "OR", "WITH"].includes(w) || ids.has(w) || /^LicenseRef-[A-Za-z0-9.-]+$/u.test(w) || (words[i - 1] === "WITH" && /^[A-Za-z0-9.-]+$/u.test(w)));
  const never = [a.licence, ...others].filter((l) => typeof l === "string" && lists.never.test(l));
  const faults = [];
  if (never.length) faults.push(`${name}: accepted, and under ${never[0]}, terms floor rule 10 never allows`);
  if (!readable) faults.push(`${name}: accepted under "${a.licence}", which no machine can read: name it by an SPDX id this check knows, or as LicenseRef-<a name for it>, as LicenseRef-Vendor-EULA for one that was bought`);
  if (shipped && a.ships !== true) faults.push(`${name}: accepted as a tool that only runs ("ships": false), and it is held as what ships: a yes for a tool is no yes for what ships (floor rule 10)`);
  if (where && shipped && !a.notice?.trim()) faults.push(`${name}: it ships, so its notice ships too (floor rule 10): its "notice" in ${where}`);
  return faults;
}
