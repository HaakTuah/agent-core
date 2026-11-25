#!/usr/bin/env node
// Tests of exact-versions.mjs: each case a made-up project in memory (a lock file and its package lists), never a real
// one. Run: node tests/exact-versions-test.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, report } from "../scripts/exact-versions.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const reader = (files) => (p) => { if (!Object.hasOwn(files, p)) throw new Error(`no such file: ${p}`); return files[p]; };
const project = (lists, packages, at = "") => {
  const files = { [`${at}package-lock.json`]: JSON.stringify({ lockfileVersion: 3, packages }) };
  for (const [folder, list] of Object.entries(lists)) files[`${at}${folder}package.json`] = JSON.stringify(list);
  return check(`${at}package-lock.json`, reader(files));
};
function expect(name, problems, wanted) {
  const ok = wanted === 0 ? problems.length === 0 : problems.length === wanted.length && wanted.every((w, i) => problems[i].includes(w));
  if (!ok) { failed++; console.error(`FAIL ${name}: ${JSON.stringify(problems)}`); }
}
const one = (spec, version = "1.2.3", extra = {}) => project({ "": { dependencies: { a: spec } } }, { "": { dependencies: { a: spec } }, "node_modules/a": { version, ...extra } });

expect("an exact version passes", one("1.2.3"), 0);
expect("a pre-release and a build after it pass", one("1.2.3-rc.1+build.5", "1.2.3-rc.1+build.5"), 0);
expect("a caret range fails", one("^1.2.3"), ['"a": "^1.2.3" is not one exact version']);
expect("a tilde range fails", one("~1.2.3"), ["is not one exact version"]);
expect("a star fails", one("*"), ["is not one exact version"]);
expect("a tag fails", one("latest"), ["is not one exact version"]);
expect("a text shaped like a version that npm reads as a tag fails", one("1.2.3-rc..1", "2.0.0"), ["is not one exact version"]);
expect("a version with a v before it fails", one("v1.2.3"), ["is not one exact version"]);
expect("a version with an equals sign fails", one("=1.2.3"), ["is not one exact version"]);
expect("a version with a space fails", one(" 1.2.3"), ["is not one exact version"]);
expect("a version of two numbers fails", one("1.2", "1.2.0"), ["is not one exact version"]);
expect("a number with a nought before it fails", one("1.02.3", "1.2.3"), ["is not one exact version"]);
expect("a number too large for npm to read as one fails though the lock file says the same", one("9007199254740992.0.0", "9007199254740992.0.0"), ["is not one exact version"]);
expect("a version that ends as a packed file's name does fails, as npm reads it as a file", one("1.2.3+a.tgz", "1.2.3+a.tgz"), ["is not one exact version"]);
expect("so does one that ends so in its pre-release, in capitals", one("1.2.3-a.TAR.GZ", "1.2.3-a.TAR.GZ"), ["is not one exact version"]);
expect("and one with any letter between its tar and its gz", one("1.2.3+a.tar-gz", "1.2.3+a.tar-gz"), ["is not one exact version"]);
expect("a number of fifteen digits passes", one("1.999999999999999.0", "1.999999999999999.0"), 0);
expect("a version longer than any real one fails", one(`1.2.3-${"a".repeat(300)}`, `1.2.3-${"a".repeat(300)}`), ["is not one exact version"]);
expect("an alias fails", one("npm:b@1.2.3"), ["is not one exact version"]);
expect("a git address fails", one("git+https://example.invalid/a.git#abc#def"), ["is not one exact version"]);
expect("a web address fails", one("https://example.invalid/a-1.2.3.tgz"), ["is not one exact version"]);
expect("a path fails", one("file:../a"), ["is not one exact version"]);
expect("a version that is no text fails", project({ "": { dependencies: { a: 1 } } }, { "": {}, "node_modules/a": { version: "1" } }), ["is not one exact version"]);
// A lock file edited by hand so that its entry says what the list says: the first test does not ask the lock file.
expect("a range fails though the lock file is made to say the same", one("^1.2.3", "^1.2.3"), ["is not one exact version"]);
expect("a tag fails though the lock file is made to say the same", one("latest", "latest"), ["is not one exact version"]);
expect("a star fails though the lock file is made to say the same", one("*", "*"), ["is not one exact version"]);
expect("a link to a folder outside the project's own packages fails", one("*", "1.2.3", { link: true, resolved: "../elsewhere" }), ["is not one exact version"]);
expect("a link to a folder above the project fails though the lock file lists it", project({ "": { dependencies: { a: "*" } } }, { "": {}, "node_modules/a": { link: true, resolved: "../up" }, "../up": {} }), ["is not one exact version", "no folder of the project's"]);
expect("a package whose folder is written the way another system writes one fails", project({ "": {} }, { "": {}, "..\\up": {}, "C:/up": {} }), ["no folder of the project's", "no folder of the project's"]);
expect("a package whose folder starts at the disk's root fails", project({ "": {} }, { "": {}, "/etc": {} }), ["no folder of the project's"]);
expect("another exact version than the lock file's fails", one("1.2.4"), ['is not the version the lock file installs ("1.2.3")']);
expect("a lock file entry that is nothing fails", project({ "": { dependencies: { a: "1.2.3" } } }, { "": {}, "node_modules/a": null }), ["is not the version the lock file installs"]);
expect("a lock file entry that is a text fails", project({ "": { dependencies: { a: "1.2.3" } } }, { "": {}, "node_modules/a": "1.2.3" }), ["is not the version the lock file installs"]);
expect("a dependency the lock file lacks fails", project({ "": { devDependencies: { a: "1.2.3" } } }, { "": {} }), ['"a": "1.2.3" is not in package-lock.json']);
expect("an optional dependency the lock file lacks passes at one exact version", project({ "": { optionalDependencies: { a: "1.2.3" } } }, { "": {} }), 0);
expect("a peer dependency the lock file lacks fails at a range", project({ "": { peerDependencies: { a: "^1.2.3" } } }, { "": {} }), ["is not one exact version"]);
expect("an optional dependency at a range fails where the lock file has it", project({ "": { optionalDependencies: { a: "^1.2.3" } } }, { "": {}, "node_modules/a": { version: "1.2.3" } }), ["is not one exact version"]);
expect("every kind is read", project({ "": { dependencies: { a: "^1" }, devDependencies: { b: "^1" }, optionalDependencies: { c: "^1" }, peerDependencies: { d: "^1" } } },
  { "": {}, "node_modules/a": { version: "1.0.0" }, "node_modules/b": { version: "1.0.0" }, "node_modules/c": { version: "1.0.0" }, "node_modules/d": { version: "1.0.0" } }), ['"a"', '"b"', '"c"', '"d"']);
