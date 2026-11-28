// Tests of the NuGet check (nuget.mjs): the config's "nuget", what a lock file installs and asks for, the licence a
// package's manifest names, and the check whole on a scratch project with lock files, a restore's folder and an
// audit, all written here. No network and no .NET SDK: the real ones are tried by init-dotnet-test.mjs. Node's own
// modules only.
//
//   node tests/nuget-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NOT_A_FILE, REGISTRY, check as checked, formsIn, importPath, imported, importsOf, lockPackages, plainText, projectFilesByContent, projectRooted, readProject, manifestLicence, nugetConfig, projectFiles, globalForms, sourcesOf } from "../scripts/nuget.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { fetchAll } from "../scripts/nuget-fetch.mjs";
import { packagesOf } from "../scripts/lookup.mjs";
import { mended, unmended } from "../scripts/mend.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

// (each failure the check gives in this test, read as it prints it, for its mend; the last assertion says which did not
// say one)
const unsaid = [];
const heard = text => { unsaid.push(...unmended(text)); return text; };
const check = (...args) => { const result = checked(...args); heard(result.failures.map(f => `FAIL: ${f}`).join("\n")); return result; };

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const throws = fn => { try { fn(); return false; } catch { return true; } };

// the config's "nuget"
const L = "src/App/packages.lock.json", T = "tests/App.Tests/packages.lock.json";
ok(nugetConfig({ nuget: { ships: [L], tools: [T] } }).ships.join() === L && nugetConfig({ nuget: {} }).tools.length === 0 && nugetConfig({ nuget: { ships: ["packages.lock.json"] } }).ships.length === 1, "lock files are named as those of what ships and those of tools, either list left out where it is empty");
ok(throws(() => nugetConfig({})) && throws(() => nugetConfig({ nuget: [] })) && throws(() => nugetConfig({ nuget: { ships: [L], other: 1 } })), "a config without it, or with a key it does not know, stops the check");
ok([["src/App/App.csproj"], ["./src/App/packages.lock.json"], ["/abs/packages.lock.json"], ["../packages.lock.json"], ["src//packages.lock.json"], [5], "x"].every(v => throws(() => nugetConfig({ nuget: { ships: v } }))), "a lock file is named as git lists it, inside the project, and is a lock file");
ok(throws(() => nugetConfig({ nuget: { ships: [L], tools: [L] } })) && throws(() => nugetConfig({ nuget: { ships: [L, L] } })), "one named twice stops the check");
const yes = { package: "Odd.Pkg@1.0.0", licence: "LGPL-3.0-only", ships: false, yes: "the owner, 13 November 2026: take it" };
ok(nugetConfig({ nuget: { accepted: [yes, { ...yes, package: "Other.Pkg@2.0.0", ships: true, notice: "its notice" }] } }).accepted.length === 2 && [[{ ...yes, yes: "" }], [{ ...yes, package: "Odd.Pkg" }], [{ ...yes, more: 1 }], [{ ...yes, notice: 5 }], [{ ...yes, ships: "no" }], [{ package: "A@1", licence: "x", ships: true }], ["A@1"], {}].every(a => throws(() => nugetConfig({ nuget: { accepted: a } }))),
  "an accepted package names its exact version, what it is under, whether it ships and the owner's words, with its notice or without, and nothing else");

// where packages come from
ok(sourcesOf({ nuget: {} }, "/project").join() === REGISTRY && sourcesOf({ nuget: { sources: ["https://pkgs.example.com/feed/v3/index.json", "vendor/packages/"] } }, path.resolve("/project")).join() === `${REGISTRY},https://pkgs.example.com/feed/v3/index.json,${path.resolve("/project", "vendor/packages")}`,
  "a restore takes packages from NuGet's own registry, and from what the config names beside it: an address, a folder of the project's by its whole path");
// (the copy of the core where the manifest names it, #918: its folder is no source, and the project's own core/ is one)
const manifestAt = (place) => { const dir = scratchDir("nuget-copy-"); fs.writeFileSync(path.join(dir, "core-manifest.md"), `Core: ${CORE} at ${"a".repeat(40)}, copied whole under ${place} (never edited here).\n`); return dir; };
const vendorRoot = manifestAt("vendor/core/"), bareRoot = scratchDir("nuget-copy-");
try {
  ok(throws(() => nugetConfig({ nuget: { sources: ["vendor/core/packages/"] } }, "vendor/core/")) && throws(() => nugetConfig({ nuget: { sources: ["Vendor/Core/"] } }, "vendor/core/"))
    && nugetConfig({ nuget: { sources: ["core/packages/"] } }, "vendor/core/").sources.length === 1 && nugetConfig({ nuget: { sources: ["vendor/core/packages/"] } }).sources.length === 1 && throws(() => nugetConfig({ nuget: { sources: ["core/packages/"] } })),
    "a source is no folder of the copy of the core, at core/ or at the path the manifest names, and a folder of the project's own that has the name core/ is one where the copy is elsewhere");
  ok(throws(() => sourcesOf({ nuget: { sources: ["vendor/core/packages/"] } }, vendorRoot)) && sourcesOf({ nuget: { sources: ["core/packages/"] } }, vendorRoot).length === 2 && throws(() => sourcesOf({ nuget: { sources: ["core/packages/"] } }, bareRoot)),
    "where a restore's sources are read, the copy is the one the project's manifest names");
  // (the NuGet job's fetch and the lookup of a new package read the same config the same way: a source of the project's
  // own named core/ is no fault where the copy is elsewhere, so neither stops on it)
  const mixed = { nuget: { ships: ["src/App/packages.lock.json"], tools: [], sources: ["core/feed/"] } };
  fs.mkdirSync(path.join(vendorRoot, "src/App"), { recursive: true });
  fs.writeFileSync(path.join(vendorRoot, "src/App/packages.lock.json"), '{ "version": 1, "dependencies": {} }\n');
  const bareFetch = scratchDir("nuget-copy-");
  try {
    const got = await fetchAll(mixed, vendorRoot, ["src/App/packages.lock.json"], bareFetch, [], {}).then(() => "read", (e) => e.message);
    ok(got === "read" && packagesOf(mixed, vendorRoot, null, true).head.length === 1, "the fetch before the restore and the lookup of a new package read a source of the project's own named core/ as the check does, the copy being elsewhere", String(got));
  } finally { fs.rmSync(bareFetch, { recursive: true, force: true }); }
} finally { fs.rmSync(vendorRoot, { recursive: true, force: true }); fs.rmSync(bareRoot, { recursive: true, force: true }); }
ok(["http://pkgs.example.com/", "https://user:word@pkgs.example.com/", "https://pkgs.example.com/v3?key=1", "https://pkgs.example.com/a b", "https://-pkgs.example.com/", "https://169.254.169.254/", "https://localhost/", "https://pkgs..example.com/", "https://pkgs.example.com/a/../b", "../out/", "/abs/", "vendor", "./", "./vendor/", "vendor//x/", "vendor/../x/", ".git/", ".../", "core/", "Core/scripts/", "-x/", "--source/", REGISTRY, REGISTRY.toUpperCase(), 5, "vendor/\n--source\nhttps://pkgs.example.com/"]
  .every(s => throws(() => nugetConfig({ nuget: { sources: [s] } }))) && throws(() => nugetConfig({ nuget: { sources: "vendor/" } })) && throws(() => nugetConfig({ nuget: { sources: ["vendor/", "vendor/"] } })),
  "a source is an https address of a named host, with no sign-in or question in it, or a folder inside the project that is not the core's copy or git's own; never the registry again, never one twice, never a word a restore could read as an option");

// a lock file
const entry = (type, resolved, requested) => ({ type, ...(requested ? { requested } : {}), resolved, contentHash: "h==" });
const lock = deps => JSON.stringify({ version: 1, dependencies: { "net10.0": deps } });
const read = (deps, v) => lockPackages(v ?? lock(deps), "p.lock");
const plain = read({ "Newtonsoft.Json": entry("Direct", "13.0.3", "[13.0.3, )"), "Lib.Dep": entry("Transitive", "2.0.0"), lib: { type: "Project", dependencies: {} }, Central: entry("CentralTransitive", "1.2.3", "[1.2.3, )") });
ok(plain.failures.length === 0 && plain.packages.map(p => `${p.id}@${p.version}`).join() === "Newtonsoft.Json@13.0.3,Lib.Dep@2.0.0,Central@1.2.3", "a lock file gives each package it installs, the ones pulled in too, and none for the project's own projects");
ok(["[1.0.0]", "[1.0.0, 1.0.0]", "[1.0.0, )"].every(r => read({ A: entry("Direct", "1.0.0", r) }).failures.length === 0), "what a project asks for is exact as NuGet writes one version: alone, twice, or as the least version with a lock");
ok(["[1.0.0, )", "[1.*, )", "(, )", "[1.0.0, 2.0.0)", "1.0.1", undefined].every(r => /one exact version/.test(read({ A: entry("Direct", "1.0.1", r) }).failures.join())), "a range, a floating version, or a version asked for that is not the one installed fails (floor rule 7)");
ok(/one exact version/.test(read({ A: entry("CentralTransitive", "2.0.0", "[1.0.0, )") }).failures.join()) && read({ A: entry("Transitive", "2.0.0") }).failures.length === 0, "so does a centrally pinned one; a package another pulls in is asked for by no one here");
ok(/no content hash/.test(read({ A: { type: "Direct", requested: "[1.0.0, )", resolved: "1.0.0" } }).failures.join()), "a package with no content hash fails: a restore could not hold it to what it was");
ok(/does not know/.test(read({ A: { type: "Odd", resolved: "1.0.0" } }).failures.join()) && /cannot? read|can read/.test(read({ "bad id!": entry("Direct", "1.0.0", "[1.0.0, )") }).failures.join()) && /can read/.test(read({ A: entry("Direct", "../1", "[../1, )") }).failures.join()), "an entry of a kind it does not know, or an id or version it cannot read, fails");
ok(/not JSON/.test(read(null, "{").failures.join()) && [`{"version":3,"dependencies":{}}`, `{"version":1}`, `[]`, `{"version":1,"dependencies":[]}`].every(v => /no lock file this check knows/.test(read(null, v).failures.join())), "what is no lock file of NuGet's version 1 or 2 fails");
const two = lockPackages(JSON.stringify({ version: 2, dependencies: { "net10.0": { A: entry("Direct", "1.0.0", "[1.0.0, )") }, "net10.0/win-x64": { A: entry("Direct", "1.0.0", "[1.0.0, )"), "runtime.win.B": entry("Transitive", "3.0.0") } } }), "p.lock");
ok(two.failures.length === 0 && two.packages.length === 2, "a package named under several frameworks is one package, and each framework's own are read");
const split = lockPackages(JSON.stringify({ version: 2, dependencies: { "net8.0": { A: entry("Direct", "1.0.0", "[1.0.0, )") }, "net9.0": { A: { ...entry("Direct", "1.0.0", "[1.0.0, )"), contentHash: "other==" } } } }), "p.lock");
ok(split.packages.length === 1 && split.failures.length === 0 && /p\.lock, net9\.0: A@1\.0\.0: named by two content hashes/.test(split.split.join()), "one version named by two content hashes is said apart: a restore keeps one file of it, so the check would read one file's licence for both", JSON.stringify(split));
const marked = read(null, `\uFEFF${lock({ A: entry("Direct", "1.0.0", "[1.0.0, )") })}`);
ok(marked.failures.length === 0 && marked.packages.length === 1, "a lock file saved with a byte-order mark is read past it, as NuGet reads it", JSON.stringify(marked));

// a manifest's licence
const nuspec = (inner, more = "") => `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">\n  <metadata>\n    <id>A</id>\n    <version>1.0.0</version>\n    ${inner}\n    <description>x &gt; y</description>\n    <dependencies><group targetFramework="net8.0"><dependency id="B" version="1.0.0" exclude="Build,Analyzers" /></group></dependencies>\n  </metadata>\n  ${more}\n</package>`;
const expression = text => manifestLicence(text).expression, other = text => manifestLicence(text).other;
ok(expression(nuspec(`<license type="expression">MIT</license>`)) === "MIT" && expression(nuspec(`<license type='expression' version="1.0.0"> Apache-2.0 OR MIT </license><licenseUrl>https://licenses.nuget.org/MIT</licenseUrl>`)) === "Apache-2.0 OR MIT" && expression(nuspec(`<license type="expression">MIT</license>`).replace(/\n/g, "\r\n")) === "MIT",
  "a manifest that names its licence as an expression gives it, whatever its quotes, its line endings, or the address beside it");
ok(other(nuspec(`<license type="file">LICENSE.txt</license>`)) === "a licence file" && other(nuspec(`<licenseUrl>https://example.invalid/licence</licenseUrl>`)) === "an address" && other(nuspec("")) === "nothing", "one that names a licence file, an address or nothing has no licence a machine can read, and says which");
ok(other(nuspec(`<!-- <license type="expression">MIT</license> --><licenseUrl>u</licenseUrl>`)) === "an address" && other(nuspec(`<title><![CDATA[<license type="expression">MIT</license>]]></title>`)) === "nothing" && other(nuspec(`<?pi <license type="expression">MIT</license> ?>`)) === "nothing",
  "a licence written in a comment, in CDATA or in a processing instruction is no licence");
ok(other(nuspec(`<repository type="git"><license type="expression">MIT</license></repository>`)) === "nothing" && other(nuspec("", `<license type="expression">MIT</license>`)) === "nothing",
  "nor is one that stands anywhere but directly under the manifest's metadata");
ok(other(nuspec(`<license type="expression">MIT</license><license type="expression">GPL-3.0-only</license>`)) === "a manifest with two licences" && other(`<!DOCTYPE package [<!ENTITY l "MIT">]>${nuspec(`<license type="expression">&l;</license>`)}`) === "a manifest it will not read",
  "two licences, or a document type, give none it will trust");
ok([`<license type="expression">MIT<![CDATA[ AND GPL-3.0-only]]></license>`, `<license type="expression"><![CDATA[MIT]]></license>`, `<license type="expression">MIT<!-- AND GPL-3.0-only --></license>`, `<license type="expression">MIT<?x?> OR Apache-2.0</license>`, `<license type="expression">MIT\u0000</license>`].every(l => other(nuspec(l)) !== undefined && expression(nuspec(l)) === undefined),
  "an expression with CDATA, a comment or a processing instruction inside it is not read: a reader of XML would see more of it, or other, than this one");
ok([`<license type="expression">MIT\u00a0OR\u00a0Foo-1</license>`, `<license type="expression">MIT\u2003AND GPL-3.0-only</license>`, `<license type="expression">M\u0406T</license>`, `<license type="expression">MIT\u0085</license>`, `<license type="expression">(MIT OR\r\n Apache-2.0)</license>`, `<license type="expression">MIT\tOR ISC</license>`].every(l => other(nuspec(l)) === "a licence it cannot read") && expression(nuspec(`<license type="expression">\n\t(MIT OR Apache-2.0)\r\n</license>`)) === "(MIT OR Apache-2.0)",
  "an expression with a blank but a space inside it, or any character outside plain ASCII, is not read: XML reads a line's end otherwise than it stands, and SPDX parts words by spaces alone; XML's blanks at its ends are dropped");
ok([nuspec(`<license type="expression">MIT &amp; more</license>`), nuspec(`<license type="expression"></license>`), nuspec(`<license>MIT</license>`), nuspec(`<license type="other">MIT</license>`), nuspec(`<license version="1" type="expression">MIT</license>`), nuspec(`<license type="expression"/>`)].every(t => other(t) === "a licence it cannot read"),
  "an expression with an entity in it, an empty one, or a licence element written any other way cannot be read");
const mit = `<license type="expression">MIT</license>`;
ok(other(`<package><metadata><licenseUrl>https://example.invalid/terms</licenseUrl></metadata><metadata>${mit}</metadata></package>`) === "a manifest with two metadata parts" && other(`<package><metadata></metadata><metadata/></package>`) === "a manifest with two metadata parts",
  "a second metadata part gives none: NuGet reads the first, and a licence in the second is one it never sees");
ok([`<package><metadata\u00e9>${mit}</metadata\u00e9><metadata><licenseUrl>u</licenseUrl></metadata></package>`, nuspec(`<license\ufeff type="expression">MIT</license\ufeff>`), nuspec(`<license\u00a0type="expression">MIT</license>`), nuspec(`<licens\u0435 type="expression">MIT</licens\u0435>`)].every(t => other(t) === "a manifest it will not read"),
  "an element whose name is not plain ASCII, or ends at a blank that is not XML's, is not read: a reader of XML may see another name there");
