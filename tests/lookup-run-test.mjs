#!/usr/bin/env node
// Tests of lookup.mjs run as the check runs on a project: in a scratch git repository with a lock file (or a requirements
// file in PyPI's lock form, #716), a licence config and a workflow, each answer of a registry recorded (lookup-stage.mjs)
// and handed to it in place of the network (floor rule 8: no live call, no real package). The lookup's own readers and
// answers are lookup-test.mjs's and lookup-pypi-test.mjs's. Run: node tests/lookup-run-test.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { alongside } from "../scripts/licences.mjs";
import { namedBase, run } from "../scripts/lookup.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { INVENTED_SUM, NOW, asked, get, tgz } from "../scripts/lookup-stage.mjs";

let failed = 0, r;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };

// ---- The check on a project
const tmp = scratchDir("lookup-test-");
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: tmp, encoding: "utf8" }).trim();
try {
  git("init", "-q");
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
  writeFileSync(join(tmp, "package.json"), "{}");
  // (each entry with an integrity value, as npm writes one, unless the test says otherwise)
  const write = (packages) => writeFileSync(join(tmp, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...Object.fromEntries(Object.entries(packages).map(([k, e]) => [k, { integrity: INVENTED_SUM, ...e }])) } }));
  write({ "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format") } });
  mkdirSync(join(tmp, "fixtures"), { recursive: true });
  writeFileSync(join(tmp, "fixtures/package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0"), integrity: INVENTED_SUM } } }));
  git("add", "-A"); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  const config = join(tmp, "licences.json");
  r = await run(config, { root: tmp, base: null, get, now: NOW, event: "push" });
  ok(r.code === 0 && /nothing looked up/u.test(r.lines.join("\n")), "with no base, as on a push, nothing is new and nothing is asked");
  r = await run(config, { root: tmp, base: null, get, now: NOW, event: "pull_request" });
  ok(r.code === 1 && mended(r.lines.join("\n")) && /fetch-depth: 2/u.test(r.lines[0]), `with no base on a pull request, it fails, saying the mend (${r.lines})`);
  asked.length = 0;
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 0 && asked.length === 0 && /ok {3}0 new packages/u.test(r.lines.join("\n")), `what the base held is not looked up (${r.lines})`);
  write({ "node_modules/tidy-moss-format": { version: "1.2.0", resolved: tgz("tidy-moss-format", "1.2.0") }, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0") } });
  r = await run(config, { root: tmp, base, get, now: NOW });
  const out = r.lines.join("\n");
  ok(r.code === 1 && mended(out) && /^FAIL: package-lock\.json: never-published-moss@1\.0\.0/mu.test(out) && !/tidy-moss-format/u.test(out) && /1 of 1 new package fail/u.test(out), `an update passes unlooked, and a new name the registry lacks fails, saying the mend, though a lock file the config does not name held it (${r.lines})`);
  // A lock file merged as data, which the pull request then names in the config: its names are new, not held.
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json", "fixtures/package-lock.json"], ships: [] }));
  write({ "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format") }, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0") } });
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && /^FAIL: package-lock\.json: never-published-moss@1\.0\.0/mu.test(r.lines.join("\n")), `a lock file the pull request newly names in the config makes no name held (${r.lines})`);
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
  // A lock file the pull request makes a link to a file outside the project: refused, and nothing of the file printed.
  const outside = scratchDir("lookup-outside-");
  writeFileSync(join(outside, "secret.txt"), "invented-secret-text-not-json");
  rmSync(join(tmp, "package-lock.json"));
  symlinkSync(join(outside, "secret.txt"), join(tmp, "package-lock.json"));
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-secret/u.test(r.lines.join("\n")), `a lock file that links out of the project is refused, unread (${r.lines})`);
  // The config itself, made a link out of the project: refused before it is opened, under either flag.
  symlinkSync(join(outside, "secret.txt"), join(tmp, "linked.json"));
  for (const nuget of [false, true]) {
    r = await run(join(tmp, "linked.json"), { root: tmp, base, nuget, get, now: NOW });
    ok(r.code === 1 && mended(r.lines.join("\n")) && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-secret/u.test(r.lines.join("\n")), `a config that links out of the project is refused, unread${nuget ? ", for NuGet too" : ""} (${r.lines})`);
  }
  // Run from the folder above the project, a config that links out of the project into that folder is refused too.
  writeFileSync(join(tmp, "..", `${basename(tmp)}-beside.json`), JSON.stringify({ "invented-outside-key": 1 }));
  rmSync(join(tmp, "linked.json"));
  symlinkSync(join(tmp, "..", `${basename(tmp)}-beside.json`), join(tmp, "linked.json"));
  const here = process.cwd();
  process.chdir(join(tmp, ".."));
  try { r = await run(join(basename(tmp), "linked.json"), { root: tmp, base, get, now: NOW }); } finally { process.chdir(here); }
  ok(r.code === 1 && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-outside-key/u.test(r.lines.join("\n")), `run from the folder above, a config that links into it is refused, unread (${r.lines})`);
  rmSync(join(tmp, "..", `${basename(tmp)}-beside.json`));
  rmSync(join(tmp, "linked.json"));
  writeFileSync(join(tmp, "broken.json"), "{ invented-config-text");
  r = await run(join(tmp, "broken.json"), { root: tmp, base, nuget: true, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && !/invented-config-text/u.test(r.lines.join("\n")), `a NuGet config that is no JSON fails, quoting none of it (${r.lines})`);
  rmSync(join(tmp, "broken.json"));
  rmSync(join(tmp, "package-lock.json")); rmSync(outside, { recursive: true, force: true });
  writeFileSync(join(tmp, "package-lock.json"), "{ not json");
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && !/not json/u.test(r.lines.join("\n")), `a lock file that cannot be read fails, saying the mend and quoting none of it (${r.lines})`);
} finally { rmSync(tmp, { recursive: true, force: true }); }

