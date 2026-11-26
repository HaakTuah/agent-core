// The lookup's part for PyPI (#716; lookup.mjs, beside this file, runs it): a requirements file in PyPI's lock form,
// each package at one exact version (==) with the hashes of its files, as `pip-compile --generate-hashes` and `uv pip
// compile --generate-hashes` write one, read to packages; and what PyPI says of each new one. A file of the licence
// check's config under "pypi" is read so: a line in any other form (a range, an address, a package with no hash, an
// include, an index that is not PyPI's) fails it whole, since pip or uv would install what the lookup did not read.
// Which package another brings, and which the project names, is read from the "# via" lines those tools write; a file
// with none names every package itself, and says nothing of what each brings. Names are compared as pip compares them
// (PEP 503: in lower case, each run of "-", "_" and "." one "-"). What PyPI answers is a publisher's text: it is said
// on one line by the lookup's report, and an answer of another shape is a lookup that failed. The reader of a
// repository's address is the lookup's own, passed in (`readRepo`), so neither file imports the other.

import { normal } from "./pypi-name.mjs";
import { reach } from "./reach.mjs";

const PYPI = "https://pypi.org/";
// (a name as PyPI gives one, PEP 508's, and a version as PEP 440 writes one exactly: never a wildcard or a range)
const IDENTIFIER = "[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?";
const NAME = new RegExp(`^${IDENTIFIER}$`, "u");
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+!_-]{0,63}$/u;
// (a requirement as pip reads one to a name and a version: its extras PEP 508's names, so nothing a path could hold, and
// after a ";" a marker, which only decides whether it is installed)
const PINNED = new RegExp(`^(${IDENTIFIER}) *(?:\\[ *(?:${IDENTIFIER}(?: *, *${IDENTIFIER})*)? *\\])? *== *([^ ;]+) *(?:;.*)?$`, "u");
// (a hash as pip checks one, glued to its option as pip-compile and uv write it)
const HASH = /^--hash=(?:sha256:[0-9a-f]{64}|sha384:[0-9a-f]{96}|sha512:[0-9a-f]{128})$/u;
// (the options a file may name that change neither what is installed nor where from; PyPI's own index alone; a value
// glued by "=" to a long option alone, as optparse reads "-i=…" as an index named "=…")
const HARMLESS = /^(?:--require-hashes|--prefer-binary|--pre|--(?:only|no)-binary(?:=| )[\w.:,][\w.:,-]*|(?:-i |--index-url(?:=| ))https:\/\/pypi\.org\/simple\/?)$/u;
const MOST_OWNERS = 5;
const WRITE = "write the file anew with pip-compile --generate-hashes (or uv pip compile --generate-hashes), each package at one exact version with its hashes, never by hand";
const object = (x) => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const when = (text) => (typeof text === "string" && /^\d{4}-\d\d-\d\dT/u.test(text) ? Date.parse(text) : NaN);

