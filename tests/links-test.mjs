// Checks the pointer check's maintained link checker (scripts/links.mjs; #582): how lychee's list of links and its report
// are read, what the core decides of them against a base, and the pointer check (scripts/pointers.mjs) end to end with a
// stand-in for lychee, which no test runs: where it was fetched, where it was not and where it could not run. Run by the
// core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/links-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { baseTree, checkRules, compared, listed, lycheeReads, readable, reported, run, target } from "../scripts/links.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, out = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (out) console.log(String(out).slice(0, 2000)); } };
const here = fileURLToPath(new URL("../scripts/", import.meta.url));

// What lychee wrote, read
const root = path.resolve("/project"), url = p => pathToFileURL(path.join(root, p)).href;
ok(target(url("docs/a b.md"), root) === "docs/a b.md" && target(`${url("b.md")}#x`, root) === "b.md" && target(`${url("b.md")}?plain=1`, root) === "b.md"
  && target(pathToFileURL(path.resolve("/elsewhere/c.md")).href, root) === null && target("https://example.invalid/x", root) === undefined && target("mailto:a@example.invalid", root) === undefined,
  "a link lychee wrote leads to its path from the project's root, its heading and query aside; one out of the project is null; a web or mail address is not the core's to read");
ok(readable(Buffer.from("plain text, æøå\n")) && !readable(Buffer.from([0x53, 0xff, 0xfe, 0x0a])), "a file that is no UTF-8 is one lychee reads nothing of");
const text = f => ({ "a.md": "# A\n\nSee [b](b.md#gone) and [u](untracked.md).\n\nAnd [o](../outside.md).\n" })[f];
const dump = [`${url("b.md")}#gone`, url("untracked.md"), pathToFileURL(path.resolve("/outside.md")).href, "https://example.invalid/x", url("docs/")].join("\n");
const at = { root, tracked: new Set(["a.md", "b.md", "docs/x.md"]), folders: new Set(["docs/"]), text };
const list = listed("a.md", dump, at);
ok(list.count === 4 && list.found.length === 2 && list.found.some(f => f.kind === "file" && f.to === "untracked.md" && f.line === 3) && list.found.some(f => f.kind === "outside" && f.line === 5)
  && !list.found.some(f => f.to === "b.md" || f.to === "docs" || /example/.test(f.to)),
  "a link to a file git does not track, or out of the project, is the core's finding from lychee's list, each at its line; a tracked file, a tracked folder and a web address pass", JSON.stringify(list));
const report = JSON.stringify({ error_map: { [path.join(root, "a.md")]: [{ url: `${url("b.md")}#gone`, status: { text: "Cannot find fragment" } }, { url: url("untracked.md"), status: { text: "File not found. Check if file exists and path is correct" } }] } });
const heads = reported(report, at);
ok(heads?.length === 1 && heads[0].kind === "heading" && heads[0].file === "a.md" && heads[0].to === "b.md#gone" && heads[0].line === 3,
  "a heading not there is lychee's finding, at its line; a file it did not find is left to the core's reading of its list", JSON.stringify(heads));
const bad = reported(JSON.stringify({ error_map: { [path.join(root, "a.md")]: [{ url: `${url("b.md")}#%E0%A4%A`, status: { text: "Cannot find fragment" } }] } }), at);
ok(heads[0].path === "b.md" && reported(JSON.stringify({ error_map: { [path.join(root, "a.md")]: [{ url: `${url("a#b.md")}#gone`, status: { text: "Cannot find fragment" } }] } }), at)?.[0]?.path === "a#b.md",
  "a heading's finding keeps the path it leads to apart from its \"#\" part, a \"#\" in a file's name kept (#582's review)");
ok(bad?.length === 1 && bad[0].to === "b.md#%E0%A4%A", "a heading written with an escape no browser decodes is a finding as it stands, never a crash (#582's review)", JSON.stringify(bad));
ok(lycheeReads("AGENTS.md") && lycheeReads("docs/a b.mdx") && !lycheeReads(".kiro/agents/a.json") && !lycheeReads("docs/x.txt") && !lycheeReads(".kiro/steering/b\n/etc/hostname.md") && !lycheeReads("docs/[a].md") && !lycheeReads("docs/*.md"),
  "lychee is given a Markdown file whose name holds no control character or pattern; any other is left to the core's own reading");
