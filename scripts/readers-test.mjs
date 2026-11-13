// The core's hand-written readers, held to readers others wrote and many use (core archive 201): the SPDX expression
// readers (licenceOk in licences.mjs, readable in licence-yes.mjs) to SPDX's own parser, spdx-expression-parse, and the
// NuGet manifest reader (manifestLicence in nuget.mjs) to an XML parser, @xmldom/xmldom. Each reader may refuse more than
// its reference reads, for the reasons it states; none may read more, or read it otherwise. The references are pinned
// here, fetched with `npm pack` (which runs nothing it fetches), checked by their integrity before they are unpacked,
// and only run by this test: in the core's own tests workflow, never in a project, which runs none of the core's tests.
// Each case is made from a fixed seed, so a failure prints what reproduces it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readable } from "./licence-yes.mjs";
import { licenceOk } from "./licences.mjs";
import { manifestLicence } from "./nuget.mjs";

// what the call below fetches, each by its sha512 as the registry gives it (npm pack's array is the one place each
// version is named, which the licence scan reads, and .github/licences-audit.json audits at that version)
const INTEGRITY = {
  "spdx-expression-parse@4.0.0": "sha512-Clya5JIij/7C6bRR22+tnGXbc4VKlibKSVj2iHvVeX5iMW7s1SIQlqu699JkODJJIhh/pUu8L0/VLh8xflD+LQ==",
  "spdx-license-ids@3.0.24": "sha512-cLS9TtWkIQFyLkJ3/5aFQAOHOSKTlOs/7WDut/XPSdjom1fJhUdkepeJAKXa9Y05+FabHd0sti+Et559vDtkpQ==",
  "spdx-exceptions@2.5.0": "sha512-PiU42r+xO4UbUS1buo3LPJkjlO7430Xn5SVAhdpzzsPHsjbYVflnnFdATgabnLude+Cqu25p6N+g2lw/PFsa4w==",
  "@xmldom/xmldom@0.9.12": "sha512-5AXjrcMClTryPe9LgZrygpB1lj7s0S9E0+W+AHaVKAVyHanafK86iPSvG5xHVSp/jC+VH1UXu0TAEmY279xH7A==",
};
const CASES = 20000;