ok(other(nuspec(`<license\u00a0 type="expression">MIT</license>`)) === "a manifest it will not read" && other(nuspec(`<license type\u00a0="expression">MIT</license>`)) === "a manifest that is not well formed" && expression(nuspec(`<license\n\ttype = "expression" >MIT</license >`)) === "MIT", "XML's own blanks, and only they, stand between a name and what follows it");
ok([`${nuspec(mit)}<package><metadata>${mit}</metadata></package>`, `${nuspec(mit)} text`, `text ${nuspec(mit)}`, `<other/>${nuspec(mit)}`].every(t => other(t) === "a manifest that is not well formed") && expression(`\ufeff${nuspec(mit)}\n<!-- after -->\n`) === "MIT",
  "a second root, or text outside the root, is not well formed; a byte-order mark before it and a comment after it are");
const prefixed = (first, second = `<metadata>${mit}</metadata>`) => `<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd" xmlns:x="urn:a">${first}${second}</package>`;
ok([prefixed(`<x:metadata><licenseUrl>u</licenseUrl></x:metadata>`), prefixed("", `<metadata><x:license type="expression">MIT</x:license></metadata>`), prefixed(`<metadata xmlns="urn:b"><licenseUrl>u</licenseUrl></metadata>`, ""), prefixed("", `<metadata><license xmlns="urn:b" type="expression">MIT</license></metadata>`), prefixed("", `<metadata xmlns:y="urn:c">${mit}</metadata>`), prefixed("", `<metadata><license type="expression"\txmlns = 'urn:b'>MIT</license></metadata>`)].every(t => other(t) === "a manifest it will not read")
  && expression(prefixed("", `<metadata><title data="xmlns='x'">t</title>${mit}</metadata>`)) === "MIT",
  "a name with a prefix, or a namespace declared anywhere but on the root, is not read: NuGet goes by an element's local name and namespace, and would find another element; the word inside an attribute's value is only a word");
ok([nuspec(`<license type="expression">MIT</license>`).replace("</metadata>", ""), nuspec(`<license type="expression">MIT`), nuspec(`<license type="expression">MIT</license>`) + "<", nuspec(`<!-- never closed <license type="expression">MIT</license>`), "<package><metadata></package></metadata>"].every(t => other(t) === "a manifest that is not well formed") && other(undefined) === "a manifest it will not read",
  "a manifest that is not well formed gives none");

// the check whole, on a scratch project
const tmp = scratchDir("nuget-test-");
const put = (to, text) => { fs.mkdirSync(path.dirname(path.join(tmp, to)), { recursive: true }); fs.writeFileSync(path.join(tmp, to), text); return to; };
// (what each made-up package's manifest names; a restore's folder holds those a project's lock files install)
const MANIFESTS = {
  "Newtonsoft.Json@13.0.3": `<license type="expression">MIT</license>`, "Serial.Lib@3.0.5": `<license type="expression">MS-PL</license>`,
  "Lib.Dep@2.0.0": `<license type="expression">Apache-2.0</license>`, "By.File@1.0.0": `<license type="file">LICENSE.md</license>`,
  "Copy.Left@4.0.0": `<license type="expression">GPL-3.0-only</license>`, "Weak.Copy@2.1.0": `<license type="expression">LGPL-3.0-only</license>`,
  "Non.Commercial@5.0.0": `<license type="expression">CC-BY-NC-4.0</license>`, "Test.Tool@9.0.0": `<license type="expression">EPL-2.0</license>`,
  "Some.Pack@8.0.0": `<license type="expression">MIT</license>`,
};
let folders = 0;
// (each package as a restore leaves it: its manifest, and beside it NuGet's record of the source it took it from; a
// name is "<Id>@<version>", or [that, the source] for one taken from elsewhere than the registry)
const restore = (...names) => {
  const dir = `restored-${++folders}`;
  fs.mkdirSync(path.join(tmp, dir));
  for (const [name, source = REGISTRY] of names.map(n => (Array.isArray(n) ? n : [n])).filter(([n]) => MANIFESTS[n])) {
    const [id, version] = name.toLowerCase().split("@");
    put(`${dir}/${id}/${version}/${id}.nuspec`, nuspec(MANIFESTS[name]));
    put(`${dir}/${id}/${version}/.nupkg.metadata`, JSON.stringify({ version: 2, contentHash: "h==", source }));
  }
  return path.join(tmp, dir);
};
const direct = (...pairs) => Object.fromEntries(pairs.map(([id, v]) => [id, entry("Direct", v, `[${v}, )`)]));
const installed = deps => Object.entries(deps).filter(([, e]) => e.type !== "Project").map(([id, e]) => `${id}@${e.resolved}`);
const TRACKED = ["src/App/App.csproj", L, "tests/App.Tests/App.Tests.csproj", T, "core/scripts/x.mjs"];
const project = (shipsDeps, toolsDeps, { nuget = {}, entries = [], extra = [], config = {} } = {}) => {
  put(L, lock(shipsDeps)); put(T, lock(toolsDeps));
  put("checks/audit.json", JSON.stringify({ entries }));
  return check({ ships: [], audit: "checks/audit.json", ...config, nuget: { ships: [L], tools: [T], ...nuget } }, tmp, restore(...installed(shipsDeps), ...installed(toolsDeps), ...extra), TRACKED);
};
const said = result => result.failures.join("\n");
const good = project({ ...direct(["Newtonsoft.Json", "13.0.3"], ["Serial.Lib", "3.0.5"]), "Lib.Dep": entry("Transitive", "2.0.0") }, direct(["Test.Tool", "9.0.0"], ["Newtonsoft.Json", "13.0.3"]));
ok(good.failures.length === 0 && /^4 NuGet packages in 2 lock files checked \(3 in what ships, 1 tools that only run\), 0 accepted/.test(good.summary), "a project whose every package is exact and on its list passes: what ships to the floor's list, a test's tool to the tools'", said(good) + good.summary);
{
  // (a licence moved off the list, shipped, with no base: reported as passing, in words true of the run it is; after a
  // restore, --restored, that no base was read after it)
  const deps = { ...direct(["Newtonsoft.Json", "13.0.3"], ["Serial.Lib", "3.0.5"]), "Lib.Dep": entry("Transitive", "2.0.0") };
  const after = check({ ships: [], audit: "checks/audit.json", nuget: { ships: [L], tools: [T] } }, tmp, restore(...installed(deps), ...installed(direct(["Test.Tool", "9.0.0"]))), TRACKED, process.env, { restored: true });
  const moved = r => r.reports.filter(x => x.startsWith("Serial.Lib@3.0.5"));
  ok(moved(good).length === 1 && /with no base to read it against, it passes/.test(moved(good)[0]) && after.failures.length === 0 && moved(after).length === 1 && /with no base read after the restore, it passes/.test(moved(after)[0]),
    "a shipped licence moved off the list, with no base, is reported as passing; after a restore, as with no base read after it", JSON.stringify([good.reports, after.reports, after.failures]));
}
const bad = project(direct(["Copy.Left", "4.0.0"], ["Test.Tool", "9.0.0"], ["By.File", "1.0.0"]), {});
ok(bad.failures.length === 3 && /Copy\.Left@4\.0\.0 .*GPL-3\.0-only is off the list for what ships.*nuget\.accepted/.test(said(bad)) && /Test\.Tool@9\.0\.0 .*EPL-2\.0 is off the list for what ships/.test(said(bad)) && /By\.File@1\.0\.0 .*it ships, and its manifest names a licence file.*waits for the owner's yes \(floor rule 10\)\. Mend: .*the config's "nuget\.accepted"/.test(said(bad)),
  "copyleft in what ships fails, a licence good enough for a tool is not good enough for what ships, and what ships under a licence in a file waits for the owner's yes", said(bad));

// (a package's manifest the restore left is read to a bound, core-path.mjs's regularText: past it, unread)
{
  const dir = restore("Newtonsoft.Json@13.0.3");
  fs.appendFileSync(path.join(dir, "newtonsoft.json/13.0.3/newtonsoft.json.nuspec"), " ".repeat(1 << 24));
  put(L, lock(direct(["Newtonsoft.Json", "13.0.3"]))); put(T, lock({})); put("checks/audit.json", JSON.stringify({ entries: [] }));
  const r = check({ ships: [], audit: "checks/audit.json", nuget: { ships: [L], tools: [T] } }, tmp, dir, TRACKED);
  ok(/Newtonsoft\.Json@13\.0\.3 .*its manifest in the restore's folder is no file of bytes, or is past \d+ bytes.*Mend: /.test(said(r)), "a package's manifest past the bound is unread, and fails with its mend", said(r));
}

// read by hand: a tool's entry in the audit, and the owner's yes for what ships
const hand = { name: "by.file@1.0.0", kind: "nuget", licence: "MIT" };
const tool = (entries, nuget = {}) => project({}, direct(["By.File", "1.0.0"]), { entries, nuget });
ok(/By\.File@1\.0\.0 .*names a licence file.*record it in checks\/audit\.json as "By\.File@1\.0\.0", of "kind": "nuget"/.test(said(tool([]))) && tool([hand]).failures.length === 0,
  "a tool that only runs, its licence in a file, waits to be read by hand, and passes once the audit records it under its id and version, however cased", said(tool([hand])));
ok(/LicenseRef-Odd, as checks\/audit\.json records it, is off the tools' list/.test(said(tool([{ ...hand, licence: "LicenseRef-Odd" }]))) && /names no licence/.test(said(tool([{ ...hand, licence: 5 }])))
  && /names a licence file/.test(said(tool([{ ...hand, name: "By.File@0.9.0" }]))), "an entry that records a licence off the tools' list, none, or another version does not pass it");
ok(/names a licence file/.test(said(tool([{ ...hand, kind: undefined }]))) && /names a licence file/.test(said(tool([{ ...hand, kind: "data" }]))), "an entry of the same name that is not a NuGet package's covers none: the audit holds other things under such names");
ok(/the entry By\.File@0\.9\.0, of "kind": "nuget", is for no package whose licence had to be read by hand\. Mend: take the entry out/.test(said(tool([hand, { ...hand, name: "By.File@0.9.0" }])))
  && /holds an entry for it, and its manifest names its licence itself \(MIT\)\. Mend: take that entry out/.test(said(project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { entries: [{ ...hand, name: "Newtonsoft.Json@13.0.3" }] }))), "an entry for a version installed no more, or for a package whose manifest speaks for itself, fails: the audit's NuGet entries shrink by themselves");
ok(/GPL-3\.0-only is off/.test(said(project(direct(["Copy.Left", "4.0.0"]), {}, { entries: [{ ...hand, name: "Copy.Left@4.0.0" }] }))), "what a manifest names itself, no entry written by hand overrules");
const shippedByHand = project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, ships: true, notice: "n" }] });
ok(shippedByHand.failures.length === 2 && /it ships, and its manifest names a licence file.*waits for the owner's yes/.test(said(shippedByHand)) && /it ships, so checks\/audit\.json holds no entry for it/.test(said(shippedByHand)),
  "what ships is never passed by an audit entry, whatever a session read: read as MIT and recorded as shipping, it still waits for the owner's yes", said(shippedByHand));
ok(/it ships, and its manifest names a licence file/.test(said(project(direct(["By.File", "1.0.0"]), direct(["By.File", "1.0.0"]), { entries: [hand] }))), "nor where the same version is a tool's too: it is held as what ships");