ok(reported("{", at) === null && reported("null", at) === null, "a report that is no JSON lychee writes is no answer");

// Against the base
const f = (line, to, kind = "heading") => ({ file: "AGENTS.md", line, kind, to, said: "names a heading that is not there" });
const held = compared([f(9, "b.md#x"), f(4, "b.md#y")], [f(3, "b.md#x")]), none = compared([f(9, "b.md#x")], null), core = compared([f(9, "b.md#x")], []);
ok(held.fails.length === 1 && /b\.md#y/.test(held.fails[0]) && mended(`FAIL ${held.fails[0]}`) && held.notes.length === 1 && /b\.md#x.*as on the base, so it fails nothing/.test(held.notes[0]),
  "a finding the base held, moved to another line, is noted; a new one fails, saying its mend", JSON.stringify(held));
ok(none.fails.length === 0 && /with no base to read against/.test(none.notes[0]) && core.fails.length === 1 && core.notes.length === 0, "with no base each is noted; against an empty base, as in the core's run, each fails");
ok(compared([f(1, "b.md#x"), f(2, "b.md#x")], [f(1, "b.md#x")]).fails.length === 1, "of two alike where the base held one, one fails");
const out = (to, file = "AGENTS.md") => ({ file, line: 2, kind: "outside", to, said: "leads out of the project" });
ok(compared([out("../away.md")], [out("../../x/away.md")]).fails.length === 0 && compared([out("../away.md")], [out("../away.md", "SECURITY.md")]).fails.length === 1,
  "a link out of the project the base held in the same file is noted, though the base's tree stands in another folder; one in another file fails");