// ---- PyPI's lock form on a project (#716): a config that names a requirements file under "pypi"
{
  const ptmp = scratchDir("lookup-pypi-run-");
  const H = (c = "a") => `--hash=sha256:${c.repeat(64)}`;
  const pypiAsked = [];
  // (the stage's answers hold none of PyPI's, so each name PyPI is asked of reads as one it does not know)
  // (save the few of PyPI's this block records: a held package's releases, each file's digest of invented bytes, and what
  // it requires at a version)
  const release = (v, c) => [{ filename: `tidy_moss_format-${v}-py3-none-any.whl`, upload_time_iso_8601: "2024-01-01T00:00:00Z", yanked: false, digests: { sha256: c.repeat(64) } }];
  const pypiAnswers = {
    "https://pypi.org/pypi/tidy-moss-format/json": { status: 200, json: { info: {}, releases: { "1.1.0": release("1.1.0", "a"), "2.0.0": release("2.0.0", "b") } } },
    "https://pypi.org/pypi/tidy-moss-format/1.1.0/json": { status: 200, json: { info: { requires_dist: ["brought-moss>=1; extra == 'fast'"] } } },
  };
  for (const name of ["brought-moss", "unrequired-moss"]) pypiAnswers[`https://pypi.org/pypi/${name}/json`] = { status: 200, json: { info: {}, releases: { "1.0.0": release("1.0.0", "a") } } };
  const npmGet = async (url) => { if (url.startsWith("https://pypi.org/")) pypiAsked.push(url); return url.startsWith("https://registry.npmjs.org/") ? { status: 404 } : pypiAnswers[url] ?? get(url); };
  const pgit = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: ptmp, encoding: "utf8" }).trim();
  try {
    pgit("init", "-q");
    const config = join(ptmp, "licences.json");
    const settings = (pypi) => writeFileSync(config, JSON.stringify({ lockfiles: ["package-lock.json"], ships: [], ...(pypi ? { pypi } : {}) }));
    settings(["requirements.txt"]);
    writeFileSync(join(ptmp, "package.json"), "{}");
    writeFileSync(join(ptmp, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format"), integrity: INVENTED_SUM } } }));
    writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n`);
    writeFileSync(join(ptmp, "data.txt"), `never-published-moss==1.0.0 ${H()}\n`);
    pgit("add", "-A"); pgit("commit", "-qm", "base");
    const base = pgit("rev-parse", "HEAD");
    pypiAsked.length = 0;
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 0 && !pypiAsked.length && r.lines.includes("ok   0 new packages looked up in PyPI, each printed above for the review"), `what the base held is not looked up (${r.lines})`);
    pypiAsked.length = 0;
    writeFileSync(join(ptmp, "requirements.txt"), `Tidy_Moss_Format==2.0.0 ${H("b")}\nnever-published-moss==1.0.0 ${H()}\n`);
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    let out = r.lines.join("\n");
    ok(r.code === 1 && mended(out) && /^FAIL: requirements\.txt: never-published-moss@1\.0\.0: PyPI has no such package/mu.test(out) && !/tidy-moss-format/u.test(out) && /1 of 1 new package fail/u.test(out) && /ok {3}0 new packages looked up in the npm registry/u.test(out) && out.includes("ok   1 changed line of packages the base held, each hash compared with PyPI's list") && !pypiAsked.some((u) => u.includes("/integrity/")), `an update, in any spelling, is not looked up but for its hashes, which PyPI lists, and a new name PyPI lacks fails, beside npm's lookup (${r.lines})`);
    // (#1388, point 1: the hashes of each line the pull request adds or changes of a package its base held)
    for (const [what, text, names] of [
      ["an update to a hash PyPI lists for another version's file", `tidy-moss-format==2.0.0 ${H("a")}\n`, "tidy-moss-format@2.0.0"],
      ["a hash added beside the one the base held", `tidy-moss-format==1.1.0 ${H()} ${H("f")}\n`, "tidy-moss-format@1.1.0"],
    ]) {
      writeFileSync(join(ptmp, "requirements.txt"), text);
      r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
      out = r.lines.join("\n");
      ok(r.code === 1 && mended(out) && new RegExp(`^FAIL: requirements\\.txt: ${names.replaceAll(".", "\\.")}: 1 of the \\d hash(?:es)? its line names \\(sha256:[0-9a-f]{12}…\\) PyPI lists for no file`, "mu").test(out) && out.includes("1 of 1 changed line of packages the base held name a hash PyPI does not list"), `${what} fails, saying the mend (${r.lines})`);
    }
    writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n`);
    writeFileSync(join(ptmp, "more.txt"), `tidy-moss-format==1.1.0 ${H("f")}\n`);
    settings(["requirements.txt", "more.txt"]);
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 1 && /^FAIL: more\.txt: tidy-moss-format@1\.1\.0: 1 of the 1 hash/mu.test(r.lines.join("\n")) && !/^FAIL: requirements\.txt/mu.test(r.lines.join("\n")), `a held package named in a file the pull request newly names has its hashes compared there, and the line that stood is not (${r.lines})`);
    // (#1388, point 2: a "# via" parent counts only where PyPI lists it as requiring the package)
    for (const [what, line, named] of [["a parent that does not require it", "unrequired-moss==1.0.0", true], ["a parent that requires it", "brought-moss==1.0.0", false]]) {
      writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n    # via -r requirements.in\n${line} ${H()}\n    # via tidy-moss-format\n`);
      settings(["requirements.txt"]);
      r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
      out = r.lines.join("\n");
      const said = named ? /^REPORT: requirements\.txt: unrequired-moss@1\.0\.0: named by the project \(its "# via" names tidy-moss-format, which PyPI does not list/mu : /^REPORT: requirements\.txt: brought-moss@1\.0\.0: brought by tidy-moss-format;/mu;
      ok(said.test(out) && pypiAsked.includes("https://pypi.org/pypi/tidy-moss-format/1.1.0/json"), `${what}: its parent's requirements are asked of PyPI at the version the file holds, and the report says what brings it (${r.lines})`);
    }
    rmSync(join(ptmp, "more.txt"));
    writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n`);
    settings(["requirements.txt", "data.txt"]);
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 1 && /^FAIL: data\.txt: never-published-moss@1\.0\.0/mu.test(r.lines.join("\n")), `a file the pull request newly names under "pypi" makes no name held (${r.lines})`);
    for (const pypi of [null, []]) {
      settings(pypi);
      writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\nnever-published-moss==1.0.0 ${H()}\n`);
      r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
      ok(r.code === 1 && /^FAIL: requirements\.txt: never-published-moss@1\.0\.0/mu.test(r.lines.join("\n")), `a file the base's config named is read though the pull request takes it out of "pypi" (${JSON.stringify(pypi)}) (${r.lines})`);
    }
    writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n`);
    pgit("add", "-A"); pgit("commit", "-qm", "no pypi");
    r = await run(config, { root: ptmp, base: pgit("rev-parse", "HEAD"), get: npmGet, now: NOW });
    ok(r.code === 0 && !r.lines.some((l) => /PyPI/u.test(l)), `a config that names no "pypi", nor its base's, asks nothing of PyPI, and says nothing of it (${r.lines})`);
    rmSync(join(ptmp, "requirements.txt"));
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 0, `a file the base's config named, taken out of the project with its name, is not read (${r.lines})`);
    writeFileSync(join(ptmp, "requirements.txt"), `tidy-moss-format==1.1.0 ${H()}\n`);
    writeFileSync(config, JSON.stringify({ ships: [], pypi: ["requirements.txt"] }));
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 0 && r.lines.includes("ok   0 new packages looked up in PyPI, each printed above for the review"), `a config that names PyPI's files alone, no lock file of npm's, is read (${r.lines})`);
    settings(["requirements.txt"]);
    writeFileSync(join(ptmp, "requirements.txt"), "loose-moss>=1.0\n");
    r = await run(config, { root: ptmp, base, get: npmGet, now: NOW });
    ok(r.code === 1 && mended(r.lines.join("\n")) && /requirements\.txt, line 1: a package not at one exact version/u.test(r.lines.join("\n")), `a file not in PyPI's lock form fails, saying the mend (${r.lines})`);
  } finally { rmSync(ptmp, { recursive: true, force: true }); }
}

