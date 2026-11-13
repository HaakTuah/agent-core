// Tests of the NuGet check (nuget.mjs): the config's "nuget", what a lock file installs and asks for, the licence a
// package's manifest names, and the check whole on a scratch project with lock files, a restore's folder and an
// audit, all written here. No network and no .NET SDK: the real ones are tried by init-dotnet-test.mjs. Node's own
// modules only.
//
//   node scripts/nuget-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, lockPackages, manifestLicence, nugetConfig } from "./nuget.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const throws = fn => { try { fn(); return false; } catch { return true; } };

// the config's "nuget"
const L = "src/App/packages.lock.json", T = "tests/App.Tests/packages.lock.json";
ok(nugetConfig({ nuget: { ships: [L], tools: [T] } }).ships.join() === L && nugetConfig({ nuget: {} }).tools.length === 0 && nugetConfig({ nuget: { ships: ["packages.lock.json"] } }).ships.length === 1, "lock files are named as those of what ships and those of tools, either list left out where it is empty");
ok(throws(() => nugetConfig({})) && throws(() => nugetConfig({ nuget: [] })) && throws(() => nugetConfig({ nuget: { ships: [L], other: 1 } })), "a config without it, or with a key it does not know, stops the check");
ok([["src/App/App.csproj"], ["./src/App/packages.lock.json"], ["/abs/packages.lock.json"], ["../packages.lock.json"], ["src//packages.lock.json"], [5], "x"].every(v => throws(() => nugetConfig({ nuget: { ships: v } }))), "a lock file is named as git lists it, inside the project, and is a lock file");
ok(throws(() => nugetConfig({ nuget: { ships: [L], tools: [L] } })) && throws(() => nugetConfig({ nuget: { ships: [L, L] } })), "one named twice stops the check");
const yes = { package: "Odd.Pkg@1.0.0", licence: "LGPL-3.0-only", yes: "the owner, 13 November 2026: take it" };
ok(nugetConfig({ nuget: { accepted: [yes] } }).accepted.length === 1 && [[{ ...yes, yes: "" }], [{ ...yes, package: "Odd.Pkg" }], [{ ...yes, more: 1 }], [{ package: "A@1", licence: "x" }], ["A@1"], {}].every(a => throws(() => nugetConfig({ nuget: { accepted: a } }))),
  "an accepted package names its exact version, what it is under and the owner's words, and nothing else");

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

// a manifest's licence
const nuspec = (inner, more = "") => `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">\n  <metadata>\n    <id>A</id>\n    <version>1.0.0</version>\n    ${inner}\n    <description>x &gt; y</description>\n    <dependencies><group targetFramework="net8.0"><dependency id="B" version="1.0.0" exclude="Build,Analyzers" /></group></dependencies>\n  </metadata>\n  ${more}\n</package>`;
const expression = text => manifestLicence(text).expression, other = text => manifestLicence(text).other;
ok(expression(nuspec(`<license type="expression">MIT</license>`)) === "MIT" && expression(nuspec(`<license type='expression' version="1.0.0"> Apache-2.0 OR MIT </license><licenseUrl>https://licenses.nuget.org/MIT</licenseUrl>`)) === "Apache-2.0 OR MIT" && expression(nuspec(`<license type="expression">MIT</license>`).replace(/\n/g, "\r\n")) === "MIT",
  "a manifest that names its licence as an expression gives it, whatever its quotes, its line endings, or the address beside it");
ok(other(nuspec(`<license type="file">LICENSE.txt</license>`)) === "a licence file" && other(nuspec(`<licenseUrl>https://example.invalid/licence</licenseUrl>`)) === "an address" && other(nuspec("")) === "nothing", "one that names a licence file, an address or nothing has no licence a machine can read, and says which");
ok(other(nuspec(`<!-- <license type="expression">MIT</license> --><licenseUrl>u</licenseUrl>`)) === "an address" && other(nuspec(`<title><![CDATA[<license type="expression">MIT</license>]]></title>`)) === "nothing" && other(nuspec(`<?pi <license type="expression">MIT</license> ?>`)) === "nothing",
  "a licence written in a comment, in CDATA or in a processing instruction is no licence");
