// Checks that each npm lock file of a project is named in its licence config or said (scripts/licence-locks.mjs, run by
// scripts/licences.mjs; #1316): one a pull request adds fails, saying its mend, one that stood at its base or with no
// base to read is reported, and one whose name the base's config held, or whose name differs from npm's only in case,
// fails as an added one does, and those the scan reads, a shrinkwrap file's twin and the core's copy are left to what holds
// them; and that the core's own config is refused with its mend where a list of it is of another form (#1316, point 2).
// Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/licence-locks-test.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { stoodAt, unnamedLocks } from "../scripts/licence-locks.mjs";
import { check, coreConfig } from "../scripts/licences.mjs";
import { asOutput, done, ok } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

const says = (list, f) => list.filter((m) => m.startsWith(`${f} is a lock file of npm's that the licence config's "lockfiles" does not name`));
const tracked = ["package.json", "package-lock.json", "app/package-lock.json", "app/npm-shrinkwrap.json", "tools/package-lock.json", "docs/npm-shrinkwrap.json", "mypackage-lock.json", "package-lock.json.bak", "core/package-lock.json", "web/Package-Lock.JSON"];
const config = { ships: [], lockfiles: ["package-lock.json", "app/package-lock.json"] };

// a pull request's base: one it adds fails with its mend, one that stood is reported; a named one, its shrinkwrap twin
// (which the check fails as a pair) and a file of another name say nothing; with no manifest, core/ is the project's own
{
  const r = unnamedLocks(".", tracked, config, "HEAD^1", (f) => f === "tools/package-lock.json");
  ok(r.failures.length === 3 && says(r.failures, "docs/npm-shrinkwrap.json").length === 1 && says(r.failures, "core/package-lock.json").length === 1 && says(r.failures, "web/Package-Lock.JSON").length === 1
    && mended(asOutput(r.failures)) && r.failures.every((m) => m.includes("the dependency review alone holds them") && m.includes(`Mend: name ${m.slice(0, m.indexOf(" "))} in the config's "lockfiles"`)),
  "a lock file of npm's that a pull request adds and the config does not name fails, saying its mend", JSON.stringify(r));
  ok(r.reports.length === 1 && says(r.reports, "tools/package-lock.json").length === 1 && r.reports[0].includes("it stood so at the pull request's base, so it passes"),
    "one that stood at the base is reported and passes", JSON.stringify(r));
  const none = unnamedLocks(".", tracked, config, null, () => false);
  ok(none.failures.length === 0 && none.reports.length === 4 && none.reports.every((m) => m.includes("with no base to read it against, so it passes")),
    "with no base to read, each is reported and passes", JSON.stringify(none));
}