/** The packages of a requirements file's text in PyPI's lock form: each { name, version, path, direct, brings, by, pypi }. */
export function pypiPackages(text, lockPath) {
  asciiOnly(text, lockPath);
  const entries = [];
  let via = null;
  for (const [n, line] of logical(text, lockPath)) {
    const refuse = (what, mend = WRITE) => { throw new Error(`${lockPath}, line ${n}: ${what}, so it is not PyPI's lock form. Mend: ${mend}`); };
    if (line.startsWith("#")) { via = viaLine(line, entries.at(-1) ?? null, via); continue; }
    via = null;
    const entry = lineOf(line.replace(/\s+#.*$/u, ""), refuse);
    if (entry) entries.push(entry);
  }
  return graphed(entries);
}

// pip reads a file in the encoding a byte-order mark or its first two lines declare ("# coding: …", PEP 263's form),
// else in the system's own, where this reader reads UTF-8: where they differ, a byte can end a line for pip alone (in
// Latin-1, the last byte of some letters of UTF-8). Printable ASCII, a tab and a line's end read the same in each
// encoding a system uses, so a file of these alone, after a mark of UTF-8 and declaring no encoding but UTF-8 or ASCII,
// is read as pip reads it; any other character fails it, a byte that is not UTF-8 (read as U+FFFD), a NUL, a mark of
// UTF-16 or UTF-32 and each separator of lines but LF and CR among them.
const UTF8 = new Set(["utf_8", "utf8", "u8", "utf", "ascii", "us_ascii"]);
function asciiOnly(text, lockPath) {
  const mend = `write the file in ASCII alone, declaring no other encoding, and ${WRITE}`;
  const bad = text.replace(/^\uFEFF/u, " ").search(/[^\t\n\r\x20-\x7e]/u);
  if (bad >= 0) throw new Error(`${lockPath}, line ${text.slice(0, bad).split(/\r\n|[\n\r]/u).length}: a character other than printable ASCII, a tab or a line's end, so it is not PyPI's lock form. Mend: ${mend}`);
  text.split("\n").slice(0, 2).forEach((line, i) => {
    const declared = line.startsWith("#") && /coding[:=]\s*([-\w.]+)/u.exec(line)?.[1].toLowerCase().replace(/[^a-z0-9.]+/gu, "_");
    if (declared && !UTF8.has(declared)) throw new Error(`${lockPath}, line ${i + 1}: an encoding other than UTF-8 declared, so it is not PyPI's lock form. Mend: ${mend}`);
  });
}

// Each logical line, trimmed, with the number of its first, as pip's join_lines reads them: a line ending in "\\" runs
// on into the next, but a comment line never does, and one ends a line that ran on into it, joined after a space. A
// line runs on only as pip-compile and uv write one, after a space, with no "#" and no other "\\" in it, where uv joins
// it as pip does; any other (a word split across two lines, a comment after the hashes that ends in "\\") fails the
// file, since uv, which installs the same file, reads a package there that pip and the lookup do not.
function* logical(text, lockPath) {
  // (as Python's str.splitlines() splits a file of ASCII alone, as pip does: a lone carriage return ends a line too)
  const lines = text.replace(/^\uFEFF/u, "").split(/\r\n|[\n\r]/u);
  let joined = null, first = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], comment = /^\s*#/u.test(line);
    if (line.endsWith("\\") && !comment) {
      if (!/^[^#\\]* \\$/u.test(line)) throw new Error(`${lockPath}, line ${i + 1}: a line that runs on into the next otherwise than after a space, or with a "#" in it, which uv reads otherwise than pip, so it is not PyPI's lock form. Mend: ${WRITE}`);
      if (joined === null) { joined = ""; first = i + 1; }
      joined += line.slice(0, -1);
      continue;
    }
    yield joined === null ? [i + 1, line.trim()] : [first, `${joined}${comment ? " " : ""}${line}`.trim()];
    joined = null;
  }
  if (joined !== null) yield [first, joined.trim()];
}

// The entry a comment's "# via" names go to, if any: "# via a, b" after an entry, or "# via" then a line "#   a" for
// each; any other comment ends the list.
function viaLine(line, last, via) {
  const head = /^#\s*via\b(.*)$/u.exec(line), item = /^#\s{2,}(\S.*)$/u.exec(line);
  const to = head ? last : item ? via : null;
  to?.via.push(...(head ?? item)[1].split(/[\s,]+/u).filter(Boolean));
  return to;
}

// A line, its comment taken off, read as pip reads one: split at each single space, its options from the first word
// that starts with "-" on (break_args_options), so that a line of options alone changes nothing the lookup reads, and
// any other names one package. No character pip reads otherwise passes: a "$" ("${NAME}" is a variable of the
// environment to pip) and a tab (where shlex splits the options and pip's split does not) fail it.
function lineOf(bare, refuse) {
  if (/[^\x20-\x7e]|\$/u.test(bare)) refuse('a "$" or a tab outside a comment, which pip reads otherwise than the lookup');
  const words = bare.split(" "), at = words.findIndex((w) => w.startsWith("-"));
  const args = (at < 0 ? words : words.slice(0, at)).join(" ").trim(), options = at < 0 ? [] : words.slice(at).filter(Boolean);
  if (args) return entryOf(args, options, refuse);
  if (options.length && !HARMLESS.test(options.join(" "))) refuse("an option the lookup does not read (an include, an address, or an index other than PyPI's own)", `name each file in "pypi" of the config itself, take packages from PyPI's own index alone, and ${WRITE}`);
  return null;
}

// The package a requirement names at one exact version, its options the hashes of its files alone, or the file refused.
// The version is PEP 440's with no local part ("+…"), which PyPI never holds and which can end as an archive's name
// does ("1.0+x.zip"), a file pip installs in place of the package.
function entryOf(args, options, refuse) {
  const [, name, version] = PINNED.exec(args) ?? [];
  if (!name || !VERSION.test(version) || !pep440(version) || version.includes("+")) refuse("a package not at one exact version from PyPI (name==version)");
  if (!options.length || !options.every((o) => HASH.test(o))) refuse(`${name} names no hash of its files that pip checks, or an option beside them`);
  return { name: normal(name), version, via: [] };
}

// Each entry as the lookup reads it. One with no "# via" line, or whose line names anything but a package of the file
// (the project's own file, "-r requirements.in", "(pyproject.toml)"), is named by the project; the packages a line
// names bring it. A file with no "# via" line at all says nothing of what each brings.
function graphed(entries) {
  const any = entries.some((e) => e.via.length), names = new Set(entries.map((e) => e.name));
  const parents = (e) => e.via.map((v) => normal(v.replace(/\[.*$/u, ""))).filter((v) => names.has(v));
  const direct = (e) => !any || parents(e).length < e.via.length || !e.via.length;
  const children = new Map(), byName = new Map(entries.map((e) => [e.name, e]));
  for (const e of entries) for (const p of parents(e)) children.set(p, (children.get(p) ?? new Set()).add(e.name));
  return entries.map((e) => ({ name: e.name, version: e.version, path: e.name, direct: direct(e), pypi: true,
    get brings() { return any ? reach(e.name, (x) => children.get(x) ?? []).size : null; },
    get by() { return direct(e) ? [] : [...reach(e.name, (x) => parents(byName.get(x)))].filter((x) => direct(byName.get(x))); } }));
}

/** What PyPI says of the package `p` ({ name, version }), asked with `get(url)` ({ status, json }): its facts, or
 *  { missing } where PyPI has no such package or version. */
export async function pypiRegistry(p, get, readRepo) {
  if (!NAME.test(p.name) || !VERSION.test(p.version)) throw new Error("its name or version is not one PyPI gives");
  const name = normal(p.name);
  const r = await get(`${PYPI}pypi/${name}/json`);
  if (r.status === 404) return { missing: "the registry answers that it knows no such name" };
  if (r.status !== 200) throw new Error(`it answered ${r.status}`);
  const facts = pypiFacts(r.json, p.version, readRepo);
  if (facts.missing) return facts;
  facts.provenance = await provenance(name, facts, get);
  return facts;
}

// A version as PEP 440 compares it: the release's trailing zeros left out and each spelling in its one form, so "1.0",
// "v1.0.0" and "1.0.0" meet, as do "1.0-1" and "1.0.post1"; null where it is in no form of PEP 440's.
const PEP440 = /^v?(?:(\d+)!)?(\d+(?:\.\d+)*)(?:[-_.]?(alpha|a|beta|b|preview|pre|c|rc)[-_.]?(\d+)?)?(?:-(\d+)|[-_.]?(post|rev|r)[-_.]?(\d+)?)?(?:[-_.]?(dev)[-_.]?(\d+)?)?(?:\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?$/u;
const int = (n) => (n ?? "0").replace(/^0+(?=\d)/u, "");
export function pep440(version) {
  const m = version.length <= 64 ? PEP440.exec(version.trim().toLowerCase()) : null;
  if (!m) return null;
  const [, epoch, release, pre, preN, postN, post, postM, dev, devN, local] = m;
  return [`${int(epoch)}!`, release.split(".").map(int).join(".").replace(/(?:\.0)+$/u, ""),
    pre ? `${{ alpha: "a", a: "a", beta: "b", b: "b" }[pre] ?? "rc"}${int(preN)}` : "",
    postN !== undefined || post ? `.post${int(postN ?? postM)}` : "", dev ? `.dev${int(devN)}` : "",
    local ? `+${local.split(/[-_.]/u).map((x) => (/^\d+$/u.test(x) ? int(x) : x)).join(".")}` : ""].join("");
}

/** What PyPI's answer `doc` (its JSON of a project) says of the package at `version`: { first, last, repo, publisher,
 *  note, file } or { missing }. */
export function pypiFacts(doc, version, readRepo) {
  if (!object(doc) || !object(doc.releases)) throw new Error("its answer is no JSON object that lists releases");
  const releases = doc.releases;
  const files = (v) => (Array.isArray(releases[v]) ? releases[v].filter(object) : []);
  const all = Object.keys(releases).flatMap((v) => files(v).map((f) => ({ at: when(f.upload_time_iso_8601), yanked: f.yanked === true }))).filter((f) => !Number.isNaN(f.at));
  if (!all.length) return { missing: "the registry knows the name, and holds no file of it" };
  // (a version as written in the lock file, else the one PyPI keys that PEP 440 holds equal to it)
  const asked = pep440(version);
  const key = Object.hasOwn(releases, version) ? version : Object.keys(releases).find((v) => (asked ? pep440(v) === asked : v.toLowerCase() === version.toLowerCase()));
  const own = key ? files(key) : [];
  if (!own.length) return { missing: `the registry knows the name, and no file of version ${version.slice(0, 64)} of it` };
  const kept = all.filter((f) => !f.yanked), info = object(doc.info) ? doc.info : {};
  return { first: Math.min(...all.map((f) => f.at)), last: Math.max(...(kept.length ? kept : all).map((f) => f.at)), repo: repoOf(info, readRepo),
    publisher: publisher(doc.ownership, info), note: own.every((f) => f.yanked === true) ? "this version is yanked: PyPI asks that it not be installed" : "", version: key, file: fileOf(own) };
}

// The name of one file of the version that is not yanked, in the form PyPI gives, to ask its provenance of.
const fileOf = (own) => own.find((f) => !f.yanked && typeof f.filename === "string" && /^[A-Za-z0-9][\w.+!-]{0,250}$/u.test(f.filename))?.filename ?? null;

// The repository the project names: a GitHub address among its links, one named for its source first; else the first
// link named for its source; else none.
function repoOf(info, readRepo) {
  const links = [...Object.entries(object(info.project_urls) ? info.project_urls : {}), ["home page", info.home_page]]
    .filter(([, u]) => typeof u === "string" && u.length <= 300);
  const source = ([k]) => /source|repo|code|github/iu.test(k);
  const read = links.map(([k, u]) => [k, readRepo(u)]).filter(([, r]) => r);
  return read.find((e) => source(e) && e[1].owner)?.[1] ?? read.find(([, r]) => r.owner)?.[1] ?? read.find(source)?.[1] ?? null;
}

// Who publishes it: its owners as PyPI lists them, else its authors as the package writes them.
function publisher(ownership, info) {
  const roles = Array.isArray(ownership?.roles) ? ownership.roles.filter((r) => typeof r?.user === "string").map((r) => r.user) : [];
  const org = typeof ownership?.organization === "string" && ownership.organization ? `the organization ${ownership.organization}, ` : "";
  if (org || roles.length) return `${org}${roles.length ? `owners ${roles.slice(0, MOST_OWNERS).join(", ")}${roles.length > MOST_OWNERS ? ` and ${roles.length - MOST_OWNERS} more` : ""}` : "no owner listed"} (as PyPI lists them)`;
  const author = [info.author, info.maintainer].find((a) => typeof a === "string" && a);
  return author ? `${author} (as the package writes its authors)` : "not named";
}

// Whether one file of the version has an attestation (PEP 740), as PyPI's integrity interface gives it, and by whom: its
// address built here from the name, the version and the file's name, on PyPI alone (floor rule 5).
async function provenance(name, facts, get) {
  if (!facts.file) return "no file of this version to ask";
  const r = await get(`${PYPI}integrity/${name}/${encodeURIComponent(facts.version)}/${encodeURIComponent(facts.file)}/provenance`).catch(() => ({ status: 0 }));
  if (r.status === 404) return "no";
  const by = Array.isArray(r.json?.attestation_bundles) ? r.json.attestation_bundles.map((b) => b?.publisher).filter((x) => x && typeof x === "object") : null;
  if (r.status !== 200 || !by) return "PyPI did not answer";
  const text = (v) => (typeof v === "string" ? v : "");
  const from = by.map((x) => `${text(x.kind) || "a publisher"}${text(x.repository) && ` ${x.repository}`}${text(x.workflow) && ` (${x.workflow})`}`);
  const named = facts.repo?.owner && by.some((x) => typeof x.repository === "string" && x.repository.toLowerCase() === `${facts.repo.owner}/${facts.repo.name}`.toLowerCase());
  return `yes, from ${[...new Set(from)].join(", ") || "a publisher PyPI does not name"}${facts.repo?.owner ? `, ${named ? "the repository it names" : "not the repository it names"}` : ""}`;
}