// ---- The base named HEAD^1 (#1231): the merge's first parent, taken only where HEAD is a merge
{
  const dir = scratchDir("lookup-parent-test-");
  const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const was = { log: console.log, error: console.error, event: process.env.GITHUB_EVENT_NAME, base: process.env.LOOKUP_BASE, offline: process.env.CORE_OFFLINE };
  const named = (name) => { process.env.LOOKUP_BASE = name; return namedBase(dir); };
  const beside = async (name) => {
    const lines = [];
    console.log = console.error = (l) => lines.push(String(l));
    process.env.GITHUB_EVENT_NAME = "pull_request"; process.env.LOOKUP_BASE = name;
    try { return { failed: await alongside(join(dir, "c.json"), dir), out: lines.join("\n") }; } finally { console.log = was.log; console.error = was.error; }
  };
  try {
    g("init", "-q", "-b", "main");
    writeFileSync(join(dir, "c.json"), JSON.stringify({ ships: ["package.json"], lockfiles: ["package-lock.json"] }));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", dependencies: { a: "^1.2.3" } }));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: { a: "^1.2.3" } }, "node_modules/a": { version: "1.2.3", license: "MIT", resolved: "https://registry.npmjs.org/a/-/a-1.2.3.tgz" } } }));
    g("add", "-A"); g("commit", "-q", "-m", "base");
    writeFileSync(join(dir, "y.txt"), "y"); g("add", "-A"); g("commit", "-q", "-m", "an earlier commit of the head");
    ok(named("HEAD^1") === null, "HEAD^1 named on a head that is no merge is not taken: it would be the pull request's own earlier commit");
    const alone = await beside("HEAD^1");
    ok(alone.failed && mended(alone.out) && /the job names the pull request's base \(LOOKUP_BASE\), and its checkout does not hold that commit/u.test(alone.out), `and beside the licence check it fails as a base not held, saying its mend (${alone.out})`);
    const first = g("rev-parse", "HEAD~1"), head = g("rev-parse", "HEAD");
    g("checkout", "-q", "--detach", first); g("merge", "-q", "--no-ff", "-m", "the merge", head);
    ok(named("HEAD^1") === first, "HEAD^1 named on a merge is read as its first parent, the base, as a commit");
    ok(named(first) === first && named("f".repeat(40)) === null, "a commit named is read where the checkout holds it, and not where it does not");
    const read = await beside("HEAD^1");
    ok(!read.failed && /stood so at the pull request's base: reported, never failed/u.test(read.out) && !/^FAIL/mu.test(read.out), `and beside the licence check it reads what stood at the base, reported, never failed (${read.out})`);
    process.env.CORE_OFFLINE = "1";
    const cut = await beside("HEAD^1");
    delete process.env.CORE_OFFLINE;
    ok(!cut.failed && /^::warning::The lookup of the packages new to the project did not run: this run's network is cut off.*Mend: run the licence check/mu.test(cut.out) && !/^ok .*lookup/mu.test(cut.out) && !/looked up in the npm registry/u.test(cut.out), `where the run's network is cut off, the lookup beside the licence check does not run, said as a warning with its mend, never as a line that passed (#1368, point 3) (${cut.out})`);
    for (const other of ["HEAD^2", "HEAD~1", "--all", "main", "HEAD^1 "]) ok(named(other) === null, `a base named ${JSON.stringify(other)}, neither a commit nor HEAD^1, is not taken`);
  } finally {
    for (const [k, v] of [["GITHUB_EVENT_NAME", was.event], ["LOOKUP_BASE", was.base], ["CORE_OFFLINE", was.offline]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(failed ? `${failed} failing` : "ok   lookup.mjs on a project");
process.exit(failed ? 1 : 0);