let failed = 0, passed = 0;
const ok = (cond, what, detail = "") => { if (cond) passed++; else failed++; console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond ? "" : `\n     ${detail}`}`); };

const dir = mkdtempSync(join(tmpdir(), "readers-"));
try {
  // the references: each tarball's sha512 is computed here, not taken from npm, and must be the pinned one
  const packs = join(dir, "packs");
  mkdirSync(packs);
  execFileSync("npm", ["pack", "--ignore-scripts", "--silent", "spdx-expression-parse@4.0.0", "spdx-license-ids@3.0.24", "spdx-exceptions@2.5.0", "@xmldom/xmldom@0.9.12"], { cwd: packs, stdio: ["ignore", "ignore", "inherit"] });
  const fetched = readdirSync(packs);
  if (fetched.length !== Object.keys(INTEGRITY).length) throw new Error(`fetched ${fetched.join(", ")}, not one of each that is pinned`);
  for (const [spec, integrity] of Object.entries(INTEGRITY)) {
    const [, name, version] = /^(.+)@([^@]+)$/u.exec(spec);
    const file = `${name.replace(/^@/u, "").replace("/", "-")}-${version}.tgz`;
    const got = fetched.includes(file) ? `sha512-${createHash("sha512").update(readFileSync(join(packs, file))).digest("base64")}` : undefined;
    if (got !== integrity) throw new Error(`${spec}: fetched ${got ?? "nothing"}, pinned ${integrity}`);
    const into = join(dir, "node_modules", name);
    mkdirSync(into, { recursive: true });
    execFileSync("tar", ["-xzf", join(packs, file), "-C", into, "--strip-components=1"]);
  }
  const require = createRequire(join(dir, "node_modules", "index.js"));
  const parse = require("spdx-expression-parse");
  const { DOMParser } = require("@xmldom/xmldom");
  console.log(`references fetched and checked: ${Object.keys(INTEGRITY).join(", ")}`);

  // a fixed sequence of numbers, so each run makes the same cases
  const prng = (seed) => (n) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % n; };

  // --- SPDX expressions ---
  const IDS = ["MIT", "ISC", "Apache-2.0", "GPL-2.0-only", "BSD-3-Clause", "LicenseRef-A"];
  const EXCEPTIONS = ["Classpath-exception-2.0", "LLVM-exception"];
  const WORDS = [...IDS, ...EXCEPTIONS, "(", ")", "AND", "OR", "WITH", "and", "or", "With", "+", "MIT+", "Some-Words", "LicenseRef-",
    "DocumentRef-x:LicenseRef-y", "GPL-2.0", "Nope-1.0", "LicenseRef-B", "\t", "\n", " ", ",", "/", "ORISC", "MITAND"];
  const spdx = (rnd) => {
    const expression = (depth) => {
      if (depth > 3 || rnd(10) < 4) return `${IDS[rnd(IDS.length)]}${rnd(8) ? "" : ` WITH ${EXCEPTIONS[rnd(2)]}`}${rnd(12) ? "" : "+"}`;
      const e = `${expression(depth + 1)}${rnd(2) ? " AND " : " OR "}${expression(depth + 1)}`;
      return rnd(2) ? `(${e})` : e;
    };
    if (rnd(2)) return expression(0);
    return Array.from({ length: 1 + rnd(6) }, () => WORDS[rnd(WORDS.length)]).join(["", " ", " ", "  "][rnd(4)]);
  };
  const reference = (e) => { try { return parse(e); } catch { return null; } };
  // SPDX's reading, held to a list as licenceOk holds one: an exception or "or later" never allowed, one side of an OR
  const allowedBy = (node, allow) => node.license !== undefined ? !node.plus && !node.exception && allow.has(node.license)
    : node.conjunction === "and" ? allowedBy(node.left, allow) && allowedBy(node.right, allow) : allowedBy(node.left, allow) || allowedBy(node.right, allow);
  const licences = (node) => (node.license !== undefined ? [node.license] : [...licences(node.left), ...licences(node.right)]);
  const words = (e) => e.match(/\(|\)|[^ ()]+/gu) ?? [];
  // The expression as SPDX's parser is asked it: its brackets and operators as the reader sees them, each word the
  // reader allows kept, and each other word, which the reader refuses whatever it is, made one SPDX knows and no list
  // here allows; a side with an exception, which each reader refuses whatever its words, made a known licence with a
  // known exception (SPDX's grammar puts a LicenseRef before WITH too, which this parser does not read)
  const asked = (e, kept) => {
    const w = words(e);
    return w.map((x, i) => (["(", ")", "AND", "OR", "WITH"].includes(x) ? x
      : w[i + 1] === "WITH" ? "MIT" : w[i - 1] === "WITH" ? (/^[A-Za-z0-9][A-Za-z0-9.-]*$/u.test(x) ? "Classpath-exception-2.0" : x)
      : kept(x) ? x : "AGPL-3.0-only")).join(" ");
  };
  // what each reader refuses that SPDX's parser reads, as each says: AND and OR mixed without brackets (licenceOk), an
  // operator not in capitals or run into a word, "+", a DocumentRef, or a licence not on the reader's list
  const mixed = (e) => {
    const levels = [new Set()];
    for (const w of words(e)) {
      if (w === "(") levels.push(new Set());
      else if (w === ")") levels.pop();
      else if (/^(?:AND|OR)$/iu.test(w)) levels.at(-1)?.add(w.toUpperCase());
      if (levels.some((l) => l.size > 1)) return true;
    }
    return false;
  };
  const loose = (e) => words(e).some((w) => (/^(?:AND|OR|WITH)$/iu.test(w) && w !== w.toUpperCase()) || /^(?:AND|OR|WITH)./iu.test(w)) || e.includes("+") || e.includes("DocumentRef-");

  const rnd = prng(201);
  const lists = [new Set(["MIT", "ISC", "Apache-2.0"]), new Set(["MIT"]), new Set(IDS)];
  const laxer = [], stricter = [], readLaxer = [], readStricter = [];
  for (let i = 0; i < CASES; i++) {
    const e = spdx(rnd), ast = reference(e);
    for (const allow of lists) {
      const ours = licenceOk(e, allow);
      const theirs = reference(asked(e, (x) => allow.has(x)));
      if (ours && !(theirs && allowedBy(theirs, allow))) laxer.push(e);
      if (!ours && ast && allowedBy(ast, allow) && !mixed(e) && !loose(e)) stricter.push(e);
    }
    const yes = readable(e, new Set(IDS));
    if (yes && !reference(asked(e, (x) => IDS.includes(x) || /^LicenseRef-/u.test(x)))) readLaxer.push(e);
    if (!yes && ast && !loose(e) && licences(ast).every((l) => IDS.includes(l))) readStricter.push(e);
  }
  const shown = (list) => list.slice(0, 5).map((e) => JSON.stringify(e)).join(" | ");
  ok(!laxer.length, `licenceOk allows nothing SPDX's parser refuses, or reads as not allowed (${CASES} expressions, 3 lists)`, shown(laxer));
  ok(!stricter.length, "licenceOk refuses what SPDX's parser allows only for a reason it states", shown(stricter));
  ok(!readLaxer.length, `readable takes no licence SPDX's parser cannot read (${CASES} expressions)`, shown(readLaxer));
  ok(!readStricter.length, "readable refuses what SPDX's parser reads only for a reason it states", shown(readStricter));

  // --- NuGet manifests ---
  const NS = "http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd";
  const MANIFESTS = [
    [`<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="${NS}">\n  <metadata>\n    <id>A</id>\n    <version>1.0.0</version>\n    <license type="expression">MIT OR Apache-2.0</license>\n  </metadata>\n</package>\n`, "MIT OR Apache-2.0"],
    [`<package><metadata minClientVersion="5.0"><id>B</id><license type='expression' version="1.0.0">  ISC  </license><licenseUrl>https://example.invalid/</licenseUrl></metadata><files/></package>`, "ISC"],
    [`﻿<?xml version="1.0"?><!-- top --><package xmlns="${NS}"><metadata><license type="expression">(MIT AND ISC)</license></metadata></package>`, "(MIT AND ISC)"],
  ];
  const BITS = ["<!-- c -->", "<!-- a -- b -->", "--", "<![CDATA[GPL-3.0-only]]>", "<?pi x?>", "<?xml version=\"1.0\"?>", "<?xml?>", "<?x y?>",
    `<license type="expression">GPL-3.0-only</license>`, "</metadata><metadata>", `<x:license xmlns:x="urn:x" type="expression">GPL-3.0-only</x:license>`,
    ` xmlns="urn:other"`, ` xmlns:x="${NS}"`, `<x:metadata xmlns:x="${NS}">`, "</x:metadata>", `<metadata xmlns="urn:o">`, "<package>", "</package>",
    "&amp;", "&#77;", "&lt;", "&foo;", "&#0;", "<", ">", "\"", "'", "/", "=", "a=\"1\"", " b=\"2\" b=\"3\"", "<metadata>", "</license>", "<license>",
    "<license/>", "<a/>", "</a>", "<!DOCTYPE p>", "]]>", "-->", " type=\"file\"", "GPL-3.0-only ", " OR GPL-3.0-only", "\n", "\t", "\r", " ",
    "﻿", "\u0000", "\u0001"];
  const mutated = (rnd, text) => {
    for (let k = 1 + rnd(3); k--;) {
      const i = rnd(text.length + 1), how = rnd(4);
      if (how === 0) text = text.slice(0, i) + text.slice(i + 1 + rnd(8));
      else if (how === 1) { const j = rnd(text.length + 1); text = text.slice(0, i) + text.slice(Math.min(i, j), Math.max(i, j)) + text.slice(i); }
      else text = text.slice(0, i) + BITS[rnd(BITS.length)] + text.slice(i);
    }
    return text;
  };
  // the parser's reading, as NuGet reads a manifest: the one license under the one metadata under the root, package,
  // each by its local name in the root's namespace; any error or fatal error is no reading (a decoder drops the BOM)
  const xmlReading = (text) => {
    const errors = [];
    let doc;
    try {
      doc = new DOMParser({ onError: (level, message) => { if (level !== "warning") errors.push(message); } }).parseFromString(text.replace(/^﻿/u, ""), "text/xml");
    } catch (e) { return { refused: e.message.split("\n")[0] }; }
    if (errors.length) return { refused: errors[0].split("\n")[0] };
    const root = doc.documentElement, ns = root.namespaceURI;
    const under = (el, name) => Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.localName === name && n.namespaceURI === ns);
    const metadata = root.localName === "package" ? under(root, "metadata") : [];
    const licence = metadata.length === 1 ? under(metadata[0], "license") : [];
    if (licence.length !== 1) return { refused: "no one licence" };
    return { type: licence[0].getAttribute("type"), expression: licence[0].textContent.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, "") };
  };
  ok(MANIFESTS.every(([m, e]) => manifestLicence(m).expression === e && xmlReading(m).expression === e), "a plain manifest: both read its licence, the same");
  const xrnd = prng(202), differ = [];
  let read = 0;
  for (let i = 0; i < CASES; i++) {
    const text = mutated(xrnd, MANIFESTS[xrnd(MANIFESTS.length)][0]);
    const ours = manifestLicence(text).expression;
    if (ours === undefined) continue;
    read++;
    const theirs = xmlReading(text);
    if (theirs.type !== "expression" || theirs.expression !== ours) differ.push(`${JSON.stringify(text)}: ours ${JSON.stringify(ours)}, the parser's ${theirs.refused ?? `${theirs.type}: ${JSON.stringify(theirs.expression)}`}`);
  }
  ok(!differ.length && read > CASES / 20, `manifestLicence reads no licence the XML parser does not read the same (${CASES} manifests, ${read} read by it)`, differ.slice(0, 3).join("\n     "));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${passed} of ${passed + failed} on the hand-written readers`);
process.exit(failed ? 1 : 0);