ok(other(nuspec(`<repository type="git"><license type="expression">MIT</license></repository>`)) === "nothing" && other(nuspec("", `<license type="expression">MIT</license>`)) === "nothing" && other(nuspec(`<n:license type="expression">MIT</n:license>`)) === "nothing",
  "nor is one that stands anywhere but directly under the manifest's metadata");
ok(other(nuspec(`<license type="expression">MIT</license><license type="expression">GPL-3.0-only</license>`)) === "a manifest with two licences" && other(`<!DOCTYPE package [<!ENTITY l "MIT">]>${nuspec(`<license type="expression">&l;</license>`)}`) === "a manifest it will not read",
  "two licences, or a document type, give none it will trust");
ok([nuspec(`<license type="expression">MIT &amp; more</license>`), nuspec(`<license type="expression"></license>`), nuspec(`<license>MIT</license>`), nuspec(`<license type="other">MIT</license>`), nuspec(`<license version="1" type="expression">MIT</license>`), nuspec(`<license type="expression"/>`)].every(t => other(t) === "a licence it cannot read"),
  "an expression with an entity in it, an empty one, or a licence element written any other way cannot be read");
ok([nuspec(`<license type="expression">MIT</license>`).replace("</metadata>", ""), nuspec(`<license type="expression">MIT`), nuspec(`<license type="expression">MIT</license>`) + "<", nuspec(`<!-- never closed <license type="expression">MIT</license>`), "<package><metadata></package></metadata>"].every(t => other(t) === "a manifest that is not well formed") && other(undefined) === "a manifest it will not read",
  "a manifest that is not well formed gives none");

// the check whole, on a scratch project
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nuget-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const put = (to, text) => { fs.mkdirSync(path.dirname(path.join(tmp, to)), { recursive: true }); fs.writeFileSync(path.join(tmp, to), text); return to; };
const restored = path.join(tmp, "restored");
const pkg = (id, version, inner) => put(`restored/${id.toLowerCase()}/${version.toLowerCase()}/${id.toLowerCase()}.nuspec`, nuspec(inner));
pkg("Newtonsoft.Json", "13.0.3", `<license type="expression">MIT</license>`);
pkg("Serial.Lib", "3.0.5", `<license type="expression">MS-PL</license>`);
pkg("Lib.Dep", "2.0.0", `<license type="expression">Apache-2.0</license>`);
pkg("By.File", "1.0.0", `<license type="file">LICENSE.md</license>`);
pkg("Copy.Left", "4.0.0", `<license type="expression">GPL-3.0-only</license>`);
pkg("Weak.Copy", "2.1.0", `<license type="expression">LGPL-3.0-only</license>`);
pkg("Non.Commercial", "5.0.0", `<license type="expression">CC-BY-NC-4.0</license>`);
pkg("Test.Tool", "9.0.0", `<license type="expression">EPL-2.0</license>`);
const direct = (...pairs) => Object.fromEntries(pairs.map(([id, v]) => [id, entry("Direct", v, `[${v}, )`)]));
const project = (shipsDeps, toolsDeps, { nuget = {}, entries = [], files = [] } = {}) => {
  put(L, lock(shipsDeps)); put(T, lock(toolsDeps));
  put("checks/audit.json", JSON.stringify({ entries }));
  const config = { ships: [], audit: "checks/audit.json", nuget: { ships: [L], tools: [T], ...nuget } };
  return check(config, tmp, restored, ["src/App/App.csproj", L, "tests/App.Tests/App.Tests.csproj", T, "core/scripts/x.mjs", ...files]);
};
const good = project({ ...direct(["Newtonsoft.Json", "13.0.3"], ["Serial.Lib", "3.0.5"]), "Lib.Dep": entry("Transitive", "2.0.0") }, direct(["Test.Tool", "9.0.0"], ["Newtonsoft.Json", "13.0.3"]));
ok(good.failures.length === 0 && /^4 NuGet packages in 2 lock files checked \(3 in what ships, 1 tools that only run\), 0 accepted/.test(good.summary), "a project whose every package is exact and on its list passes: what ships to the floor's list, a test's tool to the tools'", good.failures.join("\n     ") + good.summary);
const bad = project(direct(["Copy.Left", "4.0.0"], ["Test.Tool", "9.0.0"], ["By.File", "1.0.0"]), {});
ok(bad.failures.length === 3 && /Copy\.Left@4\.0\.0 .*GPL-3\.0-only is off the list for what ships.*nuget\.accepted/.test(bad.failures.join("\n")) && /Test\.Tool@9\.0\.0 .*EPL-2\.0 is off the list for what ships/.test(bad.failures.join("\n")) && /By\.File@1\.0\.0 .*names a licence file.*record it in checks\/audit\.json as "By\.File@1\.0\.0"/.test(bad.failures.join("\n")),
  "copyleft in what ships fails, a licence good enough for a tool is not good enough for what ships, and a licence in a file waits to be read by hand", bad.failures.join("\n     "));