// the owner's yes
const accepted = (id, v, licence, more = {}) => ({ package: `${id}@${v}`, licence, ships: true, yes: "the owner, 13 November 2026: take it", notice: "its notice", ...more });
const taken = project(direct(["Weak.Copy", "2.1.0"], ["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("weak.copy", "2.1.0", "LGPL-3.0-only"), accepted("By.File", "1.0.0", "LicenseRef-Vendor-EULA")] } });
ok(taken.failures.length === 0 && /2 accepted on the owner's yes/.test(taken.summary), "a package off its list, or with no licence a machine can read, passes where the config names that version with the owner's words", said(taken));
ok(project(direct(["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("By.File", "1.0.0", "MIT")] } }).failures.length === 0
  && /it ships, so its notice ships too/.test(said(project(direct(["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("By.File", "1.0.0", "MIT", { notice: undefined })] } }))),
  "what ships under a licence read by hand as one on the list passes by the owner's yes for that reading, with its notice");
ok(/Weak\.Copy@2\.1\.0 .*off the list/.test(said(project(direct(["Weak.Copy", "2.1.0"]), {}, { nuget: { accepted: [accepted("Weak.Copy", "2.0.0", "LGPL-3.0-only")] } }))), "a yes for one version is no yes for the next");
ok(/accepted as a tool that only runs .*a yes for a tool is no yes for what ships/.test(said(project(direct(["By.File", "1.0.0"]), direct(["By.File", "1.0.0"]), { nuget: { accepted: [accepted("By.File", "1.0.0", "LicenseRef-Vendor-EULA", { ships: false })] } })))
  && project({}, direct(["By.File", "1.0.0"]), { nuget: { accepted: [accepted("By.File", "1.0.0", "LicenseRef-Vendor-EULA", { ships: false, notice: undefined })] } }).failures.length === 0, "a yes for a tool that only runs is no yes for the same version where it ships; for the tool it is enough, and needs no notice");
ok(/it ships, so its notice ships too/.test(said(project(direct(["Weak.Copy", "2.1.0"]), {}, { nuget: { accepted: [accepted("Weak.Copy", "2.1.0", "LGPL-3.0-only", { notice: " " })] } }))), "an accepted package that ships has its notice there");
ok([accepted("Non.Commercial", "5.0.0", "CC-BY-NC-4.0"), accepted("Non.Commercial", "5.0.0", "MIT"), accepted("Non.Commercial", "5.0.0", "LicenseRef-Free-For-Any-Use")].every(a => /terms floor rule 10 never allows/.test(said(project(direct(["Non.Commercial", "5.0.0"]), {}, { nuget: { accepted: [a] } }))))
  && /terms floor rule 10 never allows/.test(said(project(direct(["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("By.File", "1.0.0", "LicenseRef-BUSL-1.1")] } }))), "no yes takes in terms the floor never allows, whatever the entry calls them: the manifest's own word counts, and the entry's");
ok(/named in "nuget\.accepted" and in checks\/audit\.json both, and an accepted package stands/.test(said(project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, licence: "GPL-3.0-only" }], nuget: { accepted: [accepted("By.File", "1.0.0", "GPL-3.0-only")] } })))
  && /named in "nuget\.accepted" and in checks\/audit\.json both, and an accepted package stands/.test(said(project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, ships: true, notice: "n" }], nuget: { accepted: [accepted("By.File", "1.0.0", "MIT")] } })))
  && /and the entry is on its list\. Mend: take the yes out/.test(said(tool([hand], { accepted: [accepted("By.File", "1.0.0", "MIT", { ships: false })] }))), "an accepted package with an audit entry too fails: the licence check would hold that entry to the list, and a tool's entry on the list needs no yes");
ok(/names Newtonsoft\.Json@13\.0\.3, which is on its list and needs no yes\. Mend: take that yes out/.test(said(project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { nuget: { accepted: [accepted("Newtonsoft.Json", "13.0.3", "MIT")] } })))
  && /names Gone@1\.0\.0, which nothing installs\. Mend: take that yes out/.test(said(project({}, {}, { nuget: { accepted: [accepted("Gone", "1.0.0", "x")] } }))), "an accepted version that needs no yes, or is installed no more, fails: the list shrinks by itself");
ok(["Business Source License 1.1", "none given", "the maker's own terms, bought", "MIT or Apache-2.0", "LicenseRef-", "LicenseRef-a b"].every(words => /which no machine can read\. Mend: name it by an SPDX id/.test(said(project(direct(["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("By.File", "1.0.0", words)] } }))))
  && ["LicenseRef-Vendor-EULA", "LGPL-3.0-only", "(MIT OR GPL-2.0-only)", "GPL-2.0-only WITH Classpath-exception-2.0", "CC-BY-4.0"].every(words => project(direct(["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("By.File", "1.0.0", words)] } }).failures.length === 0),
  "what an accepted package is under is named so that a machine can read it: by ids this check knows, or as LicenseRef- and a name; words of one's own fail");
ok(throws(() => project({}, {}, { nuget: { accepted: [accepted("A", "1", "x"), accepted("a", "1", "y")] } })) && throws(() => project({}, {}, { nuget: { accepted: [{ ...accepted("A", "1", "x"), ships: undefined }] } })), "a package accepted twice, or without a word on whether it ships, stops the check");

// what the restore brought, and what it did not
ok(/Not\.Restored@1\.0\.0 .*not in the restore's folder/.test(said(project(direct(["Not.Restored", "1.0.0"]), {}))) && /not in the restore's folder/.test(said(check({ ships: [], nuget: { ships: [L] } }, tmp, undefined, ["src/App/App.csproj", L]))), "a package the restore did not bring, or no restore at all, fails: its licence cannot be read");
const pack = project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { extra: ["Some.Pack@8.0.0"] });
ok(pack.failures.length === 0 && /^1 NuGet packages in 2 lock files checked \(1 in what ships, 0 tools that only run\), and 1 more that the restore brought and no lock file names/.test(pack.summary), "a package the restore brought that no lock file names, a targeting pack say, is read too, and passes on its list", said(pack) + pack.summary);
const smuggled = project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { extra: ["Copy.Left@4.0.0", "By.File@1.0.0"] });
ok(/copy\.left@4\.0\.0 \(brought by the restore, and named in no lock file read here\): GPL-3\.0-only is off the list for what ships/.test(said(smuggled)) && /by\.file@1\.0\.0 \(brought by the restore.*names a licence file/.test(said(smuggled)), "one off the list fails as what ships would, however it came: a lock file under another name, a download a project file asks for", said(smuggled));
ok(/by\.file@1\.0\.0: it ships, so checks\/audit\.json holds no entry for it/.test(said(project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { extra: ["By.File@1.0.0"], entries: [hand] })))
  && project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { extra: ["By.File@1.0.0"], nuget: { accepted: [accepted("By.File", "1.0.0", "MIT")] } }).failures.length === 0, "and one read by hand passes as what ships does: by the owner's yes, never by an audit entry");
ok(/one exact version/.test(said(project({ A: entry("Direct", "13.0.3", "[13.0.*, )") }, {}))), "a lock file's own faults are the check's");
ok(project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { config: { data: ["Newtonsoft.Json", "copy.left"], fonts: ["Copy.Left"] } }).failures.length === 0 && /GPL-3\.0-only is off/.test(said(project(direct(["Copy.Left", "4.0.0"]), {}, { config: { data: ["Copy.Left"], fonts: ["Copy.Left"] } }))), "a name the config gives as data or a font, for npm's packages, widens no list for a NuGet package of that name");
const loud = lockPackages(JSON.stringify({ version: 1, dependencies: { "net10.0\n::error::forged": { "A\n::warning::x": entry("Direct", "1.0.0", "[2.0.0\n::notice::y, )"), B: entry("Direct", "1.0.0", "[9\r\n::stop-commands::z, )") } } }), "p.lock").failures;
ok(loud.length === 2 && loud.every(line => !/[\r\n]/.test(line)), "what a lock file holds is shown on one line: nothing in it starts a line of its own in a log", JSON.stringify(loud));

// every project has its lock file, and every lock file is named
const names = (tracked, nuget) => check({ ships: [], nuget }, tmp, restore(), tracked).failures.join("\n");
put(L, lock({})); put(T, lock({}));
ok(/src\/Other\/Other\.fsproj has no packages\.lock\.json beside it/.test(names(["src/App/App.csproj", L, "src/Other/Other.fsproj"], { ships: [L] })) && /Old\.VBPROJ has no/.test(names(["Old.VBPROJ"], {})), "a project file with no lock file beside it that git knows fails, whatever its language or its case");
ok(/tests\/App\.Tests\/packages\.lock\.json is named in neither/.test(names(["src/App/App.csproj", L, "tests/App.Tests/App.Tests.csproj", T], { ships: [L] })), "a lock file the config does not name fails: it would go unread");
ok(/names src\/App\/packages\.lock\.json, which is no lock file git knows/.test(names([], { ships: [L] })), "one the config names that git does not know fails");
ok(/packages\.config has no lock file/.test(names(["legacy/packages.config"], {})), "the older packages.config fails");
ok(/src\/App\/packages\.App\.lock\.json: a lock file under another name/.test(names(["src/App/App.csproj", L, "src/App/packages.App.lock.json"], { ships: [L] })) && /Packages\.X\.Lock\.Json: a lock file under another name/.test(names(["Packages.X.Lock.Json"], {})), "a lock file under the other name NuGet takes first fails: this check would read the plain one and NuGet the other");
put("src/App/App.csproj", "<Project><PropertyGroup><NuGetLockFilePath>../locks/app.json</NuGetLockFilePath></PropertyGroup></Project>"); put("Directory.Build.props", "<Project><PropertyGroup><nugetlockfilepath>x</nugetlockfilepath></PropertyGroup></Project>"); put("build/Other.targets", "<Project />");
ok(/src\/App\/App\.csproj names NuGetLockFilePath/.test(names(["src/App/App.csproj", L], { ships: [L] })) && /Directory\.Build\.props names NuGetLockFilePath/.test(names(["Directory.Build.props", "build/Other.targets"], {})) && names(["build/Other.targets", "gone/Missing.props"], {}) === "", "so does a project or build file that names a lock file kept elsewhere");
put("src/App/App.csproj", "<Project><PropertyGroup><RestorePackagesPath>pkgs</RestorePackagesPath></PropertyGroup></Project>");
put("build/Fallback.props", "<Project><PropertyGroup><RestoreAdditionalProjectFallbackFolders>vendored</RestoreAdditionalProjectFallbackFolders></PropertyGroup></Project>"); put("build/Local.targets", `<Project TreatAsLocalProperty="RestorePackagesPath" />`);
ok(/build\/Fallback\.props names RestorePackagesPath or a fallback folder/.test(names(["build/Fallback.props"], {})) && /build\/Local\.targets names TreatAsLocalProperty/.test(names(["build/Local.targets"], {})), "so does a build file that names a fallback folder, or that lets a project set for itself what the restore sets for all");
ok(/src\/App\/App\.csproj names RestorePackagesPath/.test(names(["src/App/App.csproj", L], { ships: [L] })) && /Directory\.Build\.rsp: a response file/.test(names(["Directory.Build.rsp"], {})) && /src\/msbuild\.RSP: a response file/.test(names(["src/msbuild.RSP"], {})) && names(["notes/other.rsp"], {}) === "",
  "a project file that sends its packages to another folder than the restore's fails, and so does a response file that gives every build options of its own");
// a file an Import brings in that the check cannot find without the build, or that git does not know: reported, and
// passes (#240)
// (a project file and its lock file beside what each case reads: where a project has no .NET project file, no form is read)
put("Probe.csproj", "<Project />"); put("packages.lock.json", lock({}));
const reported = (tracked) => check({ ships: [], nuget: { tools: ["packages.lock.json"] } }, tmp, restore(), ["Probe.csproj", "packages.lock.json", ...tracked]);
put("build/Deps.props", `<Project><Import Project="deps.xml" /><Import Condition="'$(A)' > '1'" Project='$(MSBuildThisFileDirectory)..\\shared\\more.config ' /><!-- <Import Project="old.xml" /> --><Imp<!-- -->ort Project="joined.xml" /><ImportGroup><Import Project="Sdk.props" Sdk="X" /><Import Project="$(MSBuildToolsPath)\\Microsoft.CSharp.targets" /><Import Project="../src/App/App.csproj.user" /></ImportGroup></Project>`);
const importing = reported(["build/Deps.props"]);
ok(importing.failures.length === 0 && importing.reports.length === 4 && importing.reports.some(x => x.includes("build/Deps.props imports deps.xml, a path outside the project, or no file of the project's that git knows")) && importing.reports.some(x => x.includes("imports $(MSBuildThisFileDirectory)..\\shared\\more.config,"))
  && importing.reports.some(x => x.includes("imports $(MSBuildToolsPath)\\Microsoft.CSharp.targets, a file whose path this check cannot know without the build")) && importing.reports.some(x => x.includes("imports ../src/App/App.csproj.user, a path outside the project, or no file of the project's that git knows")) && !importing.reports.some(x => x.includes("Sdk.props")) && / 4 reported, and passing;/.test(importing.summary),
  "an Import that git does not know is reported and passes, of a build file's name too (#280); one an SDK's Import names, or one in a comment, is not", JSON.stringify(importing));
// an Import of a build file's name is passed over only where it leads to a build file the check reads: one into the
// copy of the core, which the check does not read, or through a property it cannot know, is reported as one of any
// other name is (#280)
put("build/Deps.props", `<Project><Import Project="../core/x.props" /><Import Project="../core/x.xml" /><Import Project="$(MSBuildProjectDirectory)/../gen/x.props" /><Import Project="$(MSBuildThisFileDirectory)Other.TARGETS" /><Import Project="$(MSBuildThisFileDirectory)../core/x.props" Sdk="X" /><Import Project="/abs/core/x.props" Sdk="X" /><Import Project="../../x.targets" Sdk="X" /><Import Project="Sdk/Sdk.props" Sdk="X" /></Project>`);
put("core/x.props", `<Project TreatAsLocalProperty="RestorePackagesPath" />`); put("core/x.xml", `<Project TreatAsLocalProperty="RestorePackagesPath" />`); put("build/Other.targets", "<Project />");
const buildNamed = reported(["build/Deps.props", "core/x.props", "core/x.xml", "build/Other.targets"]);
ok(buildNamed.failures.length === 0 && buildNamed.reports.length === 6 && ["$(MSBuildThisFileDirectory)../core/x.props", "/abs/core/x.props", "../../x.targets"].every((p) => buildNamed.reports.some(x => x.includes(`build/Deps.props imports ${p}, a file whose path this check cannot know without the build`))) && !buildNamed.reports.some(x => x.includes("Sdk/Sdk.props")) && ["../core/x.props", "../core/x.xml"].every((p) => buildNamed.reports.some(x => x.includes(`build/Deps.props imports ${p}, a path outside the project, or no file of the project's that git knows`)))
  && buildNamed.reports.some(x => x.includes("imports $(MSBuildProjectDirectory)/../gen/x.props, a file whose path this check cannot know without the build")) && !buildNamed.reports.some(x => x.includes("Other.TARGETS")),
  "an Import of a build file's name into the copy of the core, or through a property the check cannot know, is reported as one of another name is, and so is an SDK's Import of one by a property, a rooted path or \"..\" (#288's security review); one of a build file git knows is not, being read as one, nor one by a plain path inside the SDK's folder", JSON.stringify(buildNamed));
const projects = (text) => imported(text).map((x) => x.project).join();
ok(projects(`<Project><Import Project="deps.xml; x.props" /><P><![CDATA[<!--]]></P><Import Project="hidden.xml" /><P><![CDATA[-->]]></P></Project>`) === "deps.xml,x.props,hidden.xml" && projects(`<?x <!-- ?><Project><Import Project="pi.xml"/></Project><?y --> ?>`) === "pi.xml",
  "each file of an Import's list is read, and neither CDATA nor a processing instruction starts a comment");
put("build/Typed.props", `<!DOCTYPE p [<!ENTITY e "<!--">]><Project><Import Project="deps.xml" /></Project>`);
ok(reported(["build/Typed.props"]).reports.some(x => x.includes("build/Typed.props has a document type")), "a build file with a document type is reported, its Imports unread");
const hostile = ["<Import ", '<Import "', '<Import Project="', "<!--", "<![CDATA[", "<Import a=", "<"].map(x => x.repeat(40000)), started = Date.now();
for (const text of hostile) imported(text);
ok(imported(`<Import Project="${"a;".repeat(300000)}" />`).length === 300000, "an Import's list however long is read whole, past what a call takes as arguments");
ok(Date.now() - started < 2000, "a pull request's build file, however long or unclosed, is read in one pass", `${Date.now() - started} ms`);
ok(imported(`<Import Project="a.xml" Sdk="X" /><Import sdk='Y' Project='b.xml'/><Import Project="c.xml"/>`).map((x) => `${x.project}:${x.sdk}`).join() === "a.xml:true,b.xml:true,c.xml:false", "an Import that names an SDK is told apart, as MSBuild finds its file in the SDK");
ok(importPath("build/Deps.props", "deps.xml") === "build/deps.xml" && importPath("build/Deps.props", "$(MSBuildThisFileDirectory)..\\shared\\x.config") === "shared/x.config" && importPath("build/Deps.props", "$(msbuildthisfiledirectory)./a//b.xml") === "build/a/b.xml" && importPath("A.props", "deps.xml") === "deps.xml" && importPath("build/Deps.props", "$(MSBuildThisFileDirectory)/deps.xml") === "build/deps.xml" && importPath("build/Deps.props", "$(MSBuildThisFileDirectory)\\\\deps.xml") === "build/deps.xml"
  && importPath("build/Deps.props", "../../x.xml") === "" && importPath("build/Deps.props", "/etc/x.xml") === "" && importPath("build/Deps.props", "C:\\x.xml") === ""
  && ["$(Root)x.xml", "x/$(MSBuildThisFileDirectory)y.xml", "@(Files)", "a%3Bb.xml", "*.xml", "dir/**/x.xml", "x?.xml"].every((p) => importPath("build/Deps.props", p) === null),
  "an Import's path is read beside the file that imports it, $(MSBuildThisFileDirectory) as that file's folder, a separator after it or not; one outside the project is no file of its own, and a property, item, escape or wildcard one the check cannot know");
// a file an Import brings in that git knows is read like a build file (#269): what it names fails, and so does what a
// file it imports names in turn, however it is spelled; one an SDK's Import names is not looked for in the project
put("build/Deps.props", `<Project><Import Project="deps.xml" /><Import Project="$(MSBuildThisFileDirectory)..\\shared\\more.config" /><Import Project="sdk.xml" Sdk="X" /></Project>`);
put("build/deps.xml", `<Project><PropertyGroup><NuGetLockFilePath>elsewhere.json</NuGetLockFilePath></PropertyGroup><Import Project="Deeper.XML" /><Import Project="deps.xml" /></Project>`);
put("build/deeper.xml", "<Project><PropertyGroup><RestoreAdditionalProjectFallbackFolders>x</RestoreAdditionalProjectFallbackFolders></PropertyGroup></Project>");
put("shared/more.config", "<Project><PropertyGroup><TreatAsLocalProperty>RestorePackagesPath</TreatAsLocalProperty></PropertyGroup></Project>");
put("build/sdk.xml", "<Project><PropertyGroup><NuGetLockFilePath>sdk.json</NuGetLockFilePath></PropertyGroup></Project>");
const reading = reported(["build/Deps.props", "build/deps.xml", "build/deeper.xml", "shared/more.config", "build/sdk.xml"]);
ok(reading.failures.length === 0 && reading.reports.length === 6 && reading.reports.some(x => x.includes("build/deps.xml, which a build file brings in, names NuGetLockFilePath") && x.includes("held before this check read it")) && reading.reports.some(x => x.includes("build/deeper.xml, which a build file brings in, names RestorePackagesPath or a fallback folder"))
  && reading.reports.some(x => x.includes("shared/more.config, which a build file brings in, names TreatAsLocalProperty")) && reading.reports.some(x => x.includes("imports sdk.xml, a file whose path this check cannot know without the build")) && reading.reports.some(x => x.startsWith("build/sdk.xml names NuGetLockFilePath")),
  "a file an Import brings in, that git knows, is read like a build file, and so are the files it brings in, however spelled; with no base to read, what it names is reported; an Import into an SDK stays reported, the file it names read all the same for what it is, a project", JSON.stringify(reading));
// an Import's value as XML gives it to MSBuild: a tab or a line break a blank, a reference the character, and only
// .NET's blanks trimmed from each name, never a byte-order mark (#272's security review)
put("build/Deps.props", `<Project><Import Project="dep\ts.xml" /><Import Project="b&#46;xml;&#x63;.xml" /><Import Project="bom.xml\uFEFF" /><Import Project="more.props\uFEFF" /><Import Project="\u00A0nb.xml\u3000" /></Project>`);
for (const [f, text] of [["build/dep s.xml", "<Project><PropertyGroup><NuGetLockFilePath>a</NuGetLockFilePath></PropertyGroup></Project>"], ...(process.platform === "win32" ? [] : [["build/dep\ts.xml", "<Project />"]]), ["build/b.xml", "<Project TreatAsLocalProperty=\"X\" />"], ["build/c.xml", "<Project><FallbackFolders /></Project>"], ["build/bom.xml", "<Project />"], ["build/bom.xml\uFEFF", "<Project><RestorePackagesPath>x</RestorePackagesPath></Project>"], ["build/more.props\uFEFF", "<Project><NuGetLockFilePath>m</NuGetLockFilePath></Project>"], ["build/nb.xml", "<Project><NuGetLockFilePath>n</NuGetLockFilePath></Project>"]]) put(f, text);
// (Windows writes no tab in a file's name: the decoy that holds one stands only where the system allows it)
const decoded = reported(["build/Deps.props", "build/dep s.xml", ...(process.platform === "win32" ? [] : ["build/dep\ts.xml"]), "build/b.xml", "build/c.xml", "build/bom.xml", "build/bom.xml\uFEFF", "build/more.props\uFEFF", "build/nb.xml"]);
ok(["build/dep s.xml, which", "build/b.xml, which", "build/c.xml, which", "build/bom.xml\uFEFF, which", "build/more.props\uFEFF, which", "build/nb.xml, which"].every(x => decoded.reports.some(r => r.startsWith(x))) && decoded.reports.length === 6 && !decoded.reports.some(r => r.startsWith("build/bom.xml,")),
  "an Import's value is read as XML gives it: a tab is a blank, a reference its character, and a byte-order mark is kept in the name, as .NET trims none", JSON.stringify(decoded));
ok(projects(`<Import Project="a&amp;b.xml;x&lt;y&#59;z;&bogus;" />`) === "a&b.xml,x<y,z,&bogus" && importPath("A.props", "&bogus") === null, "a reference to & < > \" ' is decoded, and an entity XML does not know is one the check cannot know");
// a file a property MSBuild's own targets import a file by names, as an Import's (#274): read where its value starts at
// its own file's folder, reported where it does not, since MSBuild reads it from the folder of its own targets
const viaOf = (text) => imported(`<Project><PropertyGroup>${text}</PropertyGroup></Project>`).map((x) => `${x.project}|${x.via}${x.loose ? "|loose" : ""}`).join();
ok(viaOf(`<CustomAfterMicrosoftCommonTargets Condition="'$(A)' != ''">$(MSBuildThisFileDirectory)after.xml;<!-- $(MSBuildThisFileDirectory)gone.xml -->\n  $(MSBuildThisFileDirectory)b&amp;c.xml</CustomAfterMicrosoftCommonTargets>`) === "$(MSBuildThisFileDirectory)after.xml|CustomAfterMicrosoftCommonTargets,$(MSBuildThisFileDirectory)b&c.xml|CustomAfterMicrosoftCommonTargets"
  && viaOf(`<directorybuildpropspath>rel.xml</directorybuildpropspath><DirectoryPackagesPropsPath /><NuGetRestoreTargets>  <![CDATA[$(MSBuildThisFileDirectory)<raw>.xml]]></NuGetRestoreTargets>`) === "rel.xml|directorybuildpropspath,$(MSBuildThisFileDirectory)<raw>.xml|NuGetRestoreTargets",
  "a property MSBuild's own targets import a file by is read as XML gives its text, in any case: a comment in it passed over, references decoded, CDATA that comes first as written");
ok(viaOf(`<LanguageTargets>$(MSBuildThisFileDirectory)x<![CDATA[.xml]]></LanguageTargets>`) === "$(markup inside it)|LanguageTargets" && viaOf(`<CustomBeforeMicrosoftCommonProps>$(MSBuildThisFileDirectory)x.xml;<Inner /></CustomBeforeMicrosoftCommonProps>`) === "$(MSBuildThisFileDirectory)x.xml|CustomBeforeMicrosoftCommonProps,$(markup inside it)|CustomBeforeMicrosoftCommonProps",
  "CDATA after text, or an element inside, MSBuild takes as the markup it is written in: such a property's value is one the check cannot know, what stands before an element followed all the same");
ok(viaOf(`<OtherPath>$(MSBuildThisFileDirectory)other.xml;plain.xml</OtherPath><OutputPath>bin/</OutputPath>`) === "$(MSBuildThisFileDirectory)other.xml|OtherPath|loose", "any other property says, of a name that starts at its own file's folder, what brings that file in: what it could bring in is read for what it is");
ok(projectRooted("\uFEFF \n<?xml version='1.0'?><!-- c --><!DOCTYPE p [<!ENTITY e 'x'>]><Project>") && projectRooted(`${" ".repeat(100000)}<project Sdk="x">`) && !projectRooted("<!DOCTYPE html><html>") && !projectRooted("<Projects>") && !projectRooted("<!-- <Project>"),
  "a file is a project where its root element is a Project, past blanks, marks, comments, processing instructions and a document type");
ok([`<!DOCTYPE Project SYSTEM "a>b">`, `<!DOCTYPE Project PUBLIC "p" 'a>b'>`, `<!DOCTYPE Project [ <!ENTITY e "]>"> ]>`, `<!DOCTYPE Project [ <!-- ]> --> ]>`, `<!DOCTYPE Project [ <?pi ]> ?> ]>`].every((d) => projectRooted(`${d}<Project />`)) && !projectRooted(`<!DOCTYPE p "unclosed><Project />`),
  "a document type is passed over to its own end, a \">\" or \"]\" in a quoted string, a comment or a processing instruction inside it no end (#283's security review)");
ok(imported(`<CustomAfterMicrosoftCommonTargets>$(MSBuildThisFileDirectory)a.xml</CustomAfterMicrosoftCommonTargets${" ".repeat(500)}\n>`).map((x) => x.project).join() === "$(MSBuildThisFileDirectory)a.xml", "a property's end tag is read however many blanks stand before its \">\"");
ok(importPath("build/A.props", "$(MSBuildThisFileDirectory)after.xml", { anchored: true }) === "build/after.xml" && importPath("build/A.props", "after.xml", { anchored: true }) === null && importPath("build/A.props", "/opt/x.xml", { anchored: true }) === "" && importPath("build/A.props", "after.xml") === "build/after.xml",
  "a property's value is known only where it starts at its own file's folder: MSBuild reads any other from its own targets' folder");
put("build/Props.props", `<Project><PropertyGroup><CustomAfterMicrosoftCommonTargets>$(MSBuildThisFileDirectory)after.xml;../plain.xml</CustomAfterMicrosoftCommonTargets></PropertyGroup></Project>`);
put("build/after.xml", "<Project><PropertyGroup><RestorePackagesPath>p</RestorePackagesPath></PropertyGroup></Project>");
const byProperty = reported(["build/Props.props", "build/after.xml"]);
ok(byProperty.reports.some(x => x.startsWith("build/after.xml, which a build file brings in, names RestorePackagesPath")) && byProperty.reports.some(x => x.startsWith("build/Props.props brings in ../plain.xml by CustomAfterMicrosoftCommonTargets, a file whose path this check cannot know without the build")) && byProperty.reports.length === 2,
  "a file a property brings in is read like a build file, and one whose path the check cannot know is reported, by the property's name", JSON.stringify(byProperty));
// (a decoy whose name CDATA would spell, and what any other property brings in: XML read, an icon passed over, a file
// in another encoding reported; #283's security review)
put("build/Props.props", `<Project><PropertyGroup><CustomAfterMicrosoftCommonTargets>$(MSBuildThisFileDirectory)x<![CDATA[.xml]]></CustomAfterMicrosoftCommonTargets><Mine>$(MSBuildThisFileDirectory)mine.xml;$(MSBuildThisFileDirectory)app.ico;$(MSBuildThisFileDirectory)wide.xml</Mine></PropertyGroup><Import Project="$(Mine)" /></Project>`);
put("build/x.xml", "<Project />"); put("build/mine.xml", "<Project><PropertyGroup><NuGetLockFilePath>m</NuGetLockFilePath></PropertyGroup></Project>");
put("build/app.ico", Buffer.from([0, 0, 1, 0, 1, 0, 0xff, 0xfe])); put("build/wide.xml", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<Project />", "utf16le")]));
const loose = reported(["build/Props.props", "build/x.xml", "build/mine.xml", "build/app.ico", "build/wide.xml"]);
ok(loose.reports.some(x => x.startsWith("build/Props.props brings in $(markup inside it) by CustomAfterMicrosoftCommonTargets")) && loose.reports.some(x => x.startsWith("build/mine.xml, which a build file brings in, names NuGetLockFilePath"))
  && loose.reports.some(x => x.startsWith("build/wide.xml, which a build file brings in, is not plain UTF-8")) && !loose.reports.some(x => x.includes("app.ico")) && !loose.reports.some(x => x.startsWith("build/x.xml")),
  "a property's value written with CDATA after text is reported, never read as its decoy; a project any property could bring in is read for what it is, an icon passed over and a project in another encoding reported", JSON.stringify(loose));
// (a project in any encoding .NET reads by its mark, or with a byte UTF-8 does not allow, which MSBuild reads as U+FFFD:
// read for what it is, whatever brings it in; #283's security review)
put("build/odd1.xml", Buffer.concat([Buffer.from("<Project><!-- "), Buffer.from([0xff]), Buffer.from(" --><NuGetLockFilePath>x</NuGetLockFilePath></Project>")]));
put("build/odd2.xml", Buffer.concat([Buffer.from([0, 0, 0xfe, 0xff]), ...[..."<Project />"].map((c) => Buffer.from([0, 0, 0, c.charCodeAt(0)]))]));
put("build/odd3.xml", "\uFEFF\uFEFF<Project><NuGetLockFilePath>x</NuGetLockFilePath></Project>"); put("build/odd4.xml", `${" ".repeat(9000)}<Project><RestorePackagesPath>p</RestorePackagesPath></Project>`);
const odd = reported(["build/odd1.xml", "build/odd2.xml", "build/odd3.xml", "build/odd4.xml"]);
ok(odd.reports.some(x => x.startsWith("build/odd1.xml is not plain UTF-8")) && odd.reports.some(x => x.startsWith("build/odd2.xml is not plain UTF-8")) && odd.reports.some(x => x.startsWith("build/odd3.xml names NuGetLockFilePath")) && odd.reports.some(x => x.startsWith("build/odd4.xml names RestorePackagesPath")),
  "a project with a byte UTF-8 does not allow, in UTF-32, with two marks, or past many blanks is read for what it is", JSON.stringify(odd));
put("build/big.xml", `<Project><NuGetLockFilePath>x</NuGetLockFilePath></Project>${" ".repeat(1 << 24)}`);
const big = reported(["build/big.xml"]);
ok(readProject(tmp, "build/big.xml") === NOT_A_FILE && !big.reports.some(x => x.startsWith("build/big.xml names")) && big.reports.some(x => x.startsWith("build/big.xml begins as XML and is past")), "a file past the bound is unread, by name or by its content, and is named so", JSON.stringify(big.reports));
fs.rmSync(path.join(tmp, "build/big.xml"));
if (process.platform !== "win32") {
  fs.symlinkSync("/dev/null", path.join(tmp, "build/device.xml"));
  ok(readProject(tmp, "build/device.xml") === NOT_A_FILE && readProject(tmp, "build") === NOT_A_FILE && readProject(tmp, "build/none.xml") === null && Buffer.isBuffer(readProject(tmp, "build/after.xml")), "a path that leads to a device or a folder is no file, and is never read");
  put("build/Props.props", `<Project><Import Project="device.xml" /></Project>`);
  const device = reported(["build/Props.props", "build/device.xml"]);
  ok(device.reports.some(x => x.startsWith("build/device.xml, which a build file brings in, is no file of bytes")), "an Import of a link to a device is no file the check reads: reported with no base to read", JSON.stringify(device));
  fs.rmSync(path.join(tmp, "build/device.xml"));
}
// a file MSBuild reads by another encoding than UTF-8: neither what it names nor what it imports can be read here as
// MSBuild reads it, so it fails where the pull request brings it, and is reported where the base held it (#272)
const latin = Buffer.concat([Buffer.from('<?xml version="1.0" encoding="iso-8859-1"?><Project><Import Project="d'), Buffer.from([0xe9]), Buffer.from('.xml" /></Project>')]);
const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<Project><RestorePackagesPath>x</RestorePackagesPath></Project>", "utf16le")]);
ok(plainText(Buffer.from("\uFEFF<Project />")) === "<Project />" && plainText(Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Project />')) !== null && plainText(Buffer.from('<?xml version="1.0" encoding="us-ascii"?><Project />')) !== null && plainText(null) === "" && plainText(Buffer.from('<?xml version="1.0" encoding="windows-1252"?><Project />')) !== null && plainText(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><Project />')) !== null
  && [latin, utf16, Buffer.from([0xfe, 0xff, 0, 0x3c]), Buffer.from("<Project>\u0000</Project>"), Buffer.from([0x3c, 0xc3, 0x28, 0x3e]), Buffer.concat([Buffer.from('<?xml version="1.0" encoding="windows-1252"?><Project a="'), Buffer.from([0x80]), Buffer.from('" />')]), Buffer.from('<?xml version="1.0" encoding=\'us-ascii\'?><P a="\u00e9" />')].every(b => plainText(b) === null),
  "a build file is read only as plain UTF-8, a UTF-8 byte-order mark passed over, or as ASCII under an encoding that keeps it: another byte-order mark, encoding, a NUL or bytes UTF-8 does not allow is one this check cannot read as MSBuild does");
put("build/Deps.props", latin); put("build/d\uFFFD.xml", "<Project />"); put("Odd.props", utf16);
const encoded = reported(["build/Deps.props", "build/d\uFFFD.xml", "Odd.props"]);
ok(encoded.reports.some(x => x.startsWith("build/Deps.props is not plain UTF-8")) && encoded.reports.some(x => x.startsWith("Odd.props is not plain UTF-8")) && !encoded.reports.some(x => x.includes("d\uFFFD.xml")) && encoded.failures.length === 0,
  "a build file in another encoding is reported with no base to read (its Imports never followed to a decoy UTF-8 reads its name as)", JSON.stringify(encoded));
const crowd = Array.from({ length: 2048 }, (_, i) => [..."abcdefghijk"].map((c, j) => (i >> j) & 1 ? c.toUpperCase() : c).join("") + ".xml"), crowdStart = Date.now();
const crowded = importsOf([...crowd, ...crowd.map((_, i) => `i${i}.props`)], f => f.endsWith(".props") ? `<Project><Import Project="abcdefghijk.xml" /></Project>` : "<Project />");
ok(crowded.brought.size === 2048 && crowded.brought.get(crowd[5]).size === 2048 && Date.now() - crowdStart < 3000, "many files that import a name git knows in many cases share one list of who imports it", `${Date.now() - crowdStart} ms`);
put("build/Deps.props", `<Project><Import Project="deps.xml" /><Import Project="$(MSBuildThisFileDirectory)..\\shared\\more.config" /><Import Project="sdk.xml" Sdk="X" /></Project>`);
ok(reported(["build/Deps.props", "build/deps.xml"]).reports.some(x => x.includes("build/deps.xml imports Deeper.XML, a path outside the project, or no file of the project's that git knows")), "an Import in a file brought in, of a file git does not know, is reported too");
put("src/App/App.csproj", "<Project />");
ok(names(["core/x/y.csproj", "core/packages.lock.json", "core/packages.y.lock.json", "README.md"], {}) === "" && /^0 NuGet packages in 0 lock files/.test(check({ ships: [], nuget: {} }, tmp, restore(), ["README.md"]).summary), "the copy of the core is not the project's, and a project with no NuGet project passes with nothing to read");
ok(projectFiles(["src/App/App.csproj", "a b/C.FSPROJ", "core/x/y.csproj", "x.csproj.bak", "README.md", "t/T.vbproj"]).join() === "src/App/App.csproj,a b/C.FSPROJ,t/T.vbproj", "the project files it lists for the restore are the same it asks a lock file of");

// the script itself: started in a project, as the workflow starts it
const repo = path.join(tmp, "repo");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" });
const here = fileURLToPath(new URL("../scripts", import.meta.url)); // (the scripts this tests, beside the folder tests/)
fs.mkdirSync(path.join(repo, "core"), { recursive: true });
fs.cpSync(here, path.join(repo, "core", "scripts"), { recursive: true });
fs.cpSync(path.join(here, "..", ".packages"), path.join(repo, "core", ".packages"), { recursive: true, filter: parserLeftOut });
fs.cpSync(path.join(here, "..", "floor"), path.join(repo, "core", "floor"), { recursive: true });
// where each package was taken from, as NuGet records it beside the package
const APP = "src/App/App.csproj", only = [APP, L];
const takenFrom = (source, nuget = {}, tracked = only, { meta, env } = {}) => {
  put(L, lock(direct(["Newtonsoft.Json", "13.0.3"])));
  const dir = restore(["Newtonsoft.Json@13.0.3", source]), record = path.join(dir, "newtonsoft.json", "13.0.3", ".nupkg.metadata");
  if (meta === null) fs.rmSync(record); else if (meta !== undefined) fs.writeFileSync(record, meta);
  return check({ ships: [], nuget: { ships: [L], ...nuget } }, tmp, dir, tracked, env).failures.join("\n");
};
const named = { sources: ["https://pkgs.example.com/v3/index.json", "vendor/packages/"] }, vendored = [...only, "vendor/packages/Bought.1.0.0.nupkg"];
ok(takenFrom(REGISTRY) === "" && takenFrom("https://pkgs.example.com/v3/index.json", named, vendored) === ""
  && takenFrom(path.join(tmp, "vendor", "packages") + path.sep, named, vendored) === "" && takenFrom(path.join(tmp, "vendor", "packages"), named, vendored) === "",
  "a package taken from the registry, or from a source the config names, an address or a folder however its path ends, passes");
ok(/Newtonsoft\.Json@13\.0\.3 \(src\/App\/packages\.lock\.json\): the restore took it from https:\/\/pkgs\.example\.com\/v3\/index\.json, which is neither NuGet's own registry nor a source the config's "nuget\.sources" names/.test(takenFrom("https://pkgs.example.com/v3/index.json"))
  && /the restore took it from .*vendored/.test(takenFrom(path.join(tmp, "vendored"))) && /the restore took it from http:\/\/pkgs\.example\.com/.test(takenFrom("http://pkgs.example.com/v3/index.json", { sources: ["https://pkgs.example.com/v3/index.json"] }))
  && /the restore took it from https:\/\/API\.nuget\.org/.test(takenFrom("https://API.nuget.org/v3/index.json")), "one taken from anywhere else fails, whatever added the source: an address, a folder, the plain form of a named address, another spelling of the registry's");
ok([null, "", "not json", "{}", JSON.stringify({ version: 2, source: "" }), JSON.stringify({ source: 7 })].every(meta => /the restore left no record of where it took it from \(\.nupkg\.metadata\)/.test(takenFrom(REGISTRY, {}, only, { meta }))),
  "a package with no record of where it was taken from, or one that names no source, fails: its source cannot be read");
const elsewhere = check({ ships: [], nuget: { ships: [L] } }, tmp, restore("Newtonsoft.Json@13.0.3", ["Some.Pack@8.0.0", "https://pkgs.example.com/v3/index.json"]), only).failures.join("\n");
ok(/some\.pack@8\.0\.0 \(brought by the restore, and named in no lock file read here\): the restore took it from https:\/\/pkgs\.example\.com/.test(elsewhere), "a package the restore brought that no lock file names, for a project of another kind say, is held to the same sources", elsewhere);
// (the runner's own SDK stands outside the project, as on a runner)
const sdk = scratchDir("nuget-test-sdk-");
for (const name of ["dotnet", "dotnet.exe"]) fs.writeFileSync(path.join(sdk, name), "");
const onPath = { env: { PATH: [path.join(tmp, "nowhere"), sdk].join(path.delimiter) } };
ok(takenFrom(path.join(sdk, "library-packs"), {}, only, onPath) === "" && /the restore took it from .*library-packs/.test(takenFrom(path.join(tmp, "elsewhere", "library-packs"), {}, only, onPath)) && /the restore took it from .*library-packs/.test(takenFrom(path.join(sdk, "library-packs"))),
  "the SDK's own folder of packages, beside the dotnet the PATH names, is a source every restore has; a folder of that name anywhere else is not, nor that one where no dotnet stands beside it on the PATH");
put("tools/dotnet", "");
const relative = path.relative(process.cwd(), path.join(tmp, "tools")), local = (dir) => takenFrom(path.join(tmp, "tools", "library-packs"), {}, only, { env: { PATH: dir } });
ok(/the restore took it from .*library-packs/.test(local(relative)) && /the restore took it from .*library-packs/.test(local(path.join(tmp, "tools"))) && /the restore took it from .*library-packs/.test(takenFrom(path.join(tmp, "tools", "library-packs"), {}, only, { env: { DOTNET_ROOT: path.join(tmp, "tools") } })),
  "a dotnet the PATH or DOTNET_ROOT names by a path that is not whole, or one inside the project, brings no folder of packages: it would be one the pull request brought");
const outside = scratchDir("nuget-test-path-");
fs.symlinkSync(path.join(tmp, "tools", "dotnet"), path.join(outside, "dotnet"));
ok(/the restore took it from .*library-packs/.test(takenFrom(path.join(tmp, "tools", "library-packs"), {}, only, { env: { PATH: outside } })), "nor one whose link, outside the project, leads into it", takenFrom(path.join(tmp, "tools", "library-packs"), {}, only, { env: { PATH: outside } }));
put("vendor/packages/Bought.1.0.0.nupkg", "");
const shown = names(["vendor/packages/Bought.1.0.0.nupkg"], { sources: ["vendor/packages/", "https://pkgs.example.com/v3/index.json"] });
fs.symlinkSync(os.tmpdir(), path.join(tmp, "vendor/packages/elsewhere"));
ok(/"nuget\.sources" names vendor\/packages\/, a folder that holds no file git knows/.test(names(["vendor/readme.md"], { sources: ["vendor/packages/"] })) && shown === ""
  && /vendor\/packages\/elsewhere: a link, in a folder the config names as a source/.test(names(["vendor/packages/Bought.1.0.0.nupkg", "vendor/packages/elsewhere"], { sources: ["vendor/packages/"] })),
  "a folder named as a source holds files git knows, so what it gives stands in the pull request, and no link that leads out of it");
fs.rmSync(path.join(tmp, "vendor/packages/elsewhere")); put("vendor/packages/deep/Slipped.2.0.0.nupkg", "");
ok(/vendor\/packages\/deep\/Slipped\.2\.0\.0\.nupkg: a file git does not know, in a folder the config names as a source/.test(names(["vendor/packages/Bought.1.0.0.nupkg"], { sources: ["vendor/packages/"] }))
  && names(["vendor/packages/Bought.1.0.0.nupkg", "vendor/packages/deep/Slipped.2.0.0.nupkg"], { sources: ["vendor/packages/"] }) === "", "and nothing git does not know, however deep: a restore takes what the pull request shows and nothing beside it");
const inRepo = (to, text) => { fs.mkdirSync(path.dirname(path.join(repo, to)), { recursive: true }); fs.writeFileSync(path.join(repo, to), text); };
inRepo("src/App/App.csproj", "<Project />"); inRepo(L, lock(direct(["Copy.Left", "4.0.0"])));
inRepo("checks/audit.json", JSON.stringify({ entries: [] }));
inRepo("checks/licences.json", JSON.stringify({ ships: [], audit: "checks/audit.json", nuget: { ships: [L] } }));
const git = (...args) => spawnSync("git", args, { cwd: repo, env, encoding: "utf8" });
git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "a project");
const run = (...args) => { const r = spawnSync(process.execPath, [path.join(repo, "core/scripts/nuget.mjs"), ...args], { cwd: repo, env, encoding: "utf8" }); return { status: r.status, out: heard(r.stdout + r.stderr), stdout: r.stdout }; };
const left = restore("Copy.Left@4.0.0"), json = restore("Newtonsoft.Json@13.0.3");
const strict = run("checks/licences.json", "--packages", left), advisory = run("checks/licences.json", "--packages", left, "--advisory");
ok(strict.status === 1 && /^FAIL: Copy\.Left@4\.0\.0/m.test(strict.out) && mended(strict.out) && /1 failing/.test(strict.out), "run in a project, it fails where a package is off its list, saying its mend", strict.out);
ok(advisory.status === 0 && /^WOULD FAIL: Copy\.Left@4\.0\.0/m.test(advisory.out) && /Advisory: nothing fails for it yet/.test(advisory.out), "advisory, it says what it would fail, and passes", advisory.out);
ok(run("checks/licences.json").status === 1 && run("--packages", left).status === 1 && run().status === 1 && run("checks/missing.json", "--packages", left, "--advisory").status === 1, "without its config or the restore's folder it fails, advisory or not");
ok(run("--projects").status === 0 && run("--projects").stdout === "src/App/App.csproj\n", "asked for the project files, it lists what git knows, a line each, for the restore");
{
  // (a name with "%" in it holds no control character, and is listed as it stands)
  inRepo("src/100%Cover/Cover.csproj", "<Project />"); git("add", "-A");
  const listed = run("--projects");
  git("rm", "-q", "-r", "--cached", "src/100%Cover"); fs.rmSync(path.join(repo, "src/100%Cover"), { recursive: true, force: true });
  ok(listed.status === 0 && listed.stdout === "src/100%Cover/Cover.csproj\nsrc/App/App.csproj\n", "a project file whose name holds \"%\" is listed as it stands", listed.out);
}
if (process.platform !== "win32") {
  // (a name that holds "::", "##[" and a tab is refused on a line that holds none of them, each broken as nuget-look.sh
  // breaks them, so no name a pull request adds holds a runner's workflow command in the step's log; #1327)
  const odd = "a::b##[c\td";
  inRepo(`src/${odd}/App.csproj`, "<Project />"); inRepo(`build/${odd}.xml`, "<Project />"); git("add", "-A");
  const projectsRefused = run("--projects"), importsRefused = run("--imports");
  git("rm", "-q", "-r", "--cached", `src/${odd}`, `build/${odd}.xml`); fs.rmSync(path.join(repo, `src/${odd}`), { recursive: true, force: true }); fs.rmSync(path.join(repo, `build/${odd}.xml`));
  for (const [refused, named] of [[projectsRefused, `src/a: :b# #[c?d/App.csproj`], [importsRefused, `build/a: :b# #[c?d.xml`]])
    ok(refused.status === 1 && refused.stdout === "" && refused.out.startsWith("FAIL: ") && refused.out.includes(named) && !/::|##\[|\t/u.test(refused.out) && mended(refused.out),
      "a file whose name holds \"::\", \"##[\" and a control character is refused, on a line that holds none of them", refused.out);
}
ok(run("checks/licences.json", "--sources").status === 0 && run("checks/licences.json", "--sources").stdout === `${REGISTRY}\n` && run("--sources").status === 1 && run("checks/missing.json", "--sources").status === 1,
  "asked for the sources, it lists the registry and what the config names, a line each, and fails without a config it can read");
inRepo(L, lock(direct(["Newtonsoft.Json", "13.0.3"])));
const fine = run("checks/licences.json", "--packages", path.relative(repo, json));
ok(fine.status === 0 && /^1 NuGet packages in 1 lock files checked/m.test(fine.out), "a lock file edited and not yet committed is read as it stands, and the folder may be named from where it is started", fine.out);
inRepo("checks/audit.json", JSON.stringify({ entries: [{ ...hand, name: "By.File@1.0.0" }] })); inRepo(L, lock(direct(["By.File", "1.0.0"])));
inRepo("checks/licences.json", JSON.stringify({ ships: [], audit: "checks/audit.json", nuget: { tools: [L] } }));
const licences = spawnSync(process.execPath, [path.join(repo, "core/scripts/licences.mjs"), "checks/licences.json"], { cwd: repo, env, encoding: "utf8" });
ok(licences.status === 0 && run("checks/licences.json", "--packages", restore("By.File@1.0.0")).status === 0, "the licence check takes the same config and the same audit, holds the NuGet entry to its list, and leaves the rest to this check", licences.stdout + licences.stderr);

// the .user file MSBuild imports beside a project file by itself, which the check reads only lately: as the base held
// it, what it names is reported and passes; added or changed by the pull request, it fails (core archive 207)
const USER = "src/App/App.csproj.user", userText = at => `<Project><PropertyGroup><NuGetLockFilePath>${at}</NuGetLockFilePath></PropertyGroup></Project>`;
const userCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, USER], process.env, { base: "HEAD", baseConfig: null });
inRepo(USER, userText("x"));
let user = userCheck();
ok(user.failures.some(x => x.includes(`${USER} names NuGetLockFilePath`)), "a .user file the pull request adds, naming another lock file, fails", JSON.stringify(user));
git("add", "-A"); git("commit", "-q", "-m", "a .user file");
user = userCheck();
ok(!user.failures.some(x => x.includes(".user")) && user.reports.some(x => x.includes(`${USER} names NuGetLockFilePath`) && x.includes("held before this check read it")), "one the base held as it stands: reported, and passes", JSON.stringify(user));
inRepo(USER, userText("y"));
user = userCheck();
ok(user.failures.some(x => x.includes(`${USER} names NuGetLockFilePath`)), "and one the pull request changes fails", JSON.stringify(user));
// a .user file the base held beside no project file, which a pull request's new project file brings into play
const LONE = "src/Lone/Lone.csproj.user";
inRepo(LONE, userText("z")); git("add", "-A"); git("commit", "-q", "-m", "a .user file alone");
inRepo("src/Lone/Lone.csproj", "<Project />");
user = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", "src/Lone/Lone.csproj", L, LONE], process.env, { base: "HEAD", baseConfig: null });
ok(user.failures.some(x => x.includes(`${LONE} names NuGetLockFilePath`)), "a .user file the base held with no project file beside it, which the pull request adds: it fails, the pull request having brought it into play", JSON.stringify(user));
fs.rmSync(path.join(repo, "src/Lone"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "gone");
// a .user file the base held beside a folder of the project file's name, which a pull request makes a project file:
// not held; and one beside a project file named in another case, which MSBuild on Windows imports all the same: held
inRepo(LONE, userText("z")); inRepo("src/Lone/Lone.csproj/inside.md", "x\n"); git("add", "-A"); git("commit", "-q", "-m", "a folder of that name");
fs.rmSync(path.join(repo, "src/Lone/Lone.csproj"), { recursive: true }); inRepo("src/Lone/Lone.csproj", "<Project />");
user = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", "src/Lone/Lone.csproj", L, LONE], process.env, { base: "HEAD", baseConfig: null });
ok(user.failures.some(x => x.includes(`${LONE} names NuGetLockFilePath`)), "a .user file the base held beside a folder of the project file's name, which the pull request makes a project file: it fails", JSON.stringify(user));
fs.rmSync(path.join(repo, "src/Lone"), { recursive: true }); inRepo(LONE, userText("z")); inRepo("src/Lone/LONE.CSPROJ", "<Project />"); git("add", "-A"); git("commit", "-q", "-m", "another case");
user = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", "src/Lone/LONE.CSPROJ", L, LONE], process.env, { base: "HEAD", baseConfig: null });
ok(!user.failures.some(x => x.includes(LONE)) && user.reports.some(x => x.includes(`${LONE} names NuGetLockFilePath`)), "one the base held beside its project file named in another case: reported, and passes", JSON.stringify(user));
fs.rmSync(path.join(repo, "src/Lone"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "gone again");
// what stands at the project file's path at the base must be a file of its own: never a link (whose target a pull request
// may add), nor a name git reads as more than a path (a root folder named ":", which git takes for pathspec magic)
const userAt = (projectFile) => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", projectFile, L, `${projectFile}.user`], process.env, { base: "HEAD", baseConfig: null });
inRepo(LONE, userText("z")); git("add", "-A");
const target = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: repo, env, input: "elsewhere/Lone.csproj", encoding: "utf8" }).stdout.trim();
git("update-index", "--add", "--cacheinfo", `120000,${target},src/Lone/Lone.csproj`); git("commit", "-q", "-m", "a link where the project file would be");
git("rm", "-q", "--cached", "src/Lone/Lone.csproj"); inRepo("src/Lone/Lone.csproj", "<Project />");
user = userAt("src/Lone/Lone.csproj");
ok(user.failures.some(x => x.includes(`${LONE} names NuGetLockFilePath`)), "a .user file the base held beside a link of the project file's name, which the pull request makes a project file: it fails", JSON.stringify(user));
fs.rmSync(path.join(repo, "src/Lone"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "no link");
if (process.platform !== "win32") {
  // (a folder named ":" at the root: git would read ":/top/..." as the whole tree's top, where the base holds a project
  // file at top/Lone/Lone.csproj; Windows writes no such name)
  const COLON = ":/top/Lone/Lone.csproj";
  inRepo("top/Lone/Lone.csproj", "<Project />"); inRepo(`${COLON}.user`, userText("z")); git("add", "-A"); git("commit", "-q", "-m", "a folder named :");
  inRepo(COLON, "<Project />");
  user = userAt(COLON);
  ok(user.failures.some(x => x.includes(`${COLON}.user names NuGetLockFilePath`)), "a .user file the base held in a root folder named \":\", whose project file only the pull request adds: it fails, the path read as a path", JSON.stringify(user));
  fs.rmSync(path.join(repo, ":"), { recursive: true }); fs.rmSync(path.join(repo, "top"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "gone");
}
// a file an Import brings in, which the check reads only lately (#269): as the base held it, and brought it in, what it
// names is reported and passes; added, changed or brought into play by the pull request, it fails (core archive 207)
const DEPS = "build/deps.xml", depsText = `<Project><PropertyGroup><NuGetLockFilePath>x.json</NuGetLockFilePath></PropertyGroup></Project>`;
const depsCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS], process.env, { base: "HEAD", baseConfig: null });
inRepo(DEPS, depsText); inRepo("Directory.Build.props", "<Project />"); git("add", "-A"); git("commit", "-q", "-m", "a file no Import brings in");
inRepo("Directory.Build.props", `<Project><Import Project="build/deps.xml" /></Project>`);
let deps = depsCheck();
ok(deps.failures.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`)), "a file the base held that no Import brought in, which the pull request imports: it fails, the pull request having brought it into play", JSON.stringify(deps));
git("add", "-A"); git("commit", "-q", "-m", "imported");
deps = depsCheck();
const newImporter = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS, "src/Other/Other.props"], process.env, { base: "HEAD", baseConfig: null });
inRepo("src/Other/Other.props", `<Project><Import Project="../../build/deps.xml" /></Project>`);
ok(check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS, "src/Other/Other.props"], process.env, { base: "HEAD", baseConfig: null }).failures.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`)) && newImporter.failures.every(x => !x.includes(DEPS)),
  "one the base held as it stands and brought in, which the pull request imports from another file too: it fails, the pull request having brought it into play there (as a .user file beside a new project file)");
fs.rmSync(path.join(repo, "src/Other"), { recursive: true });
const listedImports = run("--imports");
ok(listedImports.status === 0 && listedImports.stdout === `${DEPS}\n`, "asked for the files Imports bring in, it lists them, a line each, for the workflow's first look", listedImports.out);
ok(!deps.failures.some(x => x.includes(DEPS)) && deps.reports.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`) && x.includes("held before this check read it")), "one the base held as it stands and brought in: reported, and passes", JSON.stringify(deps));
inRepo(DEPS, `${depsText}\n`);
deps = depsCheck();
ok(deps.failures.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`)), "the same file changed by the pull request: it fails", JSON.stringify(deps));
// a link git knows, which a build file brings in, read through to its file at the base as it is now (a checkout that keeps
// links): unchanged, reported; one whose file the pull request changes, failing
if (process.platform !== "win32") {
  fs.symlinkSync("deps.xml", path.join(repo, "build/link.xml"));
  inRepo(DEPS, depsText); inRepo("Directory.Build.props", `<Project><Import Project="build/link.xml" /></Project>`); git("add", "-A"); git("commit", "-q", "-m", "an imported link");
  const linked = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS, "build/link.xml"], process.env, { base: "HEAD", baseConfig: null });
  deps = linked();
  ok(!deps.failures.some(x => x.includes("build/link.xml")) && deps.reports.some(x => x.includes("build/link.xml, which a build file brings in, names NuGetLockFilePath") && x.includes("held before this check read it")), "an imported link the base held, leading to a file it held, both as they stand: reported, and passes", JSON.stringify(deps));
  inRepo(DEPS, `${depsText}\n`);
  deps = linked();
  ok(deps.failures.some(x => x.includes("build/link.xml, which a build file brings in, names NuGetLockFilePath")), "the same link, whose file the pull request changes: it fails", JSON.stringify(deps));
  fs.rmSync(path.join(repo, "build/link.xml"));
}
// (a checkout that writes its own line endings, core.autocrlf on Windows: the file stands as the base held it)
inRepo(DEPS, `<Project>\n${depsText}\n</Project>\n`); inRepo("Directory.Build.props", `<Project><Import Project="build/deps.xml" /></Project>`); git("add", "-A"); git("commit", "-q", "-m", "lines");
git("config", "core.autocrlf", "true"); inRepo(DEPS, `<Project>\r\n${depsText}\r\n</Project>\r\n`);
deps = depsCheck();
ok(!deps.failures.some(x => x.includes(DEPS)) && deps.reports.some(x => x.includes(DEPS) && x.includes("held before this check read it")), "one a checkout wrote with its own line endings stands as the base held it: reported, and passes", JSON.stringify(deps));
git("config", "--unset", "core.autocrlf");
fs.rmSync(path.join(repo, DEPS)); fs.rmSync(path.join(repo, "Directory.Build.props")); git("add", "-A"); git("commit", "-q", "-m", "no imports");
// a build file not plain UTF-8: one the pull request adds fails; as the base held it, reported (#272)
const wide = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<Project />", "utf16le")]);
const wideCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props"], process.env, { base: "HEAD", baseConfig: null });
inRepo("Directory.Build.props", wide);
ok(wideCheck().failures.some(x => x.startsWith("Directory.Build.props is not plain UTF-8")), "a build file in UTF-16 the pull request adds: it fails");
git("add", "-A"); git("commit", "-q", "-m", "a wide build file");
ok(!wideCheck().failures.some(x => x.includes("Directory.Build.props")) && wideCheck().reports.some(x => x.startsWith("Directory.Build.props is not plain UTF-8") && x.includes("held before this check read it")), "one the base held as it stands: reported, and passes");
fs.rmSync(path.join(repo, "Directory.Build.props")); git("add", "-A"); git("commit", "-q", "-m", "no wide file");
// a lock file naming one version by two content hashes, one under each framework: as the base held it, reported and
// passing; changed by the pull request, failing
const twoLock = JSON.stringify({ version: 1, dependencies: { "net8.0": { A: entry("Direct", "1.0.0", "[1.0.0, )") }, "net9.0": { A: { ...entry("Direct", "1.0.0", "[1.0.0, )"), contentHash: "other==" } } } });
fs.rmSync(path.join(repo, USER)); inRepo(L, twoLock); git("add", "-A"); git("commit", "-q", "-m", "a lock file with two hashes");
const lockConfig = { ships: [], nuget: { tools: [L] } };
const lockCheck = (baseConfig = lockConfig) => check(lockConfig, repo, restore(), ["src/App/App.csproj", L], process.env, { base: "HEAD", baseConfig });
let both = lockCheck();
ok(!both.failures.some(x => x.includes("two content hashes")) && both.reports.some(x => x.includes("A@1.0.0: named by two content hashes") && x.includes("held before this check read it")), "a lock file the base held as it stands, and listed, naming one version by two content hashes: reported, and passes", JSON.stringify(both));
both = lockCheck({ ships: [], nuget: { tools: [] } });
ok(both.failures.some(x => x.includes("A@1.0.0: named by two content hashes")), "the same lock file, which the pull request lists in the config for the first time: it fails, the pull request having brought it into play", JSON.stringify(both));
inRepo(L, `${twoLock}\n`);
both = lockCheck();
ok(both.failures.some(x => x.includes("A@1.0.0: named by two content hashes")), "the same lock file changed by the pull request: it fails", JSON.stringify(both));

// a .user file saved with a UTF-8 byte-order mark, as the base held it: reported, and passes (#272)
inRepo(USER, `\uFEFF${userText("bom")}`); git("add", "-A"); git("commit", "-q", "-m", "a .user file with a mark");
user = userCheck();
ok(!user.failures.some(x => x.includes(".user")) && user.reports.some(x => x.includes(`${USER} names NuGetLockFilePath`) && x.includes("held before this check read it")), "a .user file with a UTF-8 byte-order mark, as the base held it: reported, and passes", JSON.stringify(user));
fs.rmSync(path.join(repo, USER)); git("add", "-A"); git("commit", "-q", "-m", "no .user file");

// a filter the machine's git config holds (git-lfs's, on GitHub's runners), which a pull request's .gitattributes points
// at an imported file so that its own bytes would clean into the base's: the bytes MSBuild reads are compared (#272)
if (process.platform !== "win32") {
  inRepo(DEPS, "<Project />\n"); inRepo("Directory.Build.props", `<Project><Import Project="build/deps.xml" /></Project>`); git("add", "-A"); git("commit", "-q", "-m", "an imported file naming nothing");
  inRepo("base-copy.txt", "<Project />\n"); git("config", "filter.same.clean", "cat base-copy.txt");
  inRepo(".gitattributes", "build/deps.xml filter=same\n"); inRepo(DEPS, `${depsText}\n`);
  deps = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS, ".gitattributes"], process.env, { base: "HEAD", baseConfig: null });
  ok(deps.failures.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`)), "a file the pull request changes, which a filter its .gitattributes names would clean into the base's: it fails", JSON.stringify(deps));
  git("config", "--unset", "filter.same.clean"); for (const f of [".gitattributes", "base-copy.txt", DEPS, "Directory.Build.props"]) fs.rmSync(path.join(repo, f)); git("add", "-A"); git("commit", "-q", "-m", "no filter");
}
// a file the base's own .gitattributes has git write in another encoding at checkout (git's own advice for UTF-16): as
// the base held it, reported, so that a sync fails no project that changed nothing (#272)
inRepo(".gitattributes", "*.props working-tree-encoding=UTF-16LE-BOM eol=crlf\n"); inRepo("Directory.Build.props", "<Project />\n"); git("add", "-A"); git("commit", "-q", "-m", "a wide checkout");
fs.rmSync(path.join(repo, "Directory.Build.props")); git("checkout", "--", "Directory.Build.props");
const checkedOut = fs.readFileSync(path.join(repo, "Directory.Build.props"));
if (checkedOut[0] !== 0xff || checkedOut[1] !== 0xfe) console.log("skip a checkout in another encoding: this machine's git writes none");
else {
  const wideOut = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, ".gitattributes", "Directory.Build.props"], process.env, { base: "HEAD", baseConfig: null });
  ok(!wideOut.failures.some(x => x.includes("Directory.Build.props")) && wideOut.reports.some(x => x.startsWith("Directory.Build.props is not plain UTF-8") && x.includes("held before this check read it")), "a file the base's own attributes have git check out in UTF-16, unchanged: reported, and passes", JSON.stringify(wideOut));
  fs.writeFileSync(path.join(repo, "Directory.Build.props"), Buffer.concat([checkedOut, Buffer.from("<!---->", "utf16le")]));
  ok(check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, ".gitattributes", "Directory.Build.props"], process.env, { base: "HEAD", baseConfig: null }).failures.some(x => x.startsWith("Directory.Build.props is not plain UTF-8")), "the same file changed by the pull request: it fails");
}
for (const f of [".gitattributes", "Directory.Build.props"]) fs.rmSync(path.join(repo, f)); git("add", "-A"); git("commit", "-q", "-m", "no wide checkout");
// a file a property brings in, as the base held it and brought it in: reported; added by the pull request: it fails (#274)
inRepo(DEPS, `${depsText}\n`); inRepo("Directory.Build.props", "<Project />"); git("add", "-A"); git("commit", "-q", "-m", "a file no property names");
const propCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DEPS], process.env, { base: "HEAD", baseConfig: null });
inRepo("Directory.Build.props", `<Project><PropertyGroup><CustomBeforeMicrosoftCommonTargets>$(MSBuildThisFileDirectory)build/deps.xml</CustomBeforeMicrosoftCommonTargets></PropertyGroup></Project>`);
ok(propCheck().failures.some(x => x.includes(`${DEPS}, which a build file brings in, names NuGetLockFilePath`)), "a file the base held that the pull request brings in by a property: it fails");
git("add", "-A"); git("commit", "-q", "-m", "brought in by a property");
ok(!propCheck().failures.some(x => x.includes(DEPS)) && propCheck().reports.some(x => x.includes(DEPS) && x.includes("held before this check read it")), "one the base held as it stands and brought in by the same property: reported, and passes");
for (const f of [DEPS, "Directory.Build.props"]) fs.rmSync(path.join(repo, f)); git("add", "-A"); git("commit", "-q", "-m", "no property");
// a link to a device that an Import brings in: one the pull request adds fails; the same link as the base held it, reported
if (process.platform !== "win32") {
  inRepo("Directory.Build.props", `<Project><Import Project="build/dev.xml" /></Project>`); fs.mkdirSync(path.join(repo, "build"), { recursive: true }); fs.symlinkSync("/dev/null", path.join(repo, "build/dev.xml"));
  const devCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", "build/dev.xml"], process.env, { base: "HEAD", baseConfig: null });
  ok(devCheck().failures.some(x => x.startsWith("build/dev.xml, which a build file brings in, is no file of bytes")), "an imported link to a device the pull request adds: it fails, and the check does not read it");
  git("add", "-A"); git("commit", "-q", "-m", "a device link");
  ok(!devCheck().failures.some(x => x.includes("build/dev.xml")) && devCheck().reports.some(x => x.startsWith("build/dev.xml, which a build file brings in, is no file of bytes") && x.includes("held before this check read it")), "the same link as the base held it: reported, and passes");
  for (const f of ["build/dev.xml", "Directory.Build.props"]) fs.rmSync(path.join(repo, f)); git("add", "-A"); git("commit", "-q", "-m", "no device link");
}
// a project a property of the SDK's could bring in (a publish profile), read for what it is: one the pull request adds
// fails; as the base held it, reported (#283)
const PUB = "src/App/Properties/PublishProfiles/x.pubxml";
const pubCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, PUB], process.env, { base: "HEAD", baseConfig: null });
inRepo(PUB, `<Project><PropertyGroup><NuGetLockFilePath>x.json</NuGetLockFilePath></PropertyGroup></Project>`);
ok(pubCheck().failures.some(x => x.startsWith(`${PUB} names NuGetLockFilePath`)), "a project the pull request adds under any name, which no Import names: it fails, read for what it is");
git("add", "-A"); git("commit", "-q", "-m", "a publish profile");
ok(!pubCheck().failures.some(x => x.includes(PUB)) && pubCheck().reports.some(x => x.startsWith(`${PUB} names NuGetLockFilePath`) && x.includes("held before this check read it")), "the same project as the base held it: reported, and passes");
ok(run("--imports").stdout.includes(`${PUB}\n`), "and the workflow's first look is told of it, so a change to it alone is checked");
fs.rmSync(path.join(repo, "src/App/Properties"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "no publish profile");
// a file that begins as XML past the bound, unread: one the pull request adds or changes fails, and the first look is
// told of it; as the base held it, reported
{
  const BIG = "build/big.xml", bigText = `<Project><NuGetLockFilePath>x</NuGetLockFilePath></Project>${" ".repeat(1 << 24)}`;
  const bigCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, BIG], process.env, { base: "HEAD", baseConfig: null });
  inRepo(BIG, bigText); git("add", "-A");
  const added = bigCheck();
  ok(added.failures.some(x => x.startsWith(`${BIG} begins as XML and is past`) && /Mend: /.test(x)) && run("--imports").stdout.includes(`${BIG}\n`), "one past the bound the pull request adds fails with its mend, and the workflow's first look is told of it", JSON.stringify(added));
  git("commit", "-q", "-m", "a big file");
  const held = bigCheck();
  ok(!held.failures.some(x => x.includes(BIG)) && held.reports.some(x => x.startsWith(`${BIG} begins as XML and is past`) && x.includes("held before this check read it")), "the same as the base held it: reported, and passes", JSON.stringify(held));
  inRepo(BIG, `${bigText} `);
  ok(bigCheck().failures.some(x => x.startsWith(`${BIG} begins as XML and is past`)), "one changed in the checkout from what the base and git's index hold fails");
  // (an attribute of the checkout's own that would hash other bytes to the base's blob is not the base's: it fails)
  inRepo(BIG, bigText.replace("<Project>", "<Project>$Id$")); git("add", "-A"); git("commit", "-q", "-m", "a big file with an ident");
  inRepo(".gitattributes", "*.xml ident\n"); inRepo(BIG, bigText.replace("<Project>", `<Project>$Id: <Import Project="x.props" /> $`));
  ok(bigCheck().failures.some(x => x.startsWith(`${BIG} begins as XML and is past`)), "one whose bytes differ from the base's, under an attribute the base did not give it, fails", JSON.stringify(bigCheck().reports.filter(x => x.startsWith(BIG))));
  fs.rmSync(path.join(repo, ".gitattributes"));
  fs.rmSync(path.join(repo, BIG)); git("add", "-A"); git("commit", "-q", "-m", "no big file");
}
// a file a project read by what it is imports, as the base held both: reported, so that a sync fails no project that
// changed nothing (#283's security review)
const FIX = "tests/fixtures/a.xml", FIXED = "tests/fixtures/b.xml";
inRepo(FIX, `<Project><Import Project="b.xml" /></Project>`); inRepo(FIXED, "<Project><PropertyGroup><RestorePackagesPath>p</RestorePackagesPath></PropertyGroup></Project>"); git("add", "-A"); git("commit", "-q", "-m", "fixtures");
const fixCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, FIX, FIXED], process.env, { base: "HEAD", baseConfig: null });
ok(!fixCheck().failures.some(x => x.includes("tests/fixtures")) && fixCheck().reports.some(x => x.startsWith(`${FIXED}, which a build file brings in, names RestorePackagesPath`) && x.includes("held before this check read it")), "a file a project read by what it is imports, both as the base held them: reported, and passes", JSON.stringify(fixCheck()));
fs.rmSync(path.join(repo, "tests"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "no fixtures");
// a project the base held, read for what it is, which the pull request brings into play by a property of the SDK's or of
// its own: it fails, as a file a pull request brings into play does (core archive 207; #283's security review)
const DORMANT = "build/dormant.xml";
inRepo(DORMANT, "<Project><PropertyGroup><RestoreAdditionalProjectFallbackFolders>f</RestoreAdditionalProjectFallbackFolders></PropertyGroup></Project>"); inRepo("Directory.Build.props", "<Project />"); git("add", "-A"); git("commit", "-q", "-m", "a dormant project");
const dormant = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", DORMANT], process.env, { base: "HEAD", baseConfig: null });
ok(!dormant().failures.some(x => x.includes(DORMANT)), "a dormant project the base held, which nothing brings in, unchanged: it does not fail");
const intoPlay = (prop) => { inRepo("Directory.Build.props", `<Project><PropertyGroup><${prop}>$(MSBuildThisFileDirectory)build/dormant.xml</${prop}></PropertyGroup></Project>`); return dormant().failures.some(x => x.startsWith(`${DORMANT}, which a build file brings in, names RestorePackagesPath`)); };
ok(["AfterMicrosoftNETSdkTargets", "BeforeMicrosoftNETSdkTargets", "CustomAfterRazorSdkTargets", "MyOwnHook"].every(intoPlay), "the same project, which the pull request brings into play by a property of the SDK's or one of its own: it fails");
for (const f of [DORMANT, "Directory.Build.props"]) fs.rmSync(path.join(repo, f)); git("add", "-A"); git("commit", "-q", "-m", "no dormant project");
// a config that leads to a device: failed with its reason, never read (#283's security review)
if (process.platform !== "win32") {
  fs.symlinkSync("/dev/zero", path.join(repo, "checks/dev.json"));
  const devConfig = run("checks/dev.json", "--packages", restore());
  ok(devConfig.status === 1 && /checks\/dev\.json is no file of bytes/.test(devConfig.out), "a config that leads to a device fails with its reason, and is never read", devConfig.out);
  fs.rmSync(path.join(repo, "checks/dev.json"));
}
// a project of another kind's .user file (x.vcxproj.user), read for what it is, as the base held it: reported, the rule
// for a .NET project's .user file not its (#283's security review)
const VCX = "native/x.vcxproj.user";
inRepo(VCX, "<Project><PropertyGroup><RestorePackagesPath>p</RestorePackagesPath></PropertyGroup></Project>"); git("add", "-A"); git("commit", "-q", "-m", "a vcxproj.user");
const vcx = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, VCX], process.env, { base: "HEAD", baseConfig: null });
ok(!vcx.failures.some(x => x.includes(VCX)) && vcx.reports.some(x => x.startsWith(`${VCX} names RestorePackagesPath`) && x.includes("held before this check read it")), "a project of another kind's .user file, as the base held it with no project file beside it: reported, and passes", JSON.stringify(vcx));
fs.rmSync(path.join(repo, "native"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "no vcxproj.user");
// a submodule an Import names, as the base held it: reported, so that a sync fails no project that changed nothing (#283)
inRepo("Directory.Build.props", `<Project><Import Project="ext/lib" Condition="false" /></Project>`); fs.mkdirSync(path.join(repo, "ext/lib"), { recursive: true });
git("update-index", "--add", "--cacheinfo", `160000,${git("rev-parse", "HEAD").stdout.trim()},ext/lib`);
const subCheck = () => check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "Directory.Build.props", "ext/lib"], process.env, { base: "HEAD", baseConfig: null });
ok(subCheck().failures.some(x => x.startsWith("ext/lib, which a build file brings in, is no file of bytes")), "a submodule the pull request adds and imports: it fails");
git("add", "Directory.Build.props"); git("commit", "-q", "-m", "a submodule imported");
ok(!subCheck().failures.some(x => x.includes("ext/lib")) && subCheck().reports.some(x => x.startsWith("ext/lib, which a build file brings in, is no file of bytes") && x.includes("held before this check read it")), "the same submodule as the base held it: reported, and passes", JSON.stringify(subCheck()));
git("rm", "-q", "--cached", "ext/lib"); fs.rmSync(path.join(repo, "ext"), { recursive: true }); fs.rmSync(path.join(repo, "Directory.Build.props")); git("add", "-A"); git("commit", "-q", "-m", "no submodule");
// a lock file or a tools manifest that leads to a device: failed with its reason, never read (#283)
if (process.platform !== "win32") {
  const DEV = "dev/Dev/packages.lock.json"; inRepo("dev/Dev/Dev.csproj", "<Project />"); fs.symlinkSync("/dev/zero", path.join(repo, DEV)); fs.symlinkSync("/dev/zero", path.join(repo, "dev/dotnet-tools.json"));
  const devLock = check({ ships: [], nuget: { tools: [DEV] } }, repo, restore(), ["dev/Dev/Dev.csproj", DEV, "dev/dotnet-tools.json"], process.env, { base: "HEAD", baseConfig: null, fetched: true });
  ok(devLock.failures.some(x => x.startsWith(`${DEV} is no file of bytes`)) && devLock.failures.some(x => x.startsWith("dev/dotnet-tools.json is no file of bytes")), "a lock file or a tools manifest that leads to a device fails with its reason, and is never read", JSON.stringify(devLock));
  fs.rmSync(path.join(repo, "dev"), { recursive: true });
}
// a .user file not plain UTF-8, which the base held beside no project file and the pull request brings into play with
// one: it fails, as any .user file so brought (#272)
const WIDE_USER = "src/Wide/Wide.csproj.user";
inRepo(WIDE_USER, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<Project />", "utf16le")])); git("add", "-A"); git("commit", "-q", "-m", "a wide .user file alone");
inRepo("src/Wide/Wide.csproj", "<Project />");
user = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), ["src/App/App.csproj", L, "src/Wide/Wide.csproj", WIDE_USER], process.env, { base: "HEAD", baseConfig: null });
ok(user.failures.some(x => x.startsWith(`${WIDE_USER} is not plain UTF-8`)), "a .user file not plain UTF-8, held beside no project file, which the pull request brings into play: it fails", JSON.stringify(user));
fs.rmSync(path.join(repo, "src/Wide"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "no wide .user file");

// read for one project's restore (--lock), each into a folder of its own: what only another project's lock file names
// is read where that one is restored, what this one's names must stand here, and no accepted version is found stale;
// a lock file the config does not name fails, and the flag stands only beside --restored
{
  put(L, lock(direct(["Newtonsoft.Json", "13.0.3"]))); put(T, lock(direct(["Weak.Copy", "2.1.0"]))); put("checks/audit.json", JSON.stringify({ entries: [] }));
  const cfg = { ships: [], audit: "checks/audit.json", nuget: { ships: [L], tools: [T], accepted: [accepted("Weak.Copy", "2.1.0", "LGPL-3.0-only", { ships: false })] } };
  const one = (lockFile) => check(cfg, tmp, restore("Newtonsoft.Json@13.0.3"), TRACKED, process.env, { restored: true, lock: lockFile });
  const whole = one(null), first = one(L), second = one(T), other = one("src/Other/packages.lock.json");
  ok(first.failures.length === 0 && whole.failures.some(x => x.startsWith("Weak.Copy@2.1.0") && x.includes("not in the restore's folder")), "read for one project's restore, a package only another's lock file names is left to that one's read, where a read of the whole fails it", JSON.stringify({ first, whole }));
  ok(second.failures.length === 1 && second.failures[0].startsWith(`Weak.Copy@2.1.0 (${T}): its manifest is not in the restore's folder`), "and one its own lock file names must stand in its folder", JSON.stringify(second));
  ok(other.failures.some(x => x.startsWith("src/Other/packages.lock.json, the lock file this read is for, is none the config names. Mend: ")), "a lock file the config does not name fails", JSON.stringify(other));
  const rsp = [...TRACKED, "Directory.Build.rsp"], tree = (lockFile) => check(cfg, tmp, restore("Newtonsoft.Json@13.0.3"), rsp, process.env, { restored: true, lock: lockFile }).failures.filter(x => x.startsWith("Directory.Build.rsp"));
  ok(tree(null).length === 1 && tree(L).length === 0 && tree(T).length === 0, "what the tree alone fails is said by a read of the whole, and by no read for one project's restore", JSON.stringify([tree(null), tree(L)]));
  // (a lock file's own faults: a read for one project's restore says its own lock file's, and leaves another's to that one's)
  put(L, lock({ ...direct(["Newtonsoft.Json", "13.0.3"]), Odd: { type: "Odd" } })); put(T, lock({ ...direct(["Weak.Copy", "2.1.0"]), Odder: { type: "Odd" } }));
  const kinds = (lockFile) => one(lockFile).failures.filter(x => x.includes("a kind of entry this check does not know"));
  ok(kinds(L).length === 1 && kinds(L)[0].startsWith(L) && kinds(T).length === 1 && kinds(T)[0].startsWith(T) && kinds(null).length === 2, "read for one project's restore, its own lock file's faults are said and another's are not, which a read of the whole says", JSON.stringify([kinds(L), kinds(T)]));
  put(L, lock(direct(["Newtonsoft.Json", "13.0.3"]))); put(T, lock(direct(["Weak.Copy", "2.1.0"])));
  // (a tools manifest that is no file of bytes, a fault of the tree's: said by a read of the whole alone)
  if (process.platform !== "win32") {
    fs.mkdirSync(path.join(tmp, ".config"), { recursive: true }); fs.symlinkSync("/dev/null", path.join(tmp, ".config/dotnet-tools.json"));
    const manifest = (lockFile) => check(cfg, tmp, restore("Newtonsoft.Json@13.0.3"), [...TRACKED, ".config/dotnet-tools.json"], process.env, { restored: true, lock: lockFile }).failures.filter(x => x.startsWith(".config/dotnet-tools.json is no file of bytes"));
    ok(manifest(null).length === 1 && manifest(L).length === 0 && manifest(T).length === 0, "a tools manifest that is no file of bytes is said by a read of the whole, and by no read for one project's restore", JSON.stringify([manifest(null), manifest(L)]));
    fs.rmSync(path.join(tmp, ".config"), { recursive: true });
  }
  const bare = spawnSync(process.execPath, [path.join(here, "nuget.mjs"), "checks/licences.json", "--packages", "x", "--lock", L], { cwd: tmp, encoding: "utf8" });
  ok(bare.status === 1 && heard(bare.stdout + bare.stderr).includes("--lock was given without --restored"), "--lock without --restored is refused, saying its mend", bare.stdout + bare.stderr);
}
// what the read before the restore does not read in a build file: each target, task, and item that downloads a package
// or names a pack the SDK downloads, whole, and an SDK taken from a package, by its tag; none in a comment
{
  const forms = formsIn(`<Project Sdk="Microsoft.NET.Sdk"><!-- <Target Name="Old" /> --><ItemGroup><PackageReference Include="A" Version="1.0.0" /><PackageDownload Include="B" Version="[1.0.0]" />
    <packagedownload Include="C"><Version>[2.0.0]</Version></packagedownload><KnownFrameworkReference Include="F" TargetingPackName="P" /><DotNetCliToolReference Include="T" Version="1.0.0" /></ItemGroup>
    <Target Name="Hook" BeforeTargets="CollectPackageDownloads"><!-- </Target> --><CreateItem Include="D"><Output TaskParameter="Include" ItemName="$(N)" /></CreateItem></Target>
    <UsingTask TaskName="X" TaskFactory="RoslynCodeTaskFactory"><Task><![CDATA[ </UsingTask> ]]></Task></UsingTask><Import Project="Sdk.props" Sdk="S" Version="1.0.0" /><Import Project="Sdk.props" Sdk="Microsoft.NET.Sdk" /><Sdk Name="E" Version="2.0.0" /><Sdk Name="Microsoft.NET.Sdk.Web" /></Project>`);
  ok(forms.length === 8 && forms[0] === '<PackageDownload Include="B" Version="[1.0.0]" />' && forms[1] === '<packagedownload Include="C"><Version>[2.0.0]</Version></packagedownload>' && forms[4].startsWith('<Target Name="Hook"') && forms[4].endsWith("</CreateItem></Target>") && forms[5].endsWith("]]></Task></UsingTask>")
    && forms[6] === '<Import Project="Sdk.props" Sdk="S" Version="1.0.0" />' && forms[7] === '<Sdk Name="E" Version="2.0.0" />' && !forms.some(x => x.includes("Old") || x.includes("PackageReference") || x.includes("Microsoft.NET.Sdk")),
    "a download, a pack named, a tool, a target and a task are read whole, an end tag in a comment or CDATA no end, and an SDK with a version by its tag; a package reference, an SDK of the SDK's own and a comment are none", JSON.stringify(forms));
  ok(formsIn(`<Project><PropertyGroup><RestoreUseStaticGraphEvaluation>true</RestoreUseStaticGraphEvaluation><nugetconsoleprocessfilename>$(X)</nugetconsoleprocessfilename><RestoreSources>x</RestoreSources></PropertyGroup></Project>`).join("|")
    === "<RestoreUseStaticGraphEvaluation>true</RestoreUseStaticGraphEvaluation>|<nugetconsoleprocessfilename>$(X)</nugetconsoleprocessfilename>", "the settings that turn the restore to the way that starts a process a property names are each read whole, whatever their value or case");
  ok(formsIn(`<Project><PropertyGroup><RestoreTaskAssemblyFile>x.dll</RestoreTaskAssemblyFile><MSBuildProjectExtensionsPath>ext/</MSBuildProjectExtensionsPath><baseintermediateoutputpath>o/</baseintermediateoutputpath><ArtifactsPath>a/</ArtifactsPath><OutputPath>bin/</OutputPath></PropertyGroup></Project>`).length === 4,
    "the setting that names what the restore loads, and those that move the folder a build imports a project's generated files from, are each read whole, whatever their value or case");
  ok(formsIn(`<Project Sdk="Microsoft.NET.Sdk;My.Sdk/1.0.0">`).length === 1 && formsIn(`<Project><Target Name="T"><Exec Command="x" />`).join() === '<Target Name="T"><Exec Command="x" />' && formsIn(`<Project><Target Name="A"><Target Name="B" /></Target><Target Name="C" /></Project>`).length === 2,
    "a project's SDK from a package is one, a target with no end is read to the file's, and one inside another is part of it");
  ok(formsIn(`<Project><ItemGroup><_PackageToDownload Include="P" Version="1.0.0" /></ItemGroup><Import Project="Sdk.props" Sdk="S" MinimumVersion="1.0" /></Project>`).length === 2, "an item the SDK downloads by, and an Import of an SDK by its least version, are forms");
  const json = (text) => globalForms(Buffer.from(text));
  ok(json(`{ "sdk": { "version": "8.0.100", "rollForward": "latestFeature", "allowPrerelease": false } }`).length === 0 && json(`{ "msbuild-sdks": { "My.Sdk": "1.0.0" } }`).join() === 'msbuild-sdks: {"My.Sdk":"1.0.0"}'
    && json(`{ "sdk": { "version": "10.0.100", "paths": [".dotnet", "$host$"], "Version": "x" } }`).join("|") === 'sdk.paths: [".dotnet","$host$"]|sdk.Version: "x"' && json(`{ "SDK": {}, "sdk": "x" }`).join("|") === 'SDK: {}|sdk: "x"',
    "a global.json's every key but the SDK's own version, roll-forward and pre-release, by their exact names, is a form, its value whole");
  const whole = json(`{ // a comment\n "sdk": {} }`);
  ok(whole.length === 1 && /^a global\.json this check does not read whole, its bytes' sha256 [0-9a-f]{64}$/.test(whole[0]) && json(`{ // a comment\n "sdk": {}, "msbuild-sdks": {} }`)[0] !== whole[0]
    && json(`{ "sdk": {}, "sdk": { "paths": ["x"] } }`)[0].startsWith("a global.json this check does not read whole") && json(`{ "a": { "k": 1, "k": 2 } }`)[0].startsWith("a global.json this check does not read whole")
    && globalForms(Buffer.from([0xff, 0xfe, 0x7b, 0])).length === 1 && globalForms(NOT_A_FILE).join() === "a global.json this check does not read whole, no file of bytes" && json(`{ "a": ["k", "k"], "b": "{\\"k\\": 1, \\"k\\": 2}" }`).length === 2,
    "one not JSON, not plain UTF-8, no file, or writing a key twice in one object is one line naming its bytes' hash, so any change to it is another line");
  ok(throws(() => nugetConfig({ nuget: { unread: [] } })) && throws(() => nugetConfig({ nuget: { unread: { "a.props": [] } } })) && throws(() => nugetConfig({ nuget: { unread: { "a.props": [" "] } } })) && nugetConfig({ nuget: { unread: { "a.props": ["imports x"] } } }).unread["a.props"].length === 1,
    "the config's \"nuget.unread\" is a map from a file to the lines of the forms declared there");
}
// with a base: a form the pull request adds fails with its mend; one the base held in the same file, or one the
// config's "nuget.unread" declares word for word, is reported and passes; a line declared that no form matches fails;
// with no base, each is reported; after the restore, which the read before it held them in, none is read
{
  const DBP = "Directory.Build.props", tracked = ["src/App/App.csproj", L, DBP, "global.json"];
  // (the failures of the forms alone: the lock file this repository holds by now is no part of the case)
  const formCheck = (unread, base = "HEAD") => { const x = check({ ships: [], nuget: { tools: [L], ...(unread ? { unread } : {}) } }, repo, restore(), tracked, process.env, { base, baseConfig: null, fetched: true }); return { ...x, failures: x.failures.filter(f => !f.startsWith(L)) }; };
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup></Project>`); inRepo("global.json", `{ "sdk": { "version": "8.0.100" } }`); git("add", "-A"); git("commit", "-q", "-m", "a build file");
  const DOWNLOAD = `<PackageDownload Include="Some.Pkg" Version="[1.0.0]" />`, IMPORT = `<Import Project="$(Elsewhere)/more.props" />`;
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup><ItemGroup>${DOWNLOAD}</ItemGroup>${IMPORT}</Project>`); inRepo("global.json", `{ "msbuild-sdks": { "My.Sdk": "1.0.0" } }`);
  let r = formCheck();
  // (each form's line, as its failure prints it, which declares it)
  const first = r, lineOf = (text) => first.failures.map(x => { const m = /in "nuget\.unread" \(its "nuget": \{ "unread": \{ "<file>": \[<lines>\] \} \}\), under "[^"]+", this exact line: (".*")\. The line stands for /.exec(x); return m && JSON.parse(m[1]); }).find(l => l?.startsWith(text));
  ok(r.failures.some(x => x.startsWith(`${DBP} holds what the read before the restore does not follow`) && x.includes(DOWNLOAD) && x.includes('"nuget.unread"')) && r.failures.some(x => x.startsWith(`${DBP} imports $(Elsewhere)/more.props, a file whose path this check cannot know without the build`))
    && r.failures.some(x => x.startsWith('global.json holds what the read before the restore does not read') && x.includes('msbuild-sdks: {"My.Sdk":"1.0.0"}')) && /^<PackageDownload Include="Some.Pkg" Version="\[1\.0\.0\]" \/> \(its text's sha256 [0-9a-f]{64}\)$/.test(lineOf("<PackageDownload")),
    "a download, an Import the check cannot follow and an SDK from a package that the pull request adds each fail, saying the line that declares it", JSON.stringify(r));
  const atPath = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), tracked, process.env, { base: "HEAD", baseConfig: null, fetched: true, configPath: "checks/licences.json" }).failures.filter(x => !x.startsWith(L));
  ok(atPath.length === 3 && atPath.every(x => x.includes(`add to checks/licences.json, the licence check's config, in "nuget.unread"`) && x.includes("The line stands for the form as it is written, so any change to it needs a line of its own")), "each names the config's file it is declared in", JSON.stringify(atPath));
  r = formCheck(null, null);
  ok(r.failures.length === 0 && r.reports.filter(x => x.includes("(reported, and passes)")).length >= 3, "with no base, each is reported and passes", JSON.stringify(r));
  const after = check({ ships: [], nuget: { tools: [L], unread: { "src/Gone.props": ["imports x"] } } }, repo, restore(), tracked, process.env, { base: null, baseConfig: null, restored: true });
  ok(!after.failures.some(x => x.includes("nuget.unread")) && !after.reports.some(x => x.includes(DOWNLOAD) || x.includes("more.props") || x.includes("My.Sdk")), "after the restore, no form is read again, nor a line declared", JSON.stringify(after));
  const DECLARED = lineOf("<PackageDownload");
  r = formCheck({ [DBP]: [DECLARED.replace(" ", "  "), `imports  $(Elsewhere)/more.props`], "global.json": ['msbuild-sdks: {"My.Sdk":"1.0.0"}'] });
  ok(r.failures.length === 0 && r.reports.filter(x => x.includes(`(declared in the config's "nuget.unread": reported, and passes)`)).length === 3, "each declared word for word, its blanks aside, is reported and passes", JSON.stringify(r));
  r = formCheck({ [DBP]: [DECLARED, DECLARED, "imports $(Elsewhere)/more.props"], "global.json": ['msbuild-sdks: {"My.Sdk":"1.0.0"}'], "src/Gone.props": ["imports x"], toString: ["imports y"] });
  ok(r.failures.filter(x => x.startsWith(`the config's "nuget.unread" declares, for`)).length === 3 && r.failures.every(x => x.startsWith(`the config's "nuget.unread" declares, for`)), "a line declared that no form matches fails, one declared twice for one form and one for a file with none, whatever its name", JSON.stringify(r));
  // (a form whose text differs from the one declared only in a line break where a blank stood is another form)
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup><ItemGroup>${DOWNLOAD.replace(" Version", "\nVersion")}</ItemGroup>${IMPORT}</Project>`);
  r = formCheck({ [DBP]: [DECLARED, "imports $(Elsewhere)/more.props"], "global.json": ['msbuild-sdks: {"My.Sdk":"1.0.0"}'] });
  ok(r.failures.some(x => x.includes("Some.Pkg") && x.includes("Mend: ")) && r.failures.some(x => x.includes(`declares, for ${DBP}, ${DECLARED}`)), "a form that differs from the one declared only where a blank became a line break is another form, and fails", JSON.stringify(r));
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup><ItemGroup>${DOWNLOAD}</ItemGroup>${IMPORT}</Project>`);
  git("add", "-A"); git("commit", "-q", "-m", "forms");
  r = formCheck();
  ok(r.failures.length === 0 && r.reports.filter(x => x.includes("held before this check read it")).length === 3, "the same forms, as the base held them in the same files: reported, and pass", JSON.stringify(r));
  const TARGET = `<Target Name="Hook" BeforeTargets="CollectPackageDownloads"><ItemGroup><PackageDownload Include="Other.Pkg" Version="[2.0.0]" /></ItemGroup></Target>`;
  inRepo(DBP, `<Project><PropertyGroup><X>2</X></PropertyGroup><ItemGroup>${DOWNLOAD}</ItemGroup>${IMPORT}${TARGET}</Project>`);
  r = formCheck();
  ok(r.failures.length === 1 && r.failures[0].includes(TARGET) && r.reports.filter(x => x.includes("held before this check read it")).length === 3, "a target the pull request adds beside them fails, read whole, while what the base held still passes", JSON.stringify(r));
  // (a form moved to another file, a second copy of one the base held, and a setting of the SDK's beyond its version,
  // each fail; what the base held stays held)
  const OTHER = "build/Other.props", withOther = [...tracked, OTHER];
  const otherCheck = () => { const x = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), withOther, process.env, { base: "HEAD", baseConfig: null, fetched: true }); return x.failures.filter(f => !f.startsWith(L)); };
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup>${IMPORT}</Project>`); inRepo(OTHER, `<Project><ItemGroup>${DOWNLOAD}</ItemGroup></Project>`);
  let fails = otherCheck();
  ok(fails.length === 1 && fails[0].startsWith(`${OTHER} holds`) && fails[0].includes("Some.Pkg"), "a form moved to another file fails there", JSON.stringify(fails));
  fs.rmSync(path.join(repo, OTHER));
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup><ItemGroup>${DOWNLOAD}${DOWNLOAD}</ItemGroup>${IMPORT}</Project>`);
  fails = formCheck().failures;
  ok(fails.length === 1 && fails[0].includes("Some.Pkg"), "a second copy of a form the base held once fails, the first held", JSON.stringify(fails));
  inRepo(DBP, `<Project><PropertyGroup><X>1</X></PropertyGroup><ItemGroup>${DOWNLOAD}</ItemGroup>${IMPORT}</Project>`);
  inRepo("global.json", `{ "msbuild-sdks": { "My.Sdk": "1.0.0" }, "sdk": { "version": "10.0.100", "paths": [".dotnet", "$host$"] } }`);
  fails = formCheck().failures;
  ok(fails.length === 1 && fails[0].startsWith("global.json holds") && fails[0].includes('sdk.paths: [".dotnet","$host$"]'), "a global.json's folder of SDKs that the pull request adds fails, its SDK's version passing", JSON.stringify(fails));
  inRepo("global.json", `{ "msbuild-sdks": { "My.Sdk": "1.0.0" } }`);
  // (where the project has no .NET project file, no restore runs: no form is read)
  inRepo(DBP, `<Project><Target Name="New" /></Project>`); git("rm", "-q", "--cached", "src/App/App.csproj");
  const noProject = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), [L, DBP], process.env, { base: "HEAD", baseConfig: null, fetched: true }).failures.filter(f => !f.startsWith(L));
  git("add", "src/App/App.csproj");
  ok(noProject.length === 0, "with no .NET project file, a form the pull request adds fails nothing", JSON.stringify(noProject));
  inRepo(DBP, `<Project><!DOCTYPE p><X /></Project>`);
  inRepo("build/Typed.props", `<!DOCTYPE p [<!ENTITY e "x">]><Project />`);
  r = check({ ships: [], nuget: { tools: [L] } }, repo, restore(), [...tracked, "build/Typed.props"], process.env, { base: "HEAD", baseConfig: null, fetched: true });
  ok(r.failures.some(x => x.startsWith("build/Typed.props has a document type, so this check does not read its Imports, nor what they bring in. Mend: ")), "a build file with a document type that the pull request adds fails", JSON.stringify(r));
  fs.rmSync(path.join(repo, "build/Typed.props")); fs.rmSync(path.join(repo, DBP)); fs.rmSync(path.join(repo, "global.json")); git("add", "-A"); git("commit", "-q", "-m", "no forms");
}
// a file whose root element is a Project, in UTF-16 or UTF-32 with no byte-order mark, which a reader of XML knows by
// its first "<" and the NULs beside it, is read as one by what it is, so that the first look diffs it too
put("build/wide.xml", Buffer.from(`<?xml version="1.0"?><Project />`, "utf16le")); put("build/wider.xml", Buffer.from(`<?xml version="1.0"?><Project />`, "utf16le").swap16());
put("build/widest.xml", Buffer.concat([...`<?xml version="1.0"?><Project />`].map(ch => { const b = Buffer.alloc(4); b.writeUInt32LE(ch.codePointAt(0)); return b; })));
ok(projectFilesByContent(tmp, ["build/wide.xml", "build/wider.xml", "build/widest.xml"]).length === 3, "a project in UTF-16 or UTF-32 with no byte-order mark is read as one by what it is");