// The pointer check end to end, with a stand-in for lychee: it lists each [text](path) of a file as lychee's --dump does,
// and reports each "#heading" whose file holds no such heading as lychee's --include-fragments does; in a file that is no
// Markdown it reads no such link, as lychee reads it as plain text
const FAKE = `import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const a = process.argv.slice(2), root = a[a.indexOf("--root-dir") + 1];
if (process.env.FAKE_LYCHEE_FAIL || (process.env.FAKE_LYCHEE_FAIL_BASE && /links-base-/.test(root))) { console.error("it broke"); process.exit(1); }
const links = file => !/\\.md$/.test(file) ? [] : [...fs.readFileSync(file, "utf8").matchAll(/\\]\\(([^)\\s]+)\\)/g)].map(m => m[1]).filter(l => !/^[a-z]+:/i.test(l))
  .map(l => { const [p, h] = l.split("#"); const at = p === "" ? file : p.startsWith("/") ? path.join(root, p) : path.resolve(path.dirname(file), p); return { href: pathToFileURL(at).href + (h ? "#" + h : ""), at, h }; });
if (a.includes("--dump")) { for (const l of links(a.at(-1))) console.log(l.href); process.exit(0); }
const errors = {};
for (const file of a.slice(a.indexOf("--") + 1))
  for (const l of links(file)) if (l.h && fs.existsSync(l.at) && !fs.readFileSync(l.at, "utf8").split("\\n").some(x => /^#+ /.test(x) && x.replace(/^#+ /, "").toLowerCase().replace(/ /g, "-") === l.h)) (errors[file] ??= []).push({ url: l.href, status: { text: "Cannot find fragment" } });
console.log(JSON.stringify({ error_map: errors })); process.exit(Object.keys(errors).length ? 2 : 0);
`;
const carry = core => {
  fs.mkdirSync(path.join(core, "scripts"), { recursive: true });
  for (const s of ["pointers.mjs", "names.mjs", "links.mjs", "markdown.mjs", "packages.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "mend.mjs"]) fs.copyFileSync(path.join(here, s), path.join(core, "scripts", s));
  for (const s of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/marked"]) fs.cpSync(path.join(here, "../.packages", s), path.join(core, ".packages", s), { recursive: true });
};
const AGENTS = "# A project\n\n## Where things are\n\nIts rules: `SECURITY.md`, and [the developing notes](docs/developing.md#running-it).\n";
const FILES = { "AGENTS.md": AGENTS, "SECURITY.md": "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/developing.md`;\n", "docs/developing.md": "# Developing\n\n## Running it\n\nText.\n" };
if (process.platform !== "win32") {
  const dir = scratchDir("links-test-"), tools = scratchDir("links-fake-"), STANDIN = path.join(tools, "lychee");
  fs.writeFileSync(path.join(tools, "fake.mjs"), FAKE);
  fs.writeFileSync(STANDIN, `#!/bin/sh\nexec "${process.execPath}" "${path.join(tools, "fake.mjs")}" "$@"\n`, { mode: 0o755 });
  const g = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
  try {
    const LYCHEE = STANDIN;
    const check = env => { const r = spawnSync(process.execPath, [path.join(dir, "core/scripts/pointers.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, LYCHEE: "", POINTERS_BASE: "", ...env } }); return { code: r.status, out: r.stdout + r.stderr }; };
    for (const [f, t] of Object.entries(FILES)) put(f, t);
    carry(path.join(dir, "core"));
    g("init", "-q"); g("add", "-A"); g("commit", "-q", "-m", "base");
    let r = check({ LYCHEE });
    ok(r.code === 0 && !/did not run lychee/.test(r.out), "with lychee, a link to a heading that is there passes", r.out);
    // (a heading the pull request renames, a link the base did not hold to one that is gone)
    put("docs/developing.md", "# Developing\n\n## Running the game\n\nText.\n");
    g("add", "-A");
    r = check({ LYCHEE, POINTERS_BASE: "HEAD" });
    ok(r.code === 1 && /AGENTS\.md:5: the link to docs\/developing\.md#running-it names a heading that is not there/.test(r.out) && mended(r.out), "a heading the change renamed, which a rule file's link still names, fails against the base, saying its mend", r.out);
    r = check({});
    ok(r.code === 0 && /::warning::The pointer check did not run lychee: it was not fetched here/.test(r.out), "without lychee, the check says it did not run it, and the core's own reading, which reads no heading, stands in", r.out);
    g("commit", "-q", "-m", "renamed");
    r = check({ LYCHEE, POINTERS_BASE: "HEAD" });
    ok(r.code === 0 && /note .*docs\/developing\.md#running-it .*as on the base, so it fails nothing/.test(r.out), "one the base held is noted and fails nothing (nothing locks a project)", r.out);
    r = check({ LYCHEE });
    ok(r.code === 0 && /with no base to read against/.test(r.out), "with no base, as on a push to main, it is noted", r.out);
    // (a base lychee could not read decides nothing: a new broken link is only noted, the lead line saying why)
    put("AGENTS.md", `${AGENTS}\nAnd [more](docs/developing.md#also-gone).\n`);
    g("add", "AGENTS.md");
    r = check({ LYCHEE, POINTERS_BASE: "HEAD", FAKE_LYCHEE_FAIL_BASE: "1" });
    ok(r.code === 0 && /note the rule files' links at the pull request's base could not be read by lychee \(it ended with status 1: it broke\), so each broken link below is only noted\. Mend: /.test(r.out) && /note .*#also-gone .*the base unread, so it fails nothing/.test(r.out),
      "a base lychee could not read decides nothing: each finding is noted, and the note says the base was unread", r.out);
    g("checkout", "-q", "--", "AGENTS.md"); g("reset", "-q");
    // (a file git does not track is no file the link leads to, though it stands on the disk; nor one out of the project)
    put("AGENTS.md", `${AGENTS}\nAnd [the notes](notes.md) and [one away](../away.md).\n`);
    put("notes.md", "# Notes\n");
    fs.writeFileSync(path.join(path.dirname(dir), "away.md"), "# Away\n");
    g("add", "AGENTS.md");
    r = check({ LYCHEE, POINTERS_BASE: "HEAD" });
    ok(r.code === 1 && /the link to notes\.md leads to no tracked file or folder/.test(r.out) && /the link to \.\.\/away\.md leads out of the project/.test(r.out) && mended(r.out),
      "a link to a file on the disk that git does not track fails, and one out of the project", r.out);
    // (a rule file that is no Markdown is read the core's way, with lychee fetched: lychee reads no [text](path) in it)
    put("SECURITY.md", FILES["SECURITY.md"].replace("`docs/developing.md`;", "`docs/developing.md`, `docs/agent.json`;"));
    put("docs/agent.json", "{ \"prompt\": \"See [the gone notes](gone.md).\" }\n");
    g("add", "-A");
    r = check({ LYCHEE, POINTERS_BASE: "HEAD" });
    ok(r.code === 1 && /docs\/agent\.json:1: the link to gone\.md leads to no tracked file or folder/.test(r.out), "a rule file that is no Markdown keeps the core's own reading of its links, with lychee fetched", r.out);
    fs.rmSync(path.join(path.dirname(dir), "away.md"));
    r = check({ FAKE_LYCHEE_FAIL: "1", LYCHEE, POINTERS_BASE: "HEAD" });
    ok(r.code === 1 && /::warning::The pointer check could not run lychee on the rule files \(it ended with status 1: it broke\)/.test(r.out) && /the link to \.\.\/away\.md leads to no tracked file or folder/.test(r.out),
      "where lychee could not run, the check says why, and the core's own reading stands in", r.out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  // (a base whose rule file git archive would leave out, by export-ignore, or that is a link: it is read from git's own
  // blobs, so a broken link the base held is noted, never a crash; #582's review)
  const two = scratchDir("links-test-attrs-"), g2 = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: two, stdio: "ignore" });
  try {
    for (const [f, t] of Object.entries({ ...FILES, "AGENTS.md": AGENTS.replace("#running-it", "#gone"), ".gitattributes": "AGENTS.md export-ignore\nSECURITY.md export-subst\n" })) { fs.mkdirSync(path.dirname(path.join(two, f)), { recursive: true }); fs.writeFileSync(path.join(two, f), t); }
    carry(path.join(two, "core"));
    g2("init", "-q"); g2("add", "-A"); g2("commit", "-q", "-m", "base");
    fs.appendFileSync(path.join(two, "SECURITY.md"), "\nMore.\n"); g2("add", "-A");
    const r = spawnSync(process.execPath, [path.join(two, "core/scripts/pointers.mjs")], { cwd: two, encoding: "utf8", env: { ...process.env, LYCHEE: STANDIN, POINTERS_BASE: "HEAD" } });
    ok(r.status === 0 && /note .*AGENTS\.md:5: the link to docs\/developing\.md#gone .*as on the base, so it fails nothing/.test(r.stdout + r.stderr), "a rule file the base's attributes leave out of an archive is read from git's own blobs: what the base held is noted", r.stdout + r.stderr);
    // (a heading the base held in a file under a linked folder, which is no rule file: the finding's path, its "#" part
    // apart, reaches the base's files, so it is noted, never failed as new; #582's review)
    const three = fs.realpathSync(scratchDir("links-test-folder-")), g3 = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: three, stdio: "ignore" });
    const back = process.cwd();
    try {
      fs.mkdirSync(path.join(three, "guide"));
      fs.writeFileSync(path.join(three, "guide/README.md"), "# Guide\n\n## There\n");
      fs.symlinkSync("guide", path.join(three, "docs"));
      fs.writeFileSync(path.join(three, "AGENTS.md"), "# A\n\nSee [it](docs/README.md#gone).\n");
      g3("init", "-q"); g3("add", "-A"); g3("commit", "-q", "-m", "base");
      process.chdir(three);
      const tracked = new Set(["AGENTS.md", "docs", "guide/README.md", "docs/README.md"]), // (the path through the link counted as tracked, so the heading's own path alone can bring the file to the base)
      got = checkRules({ program: STANDIN, rules: ["AGENTS.md"], tracked, folders: new Set(["guide/"]), text: f => fs.readFileSync(f, "utf8"), base: execFileSync("git", ["rev-parse", "HEAD"], { cwd: three, encoding: "utf8" }).trim() });
      ok(!got.unread && got.fails.length === 0 && got.notes.some(n => /docs\/README\.md#gone .*as on the base/.test(n)), "a heading the base held, in a file under a linked folder that is no rule file, is noted, never failed as new", JSON.stringify(got));
    } finally { process.chdir(back); fs.rmSync(three, { recursive: true, force: true }); }
  } finally { for (const d of [two, tools]) fs.rmSync(d, { recursive: true, force: true }); }
}
// (the base's files written from git's own blobs: a tree that names "..", a link inside the project and one out of it, a
// linked folder and a page; nothing is written out of the folder, the links inside are read through, the one out is not;
// #582's review. A path given that names "..", readAt() already refuses on its own: safe() on the paths guards a name
// with a backslash, which only Windows, where this case does not run, reads as a separator)
{
  const repo = scratchDir("links-test-tree-"), under = scratchDir("links-test-under-"), gi = (args, input) => execFileSync("git", args, { cwd: repo, input, encoding: "utf8" }).trim();
  try {
    gi(["init", "-q"]);
    const blob = t => gi(["hash-object", "-w", "--stdin"], t);
    const evil = gi(["mktree"], `100644 blob ${blob("# Evil\n")}\tevil.md\n`);
    const guide = gi(["mktree"], `100644 blob ${blob("# Guide\n\n## There\n")}\tREADME.md\n`);
    const tree = gi(["mktree"], [`040000 tree ${evil}\t..`, `040000 tree ${guide}\tguide`, `120000 blob ${blob("guide")}\tdocs`, `100644 blob ${blob("# Agents\n\n## Here\n")}\tAGENTS.md`, `120000 blob ${blob("AGENTS.md")}\tlink.md`, `120000 blob ${blob("/etc/hostname")}\tout.md`, `100644 blob ${blob("<h2 id=\"x\">X</h2>\n")}\tapi.html`].join("\n") + "\n");
    const sha = gi(["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit-tree", tree, "-m", "base"]);
    process.chdir(repo);
    const was = baseTree(sha, under, ["AGENTS.md", "link.md", "docs/README.md", "../escape.md"]);
    const at = f => fs.existsSync(path.join(was?.dir ?? "/nowhere", f));
    ok(was && at("AGENTS.md") && at("api.html") && at("link.md") && fs.readFileSync(path.join(was.dir, "link.md"), "utf8").includes("## Here") && !at("out.md") && at("docs/README.md") && fs.readFileSync(path.join(was.dir, "docs/README.md"), "utf8").includes("## There") && !fs.readdirSync(under).some(f => f === "evil.md") && !fs.existsSync(path.join(path.dirname(was.dir), "evil.md")) && was.tracked.has("AGENTS.md"),
      "the base's files are written from git's blobs: a page, a link inside the project and a file under a linked folder read through, a link out of it not, and nothing out of the folder for a tree that names \"..\"", JSON.stringify(was && fs.readdirSync(was.dir)));
    if (was) fs.rmSync(was.dir, { recursive: true, force: true });
  } finally { process.chdir(path.dirname(fileURLToPath(import.meta.url))); for (const d of [repo, under]) fs.rmSync(d, { recursive: true, force: true }); }
}
// (lychee itself, where the job's set-up fetched it, never in a session: its command line and its report as the glue reads them)
if (process.env.LYCHEE) {
  const real = fs.realpathSync(scratchDir("links-test-real-"));
  try {
    fs.writeFileSync(path.join(real, "a.md"), "# A\n\nSee [b](b.md#gone), [c](c.md) and [h](b.md#here).\n");
    fs.writeFileSync(path.join(real, "b.md"), "# B\n\n## Here\n");
    const got = run({ program: process.env.LYCHEE, root: real, files: ["a.md"], tracked: new Set(["a.md", "b.md"]), folders: new Set(), text: f => fs.readFileSync(path.join(real, f), "utf8") });
    ok(!got.unread && got.count === 3 && got.found.length === 2 && got.found.some(f => f.kind === "heading" && f.to === "b.md#gone" && f.line === 3) && got.found.some(f => f.kind === "file" && f.to === "c.md"),
      "lychee itself reads a heading not there and a file not there, as the glue reads its list and its report", JSON.stringify(got));
  } finally { fs.rmSync(real, { recursive: true, force: true }); }
}
if (failed) { console.log(`FAIL ${failed} of the link checker's cases`); process.exit(1); }
