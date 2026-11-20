// TEMPORARY (#582): the trial of lychee, run offline, against the pointer check's reading of Markdown's own links, on the
// same inputs; run by .github/workflows/trial-582.yml on the pull request's runners alone, and taken out before it is
// marked ready.
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { posix } from "node:path";
import { markdownReader } from "./markdown.mjs";

const LYCHEE = process.env.LYCHEE;
const repo = process.cwd(), tmp = fs.realpathSync(fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "trial-582-")));
const away = fs.mkdtempSync(path.join(tmp, "away-")); // a cwd with nothing in it, so no .lycheeignore or lychee.toml of a project's is read
fs.writeFileSync(path.join(tmp, "outside.md"), "# Outside\n");
const read = await markdownReader();
const B = "# B\n\n## A heading\n\n## The `x` file\n\n## Rules: one, two (#3)\n\n## Ærlig tale\n\n## Twice\n\n## Twice\n\n**Lead** of a rule.\n\n<a id=\"custom\"></a>\n\nText.\n";
const one = (text, more = {}) => ({ "a.md": text, "b.md": B, "sub/c.md": "# C\n", "x.js": "// x\n", "my file.md": "# Mine\n", ...more });
const CASES = {
  "a file that is there": one("See [b](b.md).\n"),
  "a file that is not": one("See [gone](gone.md).\n"),
  "a folder, with and without its slash": one("See [s](sub/) and [s](sub).\n"),
  "a folder that is not": one("See [n](nosub/).\n"),
  "a heading in another file": one("See [h](b.md#a-heading).\n"),
  "a heading in another file that is not": one("See [h](b.md#gone).\n"),
  "a heading in its own file, and one not": one("# A\n\n## Own heading\n\nSee [o](#own-heading) and [g](#gone).\n"),
  "a heading with code, punctuation, a letter past ASCII": one("See [c](b.md#the-x-file), [p](b.md#rules-one-two-3), [u](b.md#ærlig-tale).\n"),
  "the second of two headings alike": one("See [t](b.md#twice-1) and [t2](b.md#twice-2).\n"),
  "a heading written in capitals": one("See [h](b.md#A-Heading).\n"),
  "a bold lead, which GitHub gives no anchor": one("See [l](b.md#lead).\n"),
  "an HTML anchor": one("See [c](b.md#custom).\n"),
  "a link with a title, to no file": one("See [t](gone.md \"a title\").\n"),
  "a reference, to no file": one("See [r][ref].\n\n[ref]: gone.md\n"),
  "a reference, to a file": one("See [r][ref].\n\n[ref]: b.md\n"),
  "a path in angle brackets with a blank": one("See [m](<my file.md>).\n"),
  "a path with %20": one("See [m](my%20file.md).\n"),
  "a link inside a code span": one("Write `[g](gone.md)` for a link.\n"),
  "a link inside a fenced block": one("```\n[g](gone.md)\n```\n"),
  "an image that is not": one("![i](gone.png)\n"),
  "an HTML link that is not": one("<a href=\"gone.md\">g</a>\n"),
  "a file not tracked by git": one("See [u](untracked.md).\n"),
  "a file outside the project": one("See [o](../outside.md).\n"),
  "a path from the project's root": one("See [r](/b.md) and [r2](/gone.md).\n", { "sub/d.md": "See [b](/b.md).\n" }),
  "a query, as GitHub takes ?plain=1": one("See [q](b.md?plain=1).\n"),
  "a line anchor in a script": one("See [l](x.js#L1).\n"),
  "a web address and a mail address": one("See [w](https://example.invalid/x) and [m](mailto:a@example.invalid).\n"),
  "a name in the wrong case": one("See [b](B.md).\n"),
  "a link in a table": one("| a | b |\n| --- | --- |\n| [g](gone.md) | x |\n"),
  "a link in a heading": one("# See [g](gone.md)\n"),
  "a link in a list item and a quote": one("- See [g](gone.md).\n\n> And [g2](gone2.md).\n"),
  "a link written across two lines": one("See [a long\ntext](gone.md).\n"),
  "a path with brackets in it": one("See [p](a_(b).md).\n", { "a_(b).md": "# P\n" }),
  "CRLF line ends": one("See [g](gone.md).\r\nAnd [b](b.md#gone).\r\n"),
  "a file in a hidden folder": { ".github/doc.md": "See [g](gone.md).\n" },
  "a link in a front matter": one("---\nlink: \"[g](gone.md)\"\n---\n# A\n"),
  "a link to a folder with a heading": one("See [s](sub/#c).\n"),
  "a link to the README of a folder": one("See [s](sub/c.md#c).\n"),
  "100 000 links, one file": one(Array.from({ length: 100000 }, (_, k) => `[l${k}](b.md#a-heading)`).join("\n") + "\n"),
  "lists nested 5000 deep": one(Array.from({ length: 5000 }, (_, k) => `${"  ".repeat(k)}- x`).join("\n") + "\n[g](gone.md)\n"),
  "quotes nested 20000 deep": one(`${">".repeat(20000)} [g](gone.md)\n`),
  "a file that is no UTF-8": one(Buffer.from([0x53, 0x65, 0x65, 0x20, 0xff, 0xfe, 0x20, 0x5b, 0x67, 0x5d, 0x28, 0x67, 0x6f, 0x6e, 0x65, 0x2e, 0x6d, 0x64, 0x29, 0x0a])),
};