{
  // (read once, however many comments it holds: past a second here, it would read the text again for each)
  const from = Date.now(), many = expression(nuspec(`${"<!-- a note -->".repeat(50000)}<license type="expression">MIT</license>`));
  ok(many === "MIT" && Date.now() - from < 5000, "a manifest of many comments is read in one pass", `${many}, ${Date.now() - from} ms`);
}
if (process.platform !== "win32") {
  // (after a restore, --restored: on a merge, as a pull request's checkout holds it, no git command the check runs names
  // either parent, since what git reads the base by is the restore's to write; without it, the base is read, as before
  // a restore; a stand-in for git on the PATH records each command, then runs git's own)
  inRepo(L, lock(direct(["Newtonsoft.Json", "13.0.3"]))); inRepo("checks/audit.json", JSON.stringify({ entries: [] })); inRepo("checks/licences.json", JSON.stringify({ ships: [], audit: "checks/audit.json", nuget: { ships: [L] } }));
  git("add", "-A"); git("commit", "-q", "-m", "the base"); git("switch", "-q", "-c", "side"); inRepo("README.md", "a change\n"); git("add", "-A"); git("commit", "-q", "-m", "the change");
  git("switch", "-q", "main"); git("merge", "-q", "--no-ff", "-m", "the merge", "side");
  const bin = path.join(tmp, "git-bin"), logged = path.join(tmp, "git.log"), real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${logged}'\nexec '${real}' "$@"\n`, { mode: 0o755 });
  const parents = git("rev-parse", "HEAD^1", "HEAD^2").stdout.trim().split("\n");
  const traced = (...more) => {
    fs.rmSync(logged, { force: true });
    const r = spawnSync(process.execPath, [path.join(repo, "core/scripts/nuget.mjs"), "checks/licences.json", "--packages", json, ...more], { cwd: repo, env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}` }, encoding: "utf8" });
    const lines = fs.existsSync(logged) ? fs.readFileSync(logged, "utf8").split("\n").filter(Boolean) : [];
    return { status: r.status, out: heard(r.stdout + r.stderr), named: lines.filter(l => /HEAD\^/.test(l) || parents.some(p => l.includes(p))), lines };
  };
  const after = traced("--restored"), before = traced(), both = traced("--restored", "--fetched");
  ok(both.status === 1 && /--restored and --fetched were both given.*Mend: /.test(both.out), "--restored beside --fetched is refused, saying its mend", both.out);
  ok(after.status === 0 && after.lines.length > 0 && after.named.length === 0 && before.status === 0 && before.named.length > 0,
    "after a restore (--restored), no git command the check runs names a parent of the merge; without it, the base is read", JSON.stringify({ after: after.named, before: before.named, out: after.out }));
}
if (process.platform !== "win32") {
  // (the script whole, on a merge as a pull request's checkout holds it, its base the merge's first parent: a target the
  // base held passes, reported, where the pull request changes another file, as on a sync or a project's daily try;
  // one the pull request adds fails)
  const CS = "src/App/App.csproj", gen = `<Target Name="Gen" BeforeTargets="Build"><Exec Command="echo" /></Target>`;
  inRepo(CS, `<Project Sdk="Microsoft.NET.Sdk">${gen}</Project>`); git("add", "-A"); git("commit", "-q", "-m", "a target at the base");
  const merged = (name, write) => { git("switch", "-q", "-c", name); write(); git("add", "-A"); git("commit", "-q", "-m", name); git("switch", "-q", "main"); git("merge", "-q", "--no-ff", "-m", `merge ${name}`, name); return run("checks/licences.json", "--packages", json); };
  const held = merged("other-file", () => inRepo("README.md", "another change\n"));
  ok(held.status === 0 && held.out.includes(`REPORT: ${CS} holds what the read before the restore does not follow`) && held.out.includes("held before this check read it"), "on a merge, a target the base held, beside a change to another file, passes reported", held.out);
  const added = merged("new-target", () => inRepo(CS, `<Project Sdk="Microsoft.NET.Sdk">${gen}<Target Name="More" AfterTargets="Build" /></Project>`));
  ok(added.status === 1 && /<Target Name="More" AfterTargets="Build" \/> \(its text's sha256 [0-9a-f]{64}\)\. Mend: /.test(added.out), "and a target the pull request adds beside it fails, saying its mend", added.out);
}
ok(unsaid.length === 0, "each failure read in this test says its mend", unsaid.join("\n"));
console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the NuGet check`);
process.exit(failed ? 1 : 0);
