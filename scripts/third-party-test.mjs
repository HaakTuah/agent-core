// Checks the folder of packages the core carries (third-party.mjs, beside this file; #528): the folder as it stands
// passes, offline and against npm's registry; each fault, staged in a copy, is found with its mend; a project's own
// .gitignore keeps no carried file out of its commit, and its package.json does not change how Node reads them; and
// the move of yaml-keys.mjs onto the package happened. Fetches from npm's registry. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/third-party-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { digestOf, faults, filesIn, verify } from "./third-party.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${String(detail).replaceAll("\n", "\n     ")}`); } };
const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "third-party-test-"));
const git = (dir, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let n = 0;
// (a copy of the folder, and of the scripts that read its packages, in a root of its own)
const copy = () => {
  const dir = path.join(tmp, `c${++n}`);
  fs.cpSync(path.join(root, "third-party"), path.join(dir, "third-party"), { recursive: true });
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(path.join(root, "scripts/yaml-keys.mjs"), path.join(dir, "scripts/yaml-keys.mjs"));
  return dir;
};
const list = dir => JSON.parse(fs.readFileSync(path.join(dir, "third-party/list.json"), "utf8"));
const relist = (dir, change) => { const l = list(dir); change(l.packages[0]); fs.writeFileSync(path.join(dir, "third-party/list.json"), JSON.stringify(l, null, 2)); };

try {
  // ---- the folder as it stands ----
  const now = faults();
  ok(!now.length, "the folder as it stands passes: each package as list.json says", now.join("\n"));
  const cli = spawnSync(process.execPath, [path.join(root, "scripts/third-party.mjs")], { encoding: "utf8" });
  ok(cli.status === 0 && /every package as list\.json says/.test(cli.stdout), "and the script, run by itself, says so", `${cli.stdout}${cli.stderr}`);

  // ---- each fault, staged in a copy: found, with its mend ----
  const staged = [
    ["list.json no JSON", d => fs.writeFileSync(path.join(d, "third-party/list.json"), "{ not json"), /list\.json cannot be read as JSON/],
    ["a version that is a range", d => relist(d, p => { p.version = "^2.9.1"; }), /"version" is not one exact version/],
    ["an integrity that is no sha512", d => relist(d, p => { p.integrity = "sha1-abc"; }), /"integrity" is no sha512 value/],
    ["a licence off the floor's list", d => relist(d, p => { p.licence = "GPL-3.0-only"; }), /not on floor rule 10's list/],
    ["a version taken under a week old", d => relist(d, p => { p.taken = p.published.slice(0, 10); }), /under a week after the version was published/],
    ["a version taken later than today", d => relist(d, p => { p.taken = "2999-01-01"; }), /or later than today/],
    ["a key the entry should not hold", d => relist(d, p => { p.extra = 1; }), /lacks or holds keys it should not: extra/],
    ["the package listed twice", d => { const l = list(d); l.packages.push(l.packages[0]); fs.writeFileSync(path.join(d, "third-party/list.json"), JSON.stringify(l)); }, /is listed twice/],
    ["a carried file changed", d => fs.appendFileSync(path.join(d, "third-party/yaml/dist/index.js"), "\n"), /"digest" is not that of the files carried/],
    ["a file the entry does not name", d => fs.writeFileSync(path.join(d, "third-party/yaml/README.md"), "# yaml\n"), /differs from "files": README\.md not named/],
    ["a path the entry names, gone", d => fs.rmSync(path.join(d, "third-party/yaml/dist"), { recursive: true }), /differs from "files": dist\/ holds nothing/],
    ["its licence file gone", d => { fs.rmSync(path.join(d, "third-party/yaml/LICENSE")); }, /carries no licence file/],
    ["the notices emptied", d => fs.writeFileSync(path.join(d, "third-party/NOTICES.md"), ""), /NOTICES\.md has no section "## yaml 2\.9\.1"/],
    ["its notice gone", d => fs.writeFileSync(path.join(d, "third-party/NOTICES.md"), "# Notices\n"), /NOTICES\.md has no section "## yaml 2\.9\.1"/],
    ["its copyright line left out of the notice", d => fs.writeFileSync(path.join(d, "third-party/NOTICES.md"), fs.readFileSync(path.join(d, "third-party/NOTICES.md"), "utf8").replace(/^Copyright.*$/mu, "")), /NOTICES\.md has no section/],
    ["a folder in no entry", d => fs.mkdirSync(path.join(d, "third-party/other")), /other\/ is in no entry of list\.json/],
    ["a script named that imports nothing from it", d => fs.writeFileSync(path.join(d, "scripts/yaml-keys.mjs"), "export const twice = () => [];\n"), /which is no script of the core's that imports from third-party\/yaml\//],
    ["package.json saying module", d => fs.writeFileSync(path.join(d, "third-party/package.json"), '{"type": "module"}\n'), /package\.json does not say "type": "commonjs" alone/],
    ["the .gitignore gone", d => fs.rmSync(path.join(d, "third-party/.gitignore")), /\.gitignore holds no line !\*/],
  ];
  for (const [what, stage, said] of staged) {
    const d = copy();
    stage(d);
    const out = faults(d);
    ok(out.some(l => said.test(l)) && mended(out.join("\n")), `${what}: found, with its mend`, out.join("\n"));
  }
  if (process.platform !== "win32") {
    const d = copy();
    fs.symlinkSync("../LICENSE", path.join(d, "third-party/yaml/dist/link.js"));
    const out = faults(d);
    ok(out.some(l => /holds what is no file: dist\/link\.js/.test(l)) && mended(out.join("\n")), "a link among the files: found, with its mend", out.join("\n"));
  }
  {
    const d = copy();
    const digest = digestOf(path.join(d, "third-party/yaml"), filesIn(path.join(d, "third-party/yaml")).files);
    ok(digest === list(root).packages[0].digest, "the digest is the files' alone, wherever the folder stands");
  }

  // ---- in a project: its .gitignore keeps nothing out, its package.json changes nothing ----
  {
    const p = path.join(tmp, "project");
    fs.mkdirSync(path.join(p, "core/scripts"), { recursive: true });
    fs.cpSync(path.join(root, "third-party"), path.join(p, "core/third-party"), { recursive: true });
    fs.copyFileSync(path.join(root, "scripts/yaml-keys.mjs"), path.join(p, "core/scripts/yaml-keys.mjs"));
    // (the patterns GitHub's templates for Node, Python and Visual Studio hold, and more)
    fs.writeFileSync(path.join(p, ".gitignore"), "node_modules/\ndist/\nbuild/\nlib/\nvendor/\n**/[Pp]ackages/*\n*.js\n*.d.ts\nLICENSE\n*.json\n*.md\n");
    fs.writeFileSync(path.join(p, "package.json"), '{ "type": "module" }\n');
    git(p, "init", "-q");
    git(p, "add", "-A");
    const want = filesIn(path.join(root, "third-party")).files.map(f => `core/third-party/${f}`);
    const held = git(p, "ls-files", "core/third-party").split("\n").filter(Boolean);
    ok(JSON.stringify(held) === JSON.stringify(want), `a project's .gitignore keeps none of the ${want.length} files out of the commit that syncs the copy`, want.filter(f => !held.includes(f)).slice(0, 5).join("\n"));
    const run = () => spawnSync(process.execPath, ["--input-type=module", "-e", 'import { twice } from "./core/scripts/yaml-keys.mjs"; console.log(JSON.stringify(twice("a: 1\\na: 2\\n")));'], { cwd: p, encoding: "utf8" });
    const r = run();
    ok(r.status === 0 && r.stdout.trim() === '[{"line":2,"key":"a","first":1}]', "where the project's package.json makes .js a module, the package is read as its publisher built it", `${r.stdout}${r.stderr}`);
    // (and each holds by the folder's own file: without it, each breaks)
    fs.rmSync(path.join(p, "core/third-party/.gitignore"));
    git(p, "rm", "-q", "-r", "--cached", "core");
    git(p, "add", "-A");
    ok(git(p, "ls-files", "core/third-party").split("\n").filter(Boolean).length < want.length - 1, "without the folder's .gitignore, the project's own would keep files out");
    fs.rmSync(path.join(p, "core/third-party/package.json"));
    ok(run().status !== 0, "and without its package.json, Node would read the package as a module, and fail");
  }

  // ---- the move happened: yaml-keys.mjs reads with the package, and holds no reader of its own ----
  const keys = fs.readFileSync(path.join(root, "scripts/yaml-keys.mjs"), "utf8");
  ok(keys.includes('from "../third-party/yaml/dist/index.js"') && !/function (?:flowTwice|keyAt|keyName|items)\b/u.test(keys),
    "yaml-keys.mjs reads a key given twice with the package the core carries, and no reader of its own is left");

  // ---- against npm's registry: the version, its signature, the lookup and the tarball, file by file ----
  const cache = new Map();
  const remember = (fetcher) => async (url) => { if (!cache.has(url)) cache.set(url, await fetcher(url)); return cache.get(url); };
  const { fetched } = await import("./lookup.mjs");
  const get = remember(fetched);
  const getBytes = remember(async url => { const r = await fetch(url, { signal: AbortSignal.timeout(60000) }); return { status: r.status, body: r.status === 200 ? Buffer.from(await r.arrayBuffer()) : null }; });
  const real = await verify(root, { get, getBytes });
  ok(!real.failures.length && real.reports.some(r => /each the same as the tarball's at 2\.9\.1, signed by the registry/.test(r)), "against the registry: the integrity, the date, the signature, the lookup and every file as the tarball holds it", [...real.failures, ...real.reports].join("\n"));
  {
    const d = copy();
    fs.appendFileSync(path.join(d, "third-party/yaml/dist/index.js"), "\n");
    const out = await verify(d, { get, getBytes });
    ok(out.failures.some(f => /1 carried file differ from the tarball's \(dist\/index\.js\)/.test(f)) && mended(out.failures.join("\n")), "a carried file that differs from the tarball's: found, with its mend", out.failures.join("\n"));
  }
  {
    const d = copy();
    relist(d, p => { p.integrity = `sha512-${"A".repeat(86)}==`; p.published = "2026-09-11T20:30:10.000Z"; });
    const out = await verify(d, { get, getBytes });
    ok(["the registry's integrity is", "as its date", "no signature of the registry's key holds", "its tarball sums to"].every(s => out.failures.some(f => f.includes(s))) && mended(out.failures.join("\n")),
      "an integrity and a date the registry does not give: each found, with its mend", out.failures.join("\n"));
  }
  {
    const d = copy();
    const young = { ...cache.get("https://registry.npmjs.org/yaml"), json: { ...cache.get("https://registry.npmjs.org/yaml").json, time: { ...cache.get("https://registry.npmjs.org/yaml").json.time, created: new Date().toISOString() } } };
    const out = await verify(d, { get: url => (url === "https://registry.npmjs.org/yaml" ? young : get(url)), getBytes });
    ok(out.failures.some(f => /first published .* under the 90 days floor rule 15 asks/.test(f)) && mended(out.failures.join("\n")), "a package first published under 90 days ago: the lookup fails it, with its mend", out.failures.join("\n"));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `${failed} failing` : "all passed");
process.exitCode = failed ? 1 : 0;