const timed = (cmd, args, cwd, timeout = 120000) => { const t = Date.now(); const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout }); return { ...r, ms: Date.now() - t }; };
const tracked = root => execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
// The pointer check's reading of Markdown's own links (scripts/pointers.mjs, its loop over a file's blocks), on any file.
function old(root, files) {
  const all = tracked(root), set = new Set(all), dirs = new Set(all.flatMap(f => f.split("/").slice(0, -1).map((_, i, p) => p.slice(0, i + 1).join("/") + "/")));
  const found = [], t = Date.now();
  let count = 0;
  for (const rf of files) {
    let md;
    try { md = read(fs.readFileSync(path.join(root, rf), "utf8")); } catch (e) { found.push(`could not read ${rf}: ${String(e.message).slice(0, 80)}`); continue; }
    for (const b of md.blocks) for (const m of b.text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^([a-z]+:|#)/i.test(m[1])) continue;
      count++;
      const p = posix.normalize(posix.join(posix.dirname(rf), m[1].split("#")[0])).replace(/\/$/, "");
      if (!set.has(p) && !dirs.has(p + "/")) found.push(`${rf}:${b.i + 1} ${m[1]}`);
    }
  }
  return { ms: Date.now() - t, count, found };
}
function lychee(root, files, extra = []) {
  if (!LYCHEE) return { ms: 0, found: ["NOT FETCHED"] };
  const list = path.join(tmp, "inputs.txt");
  fs.writeFileSync(list, files.map(f => path.join(root, f)).join("\n") + "\n");
  const r = timed(LYCHEE, ["--offline", "--no-progress", "--format", "json", "--root-dir", root, "--files-from", list, ...extra], away);
  let found, total;
  try {
    const j = JSON.parse(r.stdout);
    total = j.total;
    found = Object.entries(j.error_map ?? {}).flatMap(([input, errs]) => errs.map(e => `${path.relative(root, input.replace(/^file:\/\//, ""))} ${decodeURI(String(e.url)).replace(`file://${root}/`, "")} => ${String(e.status?.text ?? JSON.stringify(e.status)).slice(0, 120)}`));
  } catch { found = [`ERROR status ${r.status}${r.error ? ` ${r.error.code}` : ""}: ${(r.stdout + r.stderr).trim().split("\n").slice(-4).join(" | ").slice(0, 600)}`]; }
  return { ms: r.ms, total, status: r.status, found };
}
function dump(root, files) {
  if (!LYCHEE) return [];
  const list = path.join(tmp, "inputs.txt");
  fs.writeFileSync(list, files.map(f => path.join(root, f)).join("\n") + "\n");
  const r = timed(LYCHEE, ["--offline", "--dump", "--root-dir", root, "--files-from", list], away);
  return r.stdout.split("\n").filter(Boolean).map(l => decodeURI(l).replaceAll(`file://${root}/`, "").replaceAll(`${root}/`, ""));
}
// (the old reading in a process of its own, so that a file it cannot read within its memory or a minute is recorded so)
if (process.argv[2] === "--old") { console.log(JSON.stringify(old(process.argv[3], process.argv.slice(4)))); process.exit(0); }
const oldApart = (root, files) => {
  const r = timed(process.execPath, ["--max-old-space-size=4096", new URL(import.meta.url).pathname, "--old", root, ...files], repo);
  try { return JSON.parse(r.stdout); } catch { return { ms: r.ms, count: "?", found: [`CRASHED status ${r.status} ${r.signal ?? ""}${r.error ? ` ${r.error.code}` : ""}: ${(r.stderr || "").trim().split("\n").filter(l => /FATAL|Error|heap/.test(l)).slice(0, 2).join(" | ").slice(0, 200)}`] }; }
};
const show = (name, root, files, { dumpIt = false, limit = 60 } = {}) => {
  console.log(`\n### ${name} (${files.length} files)`);
  const o = oldApart(root, files);
  console.log(`old (${o.ms} ms, ${o.count} links read): ${o.found.length} broken ${JSON.stringify(o.found.slice(0, limit))}`);
  const l = lychee(root, files);
  console.log(`lychee, files alone (${l.ms} ms, status ${l.status}, ${l.total} links): ${l.found.length} broken ${JSON.stringify(l.found.slice(0, limit))}`);
  const f = lychee(root, files, ["--include-fragments"]);
  console.log(`lychee, with anchors (${f.ms} ms, status ${f.status}, ${f.total} links): ${f.found.length} broken ${JSON.stringify(f.found.slice(0, limit))}`);
  if (dumpIt) console.log(`lychee's links: ${JSON.stringify(dump(root, files).slice(0, limit))}`);
};

if (process.argv[2] !== "--old") console.log(`lychee: ${LYCHEE ? execFileSync(LYCHEE, ["--version"], { encoding: "utf8" }).trim() : "not fetched"}`);
// the core's own: the rule files the check reads under --core, then every Markdown file git tracks
const all = tracked(repo), md = all.filter(f => /\.md$/i.test(f));
const rules = all.filter(f => /^(floor|floor\/topics|modules|roles|roles\/shared|tasks|tools)\/[^/]+\.md$/.test(f));
show("the core's own rule files", repo, rules);
show("every Markdown file of the core's", repo, md);
show("every Markdown file of the core's but the dated records (reports/, archive/, words/)", repo, md.filter(f => !/^(reports|archive|words)\//.test(f)), { limit: 200 });
const r0 = spawnSync(process.execPath, ["scripts/pointers.mjs", "--core"], { cwd: repo, encoding: "utf8" });
console.log(`the pointer check itself, --core: status ${r0.status}: ${(r0.stdout + r0.stderr).trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`);
// a project of each kind the starter kit writes
for (const [kit, args] of [["npm", ["--npm", "."]], [".NET", ["--nuget", "."]], ["npm, private", ["--npm", ".", "--private"]]]) {
  const dir = fs.mkdtempSync(path.join(tmp, "kit-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const r = spawnSync(process.execPath, [path.join(repo, "scripts/init.mjs"), "--owner", "someone", "--at", execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), ...args], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) { console.log(`\n### the starter kit, ${kit}: init failed: ${(r.stdout + r.stderr).slice(-400)}`); continue; }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const own = tracked(dir).filter(f => /\.md$/i.test(f) && !f.startsWith("core/"));
  show(`the starter kit's project, ${kit}: its own Markdown files`, dir, own, { dumpIt: true });
  const p = spawnSync(process.execPath, ["core/scripts/pointers.mjs"], { cwd: dir, encoding: "utf8" });
  console.log(`the pointer check itself: status ${p.status}: ${(p.stdout + p.stderr).trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`);
}
// the three pointers a review found in the two games (#582's note), at the commits that held them
for (const [name, url, sha, files] of [
  ["barkstreet-snakes#619, the section renamed", "https://github.com/HaakTuah/barkstreet-snakes", "e55e565bc319f4cecb33322d8b8c2cdb92971652", ["docs/PROGRESS.md", "docs/design/29-round-six-b-the-new-moves.md", "docs/design/40-powers-and-moves.md"]],
  ["barkstreet-snakes#635, the script that is not there", "https://github.com/HaakTuah/barkstreet-snakes", "028f0bf7703e2117e2e4d0624b6d2849192ab2e8", ["docs/codex-test.md"]],
  ["amarna-letters#721, the point that was gone", "https://github.com/HaakTuah/amarna-letters", "80e31e025c496593fb6c017314128421fc0c930e", ["docs/review-guidelines.md"]],
]) {
  const dir = fs.mkdtempSync(path.join(tmp, "game-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["fetch", "-q", "--depth", "1", url, sha], { cwd: dir, stdio: "ignore", timeout: 240000 });
    execFileSync("git", ["checkout", "-q", "FETCH_HEAD"], { cwd: dir, stdio: "ignore" });
    show(name, dir, files.filter(f => fs.existsSync(path.join(dir, f))), { dumpIt: true });
    const everyMd = tracked(dir).filter(f => /\.md$/i.test(f) && !f.startsWith("core/"));
    show(`${name}: every Markdown file of the game's own`, dir, everyMd, { limit: 40 });
  } catch (e) { console.log(`\n### ${name}: could not be fetched: ${String(e.message).slice(0, 200)}`); }
}
// the cases
for (const [name, files] of Object.entries(CASES)) {
  const dir = fs.mkdtempSync(path.join(tmp, "case-"));
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  if (name === "a file not tracked by git") fs.writeFileSync(path.join(dir, "untracked.md"), "# U\n");
  show(name, dir, Object.keys(files).filter(f => f.endsWith(".md") && !(f === "b.md" || f === "sub/c.md" || f === "my file.md" || f === "a_(b).md")), { dumpIt: true, limit: 8 });
}