expect("a list that is no list fails", project({ "": { dependencies: ["a"] } }, { "": {} }), ['"dependencies" is no list']);
const printed = project({ "": { dependencies: { "a\n::error::x": "^1\n::error::y" } } }, { "": {} });
expect("a name and a version are printed on one line", printed, ["is not one exact version"]);
if (printed.some((line) => line.includes("\n"))) { failed++; console.error("FAIL a name with a line break in it breaks the line it is printed on"); }

// The root's overrides.
const overridden = (overrides) => project({ "": { dependencies: { a: "1.2.3" }, overrides } }, { "": {}, "node_modules/a": { version: "1.2.3" } });
expect("an override at one exact version passes", overridden({ b: "2.0.0" }), 0);
expect("an override that points to a dependency of the root's passes", overridden({ b: "$a" }), 0);
expect("an override that points to nothing the root lists fails", overridden({ b: "$c" }), ['overrides "b": "$c" is not one exact version']);
expect("an override that points to a name the root lists twice, once at a star, fails", project({ "": { dependencies: { "@own/w": "*" }, devDependencies: { "@own/w": "1.0.0" }, overrides: { b: "$@own/w" } }, "src/w/": {} },
  { "": {}, "src/w": {}, "node_modules/@own/w": { link: true, resolved: "src/w" } }), ['overrides "b": "$@own/w" is not one exact version']);
expect("an override that points to a workspace asked for by a star fails", project({ "": { dependencies: { "@own/w": "*" }, overrides: { b: "$@own/w" } }, "src/w/": {} },
  { "": {}, "src/w": {}, "node_modules/@own/w": { link: true, resolved: "src/w" } }), ['overrides "b": "$@own/w" is not one exact version']);