const hand = { name: "by.file@1.0.0", licence: "MIT", ships: true, notice: "n" };
ok(project(direct(["By.File", "1.0.0"]), {}, { entries: [hand] }).failures.length === 0, "read by hand and recorded in the audit under its id and version, however cased, it passes");
ok(/does not say it ships/.test(project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, ships: false }] }).failures.join()) && /GPL-2\.0-only, as checks\/audit\.json records it, is off/.test(project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, licence: "GPL-2.0-only" }] }).failures.join())
  && /names a licence file/.test(project(direct(["By.File", "1.0.0"]), {}, { entries: [{ ...hand, name: "By.File@0.9.0" }] }).failures.join()), "an entry that does not say it ships, one that records a licence off the list, or one for another version does not");
ok(project({}, direct(["By.File", "1.0.0"]), { entries: [{ ...hand, ships: false }] }).failures.length === 0, "for a tool that only runs, an entry that does not ship is enough");
const accepted = (id, v, licence) => ({ package: `${id}@${v}`, licence, yes: "the owner, 13 November 2026: take it" });
const taken = project(direct(["Weak.Copy", "2.1.0"], ["By.File", "1.0.0"]), {}, { nuget: { accepted: [accepted("weak.copy", "2.1.0", "LGPL-3.0-only"), accepted("By.File", "1.0.0", "the maker's own terms, bought")] } });
ok(taken.failures.length === 0 && /2 accepted on the owner's yes/.test(taken.summary), "a package off its list, or with no licence a machine can read, passes where the config names that version with the owner's words", taken.failures.join("\n     "));
ok(/Weak\.Copy@2\.1\.0/.test(project(direct(["Weak.Copy", "2.1.0"]), {}, { nuget: { accepted: [accepted("Weak.Copy", "2.0.0", "LGPL-3.0-only")] } }).failures.join()), "a yes for one version is no yes for the next");
ok(/terms floor rule 10 never allows/.test(project(direct(["Non.Commercial", "5.0.0"]), {}, { nuget: { accepted: [accepted("Non.Commercial", "5.0.0", "CC-BY-NC-4.0")] } }).failures.join()), "no yes takes in terms the floor never allows");
ok(/names Newtonsoft\.Json@13\.0\.3, which no lock file installs off its list: remove it/.test(project(direct(["Newtonsoft.Json", "13.0.3"]), {}, { nuget: { accepted: [accepted("Newtonsoft.Json", "13.0.3", "MIT")] } }).failures.join())
  && /names Gone@1\.0\.0/.test(project({}, {}, { nuget: { accepted: [accepted("Gone", "1.0.0", "x")] } }).failures.join()), "an accepted version that needs no yes, or is installed no more, fails: the list shrinks by itself");
ok(/Not\.Restored@1\.0\.0 .*not in the restore's folder/.test(project(direct(["Not.Restored", "1.0.0"]), {}).failures.join()) && /not in the restore's folder/.test(check({ ships: [], nuget: { ships: [L] } }, tmp, undefined, ["src/App/App.csproj", L]).failures.join()), "a package the restore did not bring, or no restore at all, fails: its licence cannot be read");
ok(/one exact version/.test(project({ A: entry("Direct", "13.0.3", "[13.0.*, )") }, {}).failures.join()), "a lock file's own faults are the check's");

// every project has its lock file, and every lock file is named
const names = (tracked, nuget) => check({ ships: [], nuget }, tmp, restored, tracked).failures.join("\n");
put(L, lock({})); put(T, lock({}));
ok(/src\/Other\/Other\.fsproj has no packages\.lock\.json beside it/.test(names(["src/App/App.csproj", L, "src/Other/Other.fsproj"], { ships: [L] })) && /Old\.VBPROJ has no/.test(names(["Old.VBPROJ"], {})), "a project file with no lock file beside it that git knows fails, whatever its language or its case");
ok(/tests\/App\.Tests\/packages\.lock\.json is named in neither/.test(names(["src/App/App.csproj", L, "tests/App.Tests/App.Tests.csproj", T], { ships: [L] })), "a lock file the config does not name fails: it would go unread");
ok(/names src\/App\/packages\.lock\.json, which is no lock file git knows/.test(names([], { ships: [L] })), "one the config names that git does not know fails");
ok(/packages\.config has no lock file/.test(names(["legacy/packages.config"], {})), "the older packages.config fails");
ok(names(["core/x/y.csproj", "core/packages.lock.json", "README.md"], {}) === "" && /^0 NuGet packages in 0 lock files/.test(check({ ships: [], nuget: {} }, tmp, restored, ["README.md"]).summary), "the copy of the core is not the project's, and a project with no NuGet project passes with nothing to read");

// the script itself: started in a project, as the workflow starts it
const repo = path.join(tmp, "repo");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" });
const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(repo, "core"), { recursive: true });
fs.cpSync(here, path.join(repo, "core", "scripts"), { recursive: true });
fs.cpSync(path.join(here, "..", "floor"), path.join(repo, "core", "floor"), { recursive: true });
const inRepo = (to, text) => { fs.mkdirSync(path.dirname(path.join(repo, to)), { recursive: true }); fs.writeFileSync(path.join(repo, to), text); };
inRepo("src/App/App.csproj", "<Project />"); inRepo(L, lock(direct(["Copy.Left", "4.0.0"])));
inRepo("checks/audit.json", JSON.stringify({ entries: [] }));
inRepo("checks/licences.json", JSON.stringify({ ships: [], audit: "checks/audit.json", nuget: { ships: [L] } }));
const git = (...args) => spawnSync("git", args, { cwd: repo, env, encoding: "utf8" });
git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "a project");
const run = (...args) => { const r = spawnSync(process.execPath, [path.join(repo, "core/scripts/nuget.mjs"), ...args], { cwd: repo, env, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
const strict = run("checks/licences.json", "--packages", restored), advisory = run("checks/licences.json", "--packages", restored, "--advisory");
ok(strict.status === 1 && /^FAIL: Copy\.Left@4\.0\.0/m.test(strict.out) && /1 failing/.test(strict.out), "run in a project, it fails where a package is off its list", strict.out);
ok(advisory.status === 0 && /^WOULD FAIL: Copy\.Left@4\.0\.0/m.test(advisory.out) && /Advisory: nothing fails for it yet/.test(advisory.out), "advisory, it says what it would fail, and passes", advisory.out);
ok(run("checks/licences.json").status === 1 && run("--packages", restored).status === 1 && run().status === 1, "without its config or the restore's folder it fails");
inRepo(L, lock(direct(["Newtonsoft.Json", "13.0.3"])));
const fine = run("checks/licences.json", "--packages", path.relative(repo, restored));
ok(fine.status === 0 && /^1 NuGet packages in 1 lock files checked/m.test(fine.out), "a lock file edited and not yet committed is read as it stands, and the folder may be named from where it is started", fine.out);
const licences = spawnSync(process.execPath, [path.join(repo, "core/scripts/licences.mjs"), "checks/licences.json"], { cwd: repo, env, encoding: "utf8" });
ok(licences.status === 0, "the licence check takes the same config, with its \"nuget\", and leaves that part to this check", licences.stdout + licences.stderr);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the NuGet check`);
process.exit(failed ? 1 : 0);