// in a project, its copy of the core, at the manifest's path, is the core's, and a folder that only begins so is not
{
  const dir = scratchDir("licence-locks-");
  try {
    writeFileSync(join(dir, "core-manifest.md"), `Core: ${CORE} at ${"0".repeat(40)}, copied whole under vendor/core/ (never edited here).\n`);
    const r = unnamedLocks(dir, ["core-manifest.md", "vendor/core/.packages/package-lock.json", "vendor/corex/package-lock.json", "core/package-lock.json"], { ships: [], lockfiles: [] }, "HEAD^1", () => false);
    ok(r.failures.length === 2 && says(r.failures, "vendor/corex/package-lock.json").length === 1 && says(r.failures, "core/package-lock.json").length === 1 && r.reports.length === 0,
      "the core's copy is left to the core, at the path the manifest names", JSON.stringify(r));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// a config with a scan: what it reads is the scan's to fail, what it skips, and a name the scan does not read, is said here
{
  const r = unnamedLocks(".", ["tools/package-lock.json", "docs/package-lock.json", "tools/NPM-Shrinkwrap.json"], { ...config, scan: { served: [], skip: ["docs/"] } }, "HEAD^1", () => false);
  ok(r.failures.length === 1 && says(r.failures, "docs/package-lock.json").length === 1,
    "where the config scans, a lock file the scan reads, whatever the case of its name, is left to it, and one it skips is said", JSON.stringify(r));
}

// a name that differs from npm's only in case is no twin of a named lock file, which the check reads by npm's own name
{
  const r = unnamedLocks(".", ["app/npm-shrinkwrap.json", "app/Package-Lock.json", "app/package-lock.json"], { ships: [], lockfiles: ["app/npm-shrinkwrap.json"] }, "HEAD^1", () => false);
  ok(r.failures.length === 1 && says(r.failures, "app/Package-Lock.json").length === 1, "a lock file whose name differs only in case is said beside a named shrinkwrap file, whose twin of npm's own name is left to the check", JSON.stringify(r));
}

// what stood: a file of the base's tree, never a folder at that path, that the base's config did not name
{
  const core = fileURLToPath(new URL("..", import.meta.url));
  const unnamed = stoodAt(core, "HEAD", { lockfiles: [] }), named = stoodAt(core, "HEAD", { lockfiles: [".packages/package-lock.json"] });
  ok(unnamed(".packages/package-lock.json") && !named(".packages/package-lock.json") && !unnamed("scripts") && !stoodAt(core, null, null)(".packages/package-lock.json") && !stoodAt(core, "refs/heads/no-such-base", null)(".packages/package-lock.json")
    && stoodAt(core, "HEAD", { lockfiles: { a: 1 } })(".packages/package-lock.json") && stoodAt(core, "HEAD", { lockfiles: 7 })(".packages/package-lock.json"),
    "a lock file stood where the base's tree held it as a file its config did not name; a folder, a name the base's config held, no base and a base that cannot be read are none, and a base's config whose list is of another form names none");
}

// where git lists nothing, it says so, failing a pull request and nothing else; the check gives its failures and reports
{
  const r = unnamedLocks(".", null, config, null, () => false), pr = unnamedLocks(".", null, config, "HEAD^1", () => false);
  ok(r.failures.length === 0 && r.reports.length === 1 && r.reports[0].includes("could not be listed") && r.reports[0].includes("Mend: run the check in the project's git checkout"),
    "where the lock files cannot be listed with no base it says so, with its mend, and fails nothing", JSON.stringify(r));
  ok(pr.reports.length === 0 && pr.failures.length === 1 && pr.failures[0].includes("could not be listed") && mended(asOutput(pr.failures)),
    "on a pull request, where they cannot be listed, it fails, saying its mend", JSON.stringify(pr));
  const dir = scratchDir("licence-locks-nogit-");
  try {
    const off = check({ ships: [], lockfiles: [] }, dir, null);
    ok(off.failures.length === 0 && off.reports.some((m) => m.includes("could not be listed")), "the check reports it, outside a git checkout", JSON.stringify(off));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const core = fileURLToPath(new URL("..", import.meta.url));
  const added = check({ ships: [], lockfiles: [] }, core, "refs/heads/no-such-base", null), stood = check({ ships: [], lockfiles: [] }, core, "HEAD", null);
  ok(says(added.failures, ".packages/package-lock.json").length === 1 && says(stood.failures, ".packages/package-lock.json").length === 0 && says(stood.reports, ".packages/package-lock.json").length === 1,
    "the check fails a lock file its base does not hold and reports one it held, on the core's own checkout with a config that names none", JSON.stringify({ added: added.failures.slice(0, 3), stood: stood.reports.slice(0, 3) }));
}

// the core's own config: each list's form is read before its names, so a list of another form fails with its mend
{
  const dir = scratchDir("licence-locks-core-"), at = join(dir, "licences.json");
  const refuses = (text) => { writeFileSync(at, text); try { coreConfig(at); return ""; } catch (e) { return e.message; } };
  try {
    const forms = ['{"data":7}', '{"fonts":{"a":1}}', '{"accepted":"x"}', "[]", "null", '{"accepted":[null]}', '{"accepted":[["a@1.0.0"]]}'].map(refuses);
    const names = ['{"fonts":["Not A Name"]}', '{"accepted":[{"package":"foo"}]}', '{"accepted":[{"package":7}]}'].map(refuses);
    ok(forms.every((m) => /is not an object whose "data", "fonts" and "accepted" are each a list, each entry of "accepted" an object\. Mend: /u.test(m)) && names.every((m) => /no npm package name.*\. Mend: /u.test(m))
      && refuses('{"data":["x"]}') === "" && refuses('{"accepted":[{"package":"a@1.0.0"},{"files":["x"]}]}') === "",
      "the core's own config whose lists or entries are of another form, or that is no object, is refused with its mend, and its names are read after", [...forms, ...names].join("\n"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// a folder named like the other lock file of a pair is no twin of the named one: nothing installs from it
{
  const dir = scratchDir("licence-locks-folder-");
  try {
    for (const [f, text] of [["package-lock.json", { lockfileVersion: 3, packages: {} }], ["package.json", { name: "x", version: "1.0.0" }], ["audit.json", { entries: [] }], ["NPM-SHRINKWRAP.JSON/x", {}]]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), JSON.stringify(text));
    }
    const r = check({ ships: [], lockfiles: ["package-lock.json"], audit: "audit.json" }, dir, "HEAD", null);
    ok(![...r.failures, ...r.reports].some((m) => m.includes("stands beside it")), "a folder beside the lock file is no twin", JSON.stringify(r));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

done();