expect("an override with a number too large for npm to read as one fails", overridden({ b: "9007199254740992.0.0" }), ['overrides "b": "9007199254740992.0.0" is not one exact version']);
expect("an override at a range fails", overridden({ b: "^2.0.0" }), ['overrides "b": "^2.0.0" is not one exact version']);
expect("an override inside another is read", overridden({ "b@1": { ".": "2.0.0", c: "latest" } }), ['overrides "b@1 > c": "latest" is not one exact version']);
expect("a key that picks among versions, its value left unsaid, fails: npm would take the pick as the value", overridden({ "b@^1": {} }), ['overrides "b@^1": a key that picks among versions has no value of its own. Mend: give it one']);
expect("so does one with a scope before its name", overridden({ "@s/b@^1": { c: "2.0.0" } }), ['overrides "@s/b@^1": a key that picks']);
expect("a key that picks among versions passes with its value said as a text", overridden({ "b@^1": "2.0.0", "@s/b@1.x": "3.0.0" }), 0);
expect("and with its value said as the dot of its list", overridden({ "b@^1": { ".": "2.0.0", c: "4.0.0" } }), 0);
expect("a key with a scope and no pick needs no value", overridden({ "@s/b": { c: "4.0.0" } }), 0);
expect("a dot that holds a list fails", overridden({ b: { ".": { c: "1.0.0" } } }), ['overrides "b > .": {"c":"1.0.0"} is not one exact version']);
expect("an empty value fails", overridden({ b: "" }), ['overrides "b": "" is not one exact version']);
expect("an override that is no text and no list fails", overridden({ b: 2 }), ['overrides "b": 2 is not one exact version']);
expect("overrides in a workspace, which npm does not read, are not held", project({ "": {}, "src/web/": { overrides: { b: "^2" } } }, { "": {}, "src/web": {} }), 0);

// Workspaces: the root and two of its own packages, one of which asks for the other and for its own copy of a package.
const workspaces = (webAsks, webCopy) => project(
  { "": { devDependencies: { tool: "2.0.0" } }, "src/engine/": {}, "src/web/": { dependencies: { "@own/engine": "*", lib: webAsks } } },
  { "": {}, "src/engine": {}, "src/web": {}, "node_modules/@own/engine": { link: true, resolved: "src/engine" }, "node_modules/@own/web": { link: true, resolved: "src/web" },
    "node_modules/tool": { version: "2.0.0" }, "node_modules/lib": { version: "1.0.0" }, ...(webCopy ? { "src/web/node_modules/lib": { version: webCopy } } : {}) });
expect("a workspace asked for by a star passes, and the hoisted version is the one compared", workspaces("1.0.0"), 0);
expect("a workspace's own copy is the one compared", workspaces("3.0.0", "3.0.0"), 0);
expect("the hoisted version does not pass where a workspace has its own copy", workspaces("1.0.0", "3.0.0"), ['("3.0.0")']);
expect("a workspace's range fails", workspaces("^1.0.0"), ['src/web/package.json: dependencies "lib"']);
expect("a folder whose name only holds the letters node_modules is one of the project's own",
  project({ "": {}, "node_modules_tools/": { dependencies: { a: "^1" } } }, { "": {}, "node_modules_tools": {}, "node_modules/a": { version: "1.0.0" } }), ["node_modules_tools/package.json"]);
expect("a lock file in a folder reads the lists beside it", project({ "": { dependencies: { a: "^1" } } }, { "": {}, "node_modules/a": { version: "1.0.0" } }, "tools/"), ["tools/package.json"]);

// What cannot be read.
expect("a root entry marked as a link is read all the same", project({ "": { dependencies: { a: "file:a.tgz" } } }, { "": { link: true }, "node_modules/a": { version: "1.2.3" } }), ["is not one exact version"]);
expect("so is a workspace's entry marked as a link", project({ "": {}, "src/web/": { dependencies: { a: "^1" } } }, { "": {}, "src/web": { link: true }, "node_modules/a": { version: "1.0.0" } }), ["src/web/package.json"]);
expect("a lock file with no entry for the root fails, and the root's list is not read", check("package-lock.json", reader({ "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/a": { version: "1.2.3" } } }), "package.json": JSON.stringify({ dependencies: { a: "file:a.tgz" } }) })), ["holds no entry for the project's own root"]);
expect("a lock file that is no JSON fails", check("package-lock.json", reader({ "package-lock.json": "{" })), ["cannot be read as JSON"]);
expect("a lock file that is missing fails", check("package-lock.json", reader({})), ["cannot be read as JSON"]);
expect("an old lock file with no packages fails", check("package-lock.json", reader({ "package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: {} }) })), ['holds no "packages"']);
expect("a package list that is missing fails", check("package-lock.json", reader({ "package-lock.json": JSON.stringify({ packages: { "": {} } }) })), ["package.json: cannot be read as JSON"]);
expect("a name that is also a key of every object is not found by mistake", project({ "": { dependencies: { constructor: "1.0.0" } } }, { "": {} }), ['"constructor": "1.0.0" is not in']);

// Run as a project runs it: from its root, with the licence check's config, on files on disk.
function run(spec, lockfile = "tools/package-lock.json") {
  const dir = scratchDir("exact-versions-");
  try {
    mkdirSync(join(dir, "tools"));
    writeFileSync(join(dir, "licences.json"), JSON.stringify({ lockfiles: [lockfile] }));
    writeFileSync(join(dir, "tools", "package.json"), JSON.stringify({ devDependencies: { a: spec } }));
    writeFileSync(join(dir, "tools", "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/a": { version: "1.2.3" } } }));
    const r = report("licences.json", dir);
    return r.status === 0 || mended(r.err.join("\n")) ? r.status : "a failure without its mend";
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (run("1.2.3") !== 0) { failed++; console.error("FAIL run from a project's root: an exact version does not pass"); }
if (run("^1.2.3") !== 1) { failed++; console.error("FAIL run from a project's root: a range does not fail, saying its mend"); }
if (run("1.2.3", "../tools/package-lock.json") !== 1 || run("1.2.3", join(tmpdir(), "package-lock.json")) !== 1) { failed++; console.error("FAIL a lock file named outside the project is not refused, saying its mend"); }

// What the command says, whole: its usage, a config it cannot read or that names no list or a path outside, and its count.
{
  const dir = scratchDir("exact-versions-");
  try {
    const say = (name, text) => writeFileSync(join(dir, name), text);
    const lock = (list) => { mkdirSync(join(dir, "t"), { recursive: true }); say("t/package.json", JSON.stringify(list)); say("t/package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/a": { version: "1.2.3" }, "node_modules/b": { version: "2.0.0" } } })); };
    const is = (what, r, status, out, err) => { if (r.status !== status || r.out.join("\n") !== out || r.err.join("\n") !== err) { failed++; console.error(`FAIL ${what}: ${JSON.stringify(r)}`); } };
    is("no config named", report(undefined, dir), 2, "", "usage: node core/scripts/exact-versions.mjs <the licence check's config>");
    const none = report("nope.json", dir);
    if (none.status !== 1 || none.out.length || none.err.length !== 1 || !none.err[0].startsWith("FAIL: nope.json cannot be read (") || !mended(none.err[0])) { failed++; console.error(`FAIL a config that is not there: ${JSON.stringify(none)}`); }
    say("c.json", "{ not json");
    if (report("c.json", dir).status !== 1 || !report("c.json", dir).err[0].includes("c.json cannot be read")) { failed++; console.error("FAIL a config that is no JSON"); }
    say("c.json", JSON.stringify({ lockfiles: "t/package-lock.json" }));
    is("lockfiles that is no list", report("c.json", dir), 1, "", 'FAIL: "lockfiles" in c.json is no list of paths. Mend: write it as a list of the lock files\' paths');
    say("c.json", JSON.stringify({ lockfiles: ["t/package-lock.json", 3] }));
    if (report("c.json", dir).status !== 1 || !report("c.json", dir).err[0].includes("is no list of paths")) { failed++; console.error("FAIL a list with a path that is none"); }
    say("c.json", JSON.stringify({ lockfiles: ["t/package-lock.json", "../x/package-lock.json", "/y/package-lock.json"] }));
    const out = report("c.json", dir);
    if (out.status !== 1 || out.err.length !== 1 || !out.err[0].includes("names a path outside the project: ../x/package-lock.json, /y/package-lock.json.") || !mended(out.err[0])) { failed++; console.error(`FAIL paths outside the project: ${JSON.stringify(out)}`); }
    say("c.json", JSON.stringify({}));
    is("no lock file named", report("c.json", dir), 0, "ok   every dependency of 0 lock files is at the one exact version it installs", "");
    say("c.json", JSON.stringify({ lockfiles: ["t/package-lock.json"] }));
    lock({ dependencies: { a: "1.2.3" } });
    is("one lock file, exact", report("c.json", dir), 0, "ok   every dependency of 1 lock file is at the one exact version it installs", "");
    lock({ dependencies: { a: "^1.2.3", b: "~2.0.0" } });
    const two = report("c.json", dir);
    if (two.status !== 1 || two.out.join() !== "2 dependencies not at one exact version (floor rule 7)" || two.err.length !== 2 || !two.err.every((e) => e.startsWith("FAIL: t/package.json: ") && mended(e))) { failed++; console.error(`FAIL two ranges: ${JSON.stringify(two)}`); }
    say("c2.json", JSON.stringify({ lockfiles: ["./t/../t/package-lock.json"] }));
    if (report("c2.json", dir).status !== 1) { failed++; console.error("FAIL a path written with dots is read as the path it leads to"); }
    say("c.json", JSON.stringify({ lockfiles: ["t/package-lock.json"] }));
    lock({ dependencies: { a: "1.2.3" } });
    is("a config named by its absolute path", report(join(dir, "c.json"), dir), 0, "ok   every dependency of 1 lock file is at the one exact version it installs", "");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Beside the licence check (licences.mjs; #1093, point 2), read against the pull request's base: a range the base held
// is reported, never failed, and one the pull request brings fails, saying its mend.
{
  const dir = scratchDir("exact-versions-");
  try {
    mkdirSync(join(dir, "t"));
    const list = (deps) => JSON.stringify({ dependencies: deps });
    writeFileSync(join(dir, "c.json"), JSON.stringify({ lockfiles: ["t/package-lock.json"] }));
    const lock = JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/a": { version: "1.2.3" }, "node_modules/b": { version: "2.0.0" } } });
    writeFileSync(join(dir, "t/package-lock.json"), lock);
    writeFileSync(join(dir, "t/package.json"), list({ a: "^1.2.3", b: "~2.0.0" }));
    const base = { "t/package-lock.json": lock, "t/package.json": list({ a: "^1.2.3", b: "2.0.0" }) };
    const r = report("c.json", dir, (f) => base[f] ?? null);
    if (r.status !== 1 || r.err.length !== 1 || !/"b": "~2\.0\.0"/u.test(r.err[0]) || !mended(r.err[0]) || !r.out.some((l) => /^REPORT: [^\n]*"a": "\^1\.2\.3"[^\n]*stood so at the pull request's base/u.test(l))) { failed++; console.error(`FAIL a range the base held is reported and a new one fails: ${JSON.stringify(r)}`); }
    const none = report("c.json", dir, () => null);
    if (none.status !== 1 || none.err.length !== 2) { failed++; console.error(`FAIL where the base held no lock file, every range fails: ${JSON.stringify(none)}`); }
    base["t/package.json"] = list({ a: "^1.2.3", b: "~2.0.0" });
    const old = report("c.json", dir, (f) => base[f] ?? null);
    if (old.status !== 0 || old.err.length || !/^ok .*, but 2 that stood so before$/mu.test(old.out.join("\n"))) { failed++; console.error(`FAIL what all stood before passes, reported: ${JSON.stringify(old)}`); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// A package list or lock file nested past the bound is refused, saying its mend, never read by recursion.
const deep = (inner) => `${"{\"a\":".repeat(20000)}${inner}${"}".repeat(20000)}`;
expect("overrides nested past the bound are refused", check("package-lock.json", reader({ "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {} } }), "package.json": `{"overrides":${deep('"1.2.3"')}}` })), ["cannot be read as JSON (it nests deeper than 200 objects and lists). Mend: "]);
expect("a lock file nested past the bound is refused", check("package-lock.json", reader({ "package-lock.json": `{"lockfileVersion":3,"packages":{"":${deep("{}")}}}` })), ["cannot be read as JSON (it nests deeper than 200 objects and lists). Mend: "]);
{
  // (a spec and an override that name an address with a sign-in in it, the sign-in made up and built from pieces as the
  // test runs: each is refused, and the address is quoted with its user and password cut out; floor rule 1)
  const user = ["made", "up"].join("-"), pass = ["not", "a", "pass"].join("_"), signed = `git+https://${user}:${pass}@example.invalid/a.git`;
  const said = [...one(signed, signed), ...project({ "": { dependencies: { a: "1.2.3" }, overrides: { a: signed } } }, { "": { dependencies: { a: "1.2.3" } }, "node_modules/a": { version: "1.2.3" } })];
  if (said.length !== 2 || said.some((p) => p.includes(user) || p.includes(pass)) || !said.every((p) => p.includes('"git+https://example.invalid/a.git" is not one exact version'))) { failed++; console.error(`FAIL a spec with a sign-in is quoted without it: ${JSON.stringify(said).replaceAll(user, "<user>").replaceAll(pass, "<pass>")}`); }
}

console.log(failed ? `${failed} FAILED` : "ok   the exact-versions check tells every case apart");
process.exit(failed ? 1 : 0);
