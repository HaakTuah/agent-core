// Checks scripts/guards.mjs: a path a project's file names is read only inside the project, a file reached
// through a link that leads out of it is told, a name printed to a workflow's log stays on its line, a value nested
// past the bound is told without recursion, a message names the project's place as ".", a repository and a commit
// are named only as GitHub writes them, and a line hidden from a Markdown text's reader is not read. Run by the
// core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/guards-test.mjs
import fs from "node:fs";
import path from "node:path";
import { DEEPEST, aCommit, aRepository, inProject, leadsOut, logged, loggedAlone, noSignIn, noSignInWhole, oneLine, quotedAlone, seen, tooDeep, unrooted } from "../scripts/guards.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 600)}`}`); } };

ok(["a.json", "./a.json", "a/b/c.json", "a/../b.json", "a\\b.json", ".github/x.json"].every(inProject), "a path from the project's root, however written, stays inside it");
ok(!["../a.json", "a/../../b.json", "..", "/etc/a.json", "\\a.json", "C:/a.json", "c:a.json", "..\\a.json", "", "a\0b", "a\nb.json", "a\rb", "a\u007fb", null, 5, ["a"]].some(inProject), "a rooted path, one with a \"..\" that leads above the root, one with a control character, and one that is no path stay out");

const tmp = fs.realpathSync(scratchDir("guards-test-"));
try {
  const project = path.join(tmp, "project"), elsewhere = path.join(tmp, "elsewhere");
  fs.mkdirSync(path.join(project, "inner"), { recursive: true });
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(project, "inner", "own.json"), "{}");
  fs.writeFileSync(path.join(elsewhere, "other.json"), "{}");
  // (a link to a file needs a right on Windows that a junction to a folder does not: where it cannot be made, the
  // folder's alone is tried)
  let fileLink = true;
  try { fs.symlinkSync(path.join(elsewhere, "other.json"), path.join(project, "out.json")); } catch { fileLink = false; }
  fs.symlinkSync(path.join(project, "inner"), path.join(project, "in"), "junction");
  fs.symlinkSync(elsewhere, path.join(project, "away"), "junction");
  ok(!leadsOut(project, path.join(project, "inner", "own.json")) && !leadsOut(project, path.join(project, "in", "own.json")), "a file of the project's, or one reached through a link inside it, does not lead out");
  ok((!fileLink || leadsOut(project, path.join(project, "out.json"))) && leadsOut(project, path.join(project, "away", "other.json")), "a file reached through a link out of the project, at the file or a folder on its way, leads out");
  ok(!leadsOut(project, path.join(project, "none.json")) && !leadsOut(project, path.join(project, "inner", "new", "x.json")), "a path that does not stand yet, under a folder of the project's, does not lead out");
  ok(leadsOut(project, path.join(project, "away", "new.json")) && leadsOut(project, path.join(project, "away", "deeper", "new.json")), "a path that does not stand yet, under a folder linked out of the project, leads out");
  if (fileLink) {
    fs.symlinkSync(path.join(elsewhere, "gone.json"), path.join(project, "dangling.json"));
    ok(leadsOut(project, path.join(project, "dangling.json")), "a link that leads nowhere leads out");
  }
  ok(unrooted(`ENOENT: open '${path.join(project, "core-manifest.md")}'`, project) === `ENOENT: open '.${path.sep}core-manifest.md'`, "a message names the project's place as \".\"", unrooted(path.join(project, "core-manifest.md"), project));
  ok(!unrooted(`at '${project.replace(/\\/gu, "/")}' and ${project}`, project).includes(tmp), "in each spelling of the place", unrooted(`at '${project.replace(/\\/gu, "/")}' and ${project}`, project));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

const name = "a%b\r\n::name::value\u2028c\u0007d";
ok(!/[\r\n\u2028\u0007]/u.test(logged(name)) && logged(name).startsWith("a%25b%0D%0A::") && logged("plain/name.js") === "plain/name.js", "a name printed to the log stays on its one line, escaped as GitHub documents", logged(name));

ok(oneLine("100%Coverage/App.csproj") === "100%Coverage/App.csproj" && oneLine("a\nb\u2028c") === "a?b?c", "a name with no control character is shown as it stands, \"%\" and all; one with them, on one line");

let deep = 1;
for (let i = 0; i < 20000; i++) deep = [deep];
const wide = { a: Array.from({ length: 150000 }, (_, k) => `x${k}`) };
ok(tooDeep(deep) && !tooDeep(wide) && !tooDeep({ a: { b: [1, { c: "d" }] } }) && !tooDeep("text") && !tooDeep(null), "nesting past the bound is told, without recursion; a wide or shallow value is not");
let at = 1;
for (let i = 0; i < DEEPEST; i++) at = [at];
ok(!tooDeep(at) && tooDeep([at]), `nesting is bounded at ${DEEPEST} objects and lists`);

ok(["owner/name", "own-er/na.me_1"].every(aRepository) && !["../..", "o/..", "./n", "o/n/x", "o", "o/n x", "", undefined].some(aRepository), "a repository is named as <owner>/<name>, neither part dots alone");
ok(aCommit("0123456789abcdef0123456789abcdef01234567") && !["0123456", "0123456789ABCDEF0123456789ABCDEF01234567", "../../x", undefined].some(aCommit), "a commit is named by forty hexadecimal digits alone");

const text = "Shown first\n<!-- hidden one -->\n```\nhidden in a fence\n```\n~~~~\nhidden too\n~~~\nstill hidden\n~~~~\nshown <!-- hidden\nhidden -->shown again\n<!-- never closed\nhidden";
const read = seen(text).split("\n");
ok(read.length === text.split("\n").length && read.filter(l => l.trim()).join("|") === "Shown first|shown |shown again", "a Markdown text is read as its reader sees it: no line of an HTML comment or a fenced block, the lines kept where they stood", JSON.stringify(read));
ok(seen("``` not a fence `\nshown").includes("shown") && seen("```\nhidden").trim() === "", "a fence never closed hides to the end; a line of backticks with one after it opens none");

// (an address with a sign-in in it, the sign-in made up and built from pieces as the test runs: the user and the
// password cut out wherever the address stands, as the last "@" before its path ends them; nothing else touched)
{
  const user = ["made", "up"].join("-"), pass = ["not", "a", "pass"].join("_");
  const cut = noSignIn(`a spec "git+https://${user}:${pass}@example.invalid/x.git" and https://${user}@a@example.invalid/y`);
  ok(cut === 'a spec "git+https://example.invalid/x.git" and https://example.invalid/y', "the user and password of every address in a text are cut out", cut.replaceAll(user, "<user>").replaceAll(pass, "<pass>"));
  ok(!logged(`https://${user}:${pass}@example.invalid/`).includes(pass) && !logged(`https://${user}:${pass}@example.invalid/`).includes(user), "a text printed to the log holds no address's sign-in");
  ok([`https:/${user}:${pass}@example.invalid/x`, `https:///${user}:${pass}@example.invalid/x`, `https:\\\\${user}:${pass}@example.invalid/x`, `HTTPS://${user}@example.invalid/x`, `https:${user}:${pass}@example.invalid/x`, `ftp:\\${user}@example.invalid/x`, `x://${user}:${pass}@example.invalid/x`,
    `git+https://git@${user}:${pass}@example.invalid/x`, `https://${user}:${pass}@sha256:443/example.invalid/x`, `https://${user}:${pass}"tail@example.invalid/x`, `git+https://${user}:${pass}\\tail@example.invalid/x`, `x://${user}:${pass}\\"tail@example.invalid/x`].every(t => !noSignIn(t).includes(user) && noSignIn(t).endsWith("example.invalid/x")),
    "an address with one slash or more after its scheme, either way, in any case, has its sign-in cut out too, none after a special scheme but file, a quote in it");
  ok(noSignIn(`https:\\\\${user}:${pass}"x@example.invalid/x`) === "https:\\\\example.invalid/x", "a backslash before a quote is a sign-in's, not a scheme's", noSignIn(`https:\\\\${user}:${pass}"x@example.invalid/x`).replaceAll(user, "<user>"));
  const quoted = noSignIn(JSON.stringify({ spec: `https://${user}:${pass}"tail@example.invalid/x` }));
  ok(quoted === '{"spec":"https://example.invalid/x"}', "a sign-in holding a quote is cut out, as JSON writes it too", quoted.replaceAll(user, "<user>").replaceAll(pass, "<pass>"));
  const spaced = [" tail", "\ttail", "\ntail", "\"tail"].map(t => `https://${user}:${pass}${t}@example.invalid/x`);
  ok(spaced.every(t => noSignInWhole(t) === "https://example.invalid/x"), "a value printed on its own has a sign-in cut out whole, a space, a tab or a line's break in it", JSON.stringify(spaced.map(noSignInWhole)).replaceAll(user, "<user>"));
  const mend = "package.json: the spec of \"x\" names https://example.invalid, not a version. Mend: write it as x@1.2.3, then run the check again";
  ok(noSignIn(mend) === mend && logged(mend) === mend, "a line of text keeps the words after an address, its mend among them, where a later \"@\" stands", logged(mend));
  const tabbed = quotedAlone({ [`https://${user}:${pass}\tkey@example.invalid/k`]: [`git+https://${user}:${pass}\nlist@example.invalid/x`], plain: 1 });
  ok(tabbed === '{"https://example.invalid/k":["git+https://example.invalid/x"],"plain":1}', "a value written as JSON has each text and key cut before an escape could hide its sign-in", tabbed.replaceAll(user, "<user>"));
  ok(quotedAlone(undefined) === undefined && quotedAlone("x@1") === '"x@1"', "a value JSON writes nothing of stays nothing; a text is quoted as JSON quotes it");
  let long;
  try { long = [noSignIn(`https://${"a".repeat(12e6)}`), noSignInWhole("ws:".repeat(4e6)), noSignInWhole(`https:${"/".repeat(12e6)}`), noSignInWhole(`x:${"/\t".repeat(6e6)}`), noSignInWhole(`h${"t\t".repeat(6e6)}ps:`), noSignInWhole(`x://${"@".repeat(12e6)}`), noSignInWhole(`https://${"\\\"".repeat(4e6)}@`), noSignInWhole(`x://${"a ".repeat(6e6)}`)]; } catch (e) { long = e; }
  ok(Array.isArray(long), "a long text is read without running out of stack", String(long).slice(0, 200));
  const longPass = "x".repeat(5000);
  ok(noSignIn(`https://${user}:${longPass}@example.invalid/x`) === "https://example.invalid/x", "a sign-in of any length is cut whole");
  ok([`https:\n//${user}:${pass}@example.invalid/x`, `https:/\t/${user}:${pass}@example.invalid/x`, `x:/\r/${user}:${pass}@example.invalid/x`].every(t => !noSignInWhole(t).includes(pass) && !noSignIn(t).includes(pass)),
    "a tab or a line's break among an address's slashes, which the URL standard drops, ends no address");
  ok([`ht\ttps:${user}:${pass}@example.invalid/x`, `git+ht\ntps://${user}:${pass}@example.invalid/x`, `\thttps://${user}:${pass}@example.invalid/x`].every(t => !noSignInWhole(t).includes(pass)),
    "a tab or a line's break in a scheme's name, which the URL standard drops, hides no address");
  ok([`x\nhttps:${user}:${pass}@example.invalid/x`, `x\thttps:${user}:${pass}@example.invalid/x`, `key\thttp:/${user}:${pass}@example.invalid/x`, `foo\nhttps:\\${user}:${pass}@example.invalid/x`, `foo\rwss:${user}:${pass}@example.invalid`, `x\n\nhttp:${user}:${pass}@example.invalid`].every(t => !noSignInWhole(t).includes(pass) && !noSignIn(t).includes(pass) && !loggedAlone(t).includes(pass)),
    "a special scheme after a word and a tab or a line's break is read as the scheme, with or without slashes");
  ok([`x\nhttp\ts:${user}:${pass}@example.invalid/x`, `x\tht\ntps:${user}:${pass}@example.invalid`, `a b\nh\tttp:/${user}:${pass}@example.invalid`, `foo\nw\tss:${user}:${pass}@example.invalid`, `key\nH\rT\ttP\rs:${user}:${pass}@example.invalid`, `x\nf\tile:/${user}:${pass}@example.invalid`, `see 1.\nssh://${user}:${pass}@example.invalid/x`, `+\nssh://${user}:${pass}@example.invalid`, `x\n+https:${user}:${pass}@example.invalid`, `ab\n1https:${user}:${pass}@example.invalid`, `x\n.ftp:${user}:${pass}@example.invalid`, `git\n+https:${user}:${pass}@example.invalid`, `x\t\n+fTP:git:${pass}@example.invalid`].every(t => !noSignInWhole(t).includes(pass) && !noSignIn(t).includes(pass) && !loggedAlone(t).includes(pass)),
    "a scheme read from after a tab or a line's break, with more breaks in it, or after a sign that is no letter, is read");
  ok(noSignIn("file:../@scope/x 1.\nssh:x") === "file:../@scope/x 1.\nssh:x" && noSignIn("mytext\nwhttp:x@y") === "mytext\nwhttp:x@y", "a scheme a break splits from no address is still no address");
  ok(!noSignInWhole(`git+\nhttps://${user}:${pass}\\tail@example.invalid/a.git`).includes(pass) && !noSignIn(`git+\nhttps://${user}:${pass}\\tail@example.invalid/a.git`).includes(pass),
    "a scheme a break splits is read whole too, where it starts with a letter, and the reading that cuts more is taken");
  const marked = loggedAlone(`https://${user}:${pass}. Mend: tail@example.invalid/x`);
  ok(!marked.includes(pass) && !marked.includes("tail") && marked.includes(". Mend: an address in this message held a sign-in"), "a sign-in that holds a mend's marker is cut whole, and a mend of its own says so", marked.replaceAll(pass, "<pass>"));
  ok(noSignIn(`https://${user}:${pass}@sha256:${"0".repeat(32)}/x`) === `https://sha256:${"0".repeat(32)}/x`, "a host named as a digest, with a port and a path after it, is no digest");
  ok(!loggedAlone(`could not read https://${user}:${pass} x@example.invalid/x`).includes(pass), "a value printed on its own to the log has its sign-in cut whole");
  const refused = "checks/https:shape.json cannot be read. Mend: write it as \"src/\" names it, or mail me@example.invalid";
  ok(loggedAlone(refused) === refused, "a message printed on its own keeps the mend it holds", loggedAlone(refused));
  ok([`https://${user}:${pass}@sha256:${"0".repeat(29)}443`, `-https://${user}:${pass}@example.invalid/x`, `1https://${user}:${pass}@example.invalid/x`, `.wss:${user}:${pass}@example.invalid/x`].every(t => !noSignIn(t).includes(pass)),
    "a host named as a digest whose port is digits alone, and a special scheme after a digit, \"-\" or \".\", are cut");
  const plain = ["https://registry.npmjs.org/@scope/x/-/x-1.0.0.tgz", "git+ssh://example.invalid/x.git#abc", "x@1.2.3", "mail me@example.invalid",
    "ssh://git@example.invalid/x.git", `docker://alpine@sha256:${"0123abcd".repeat(8)}`, "npm:@scope/x@1.0.0", "C:\\\\@types", "file:../@scope/x", "file:me@x/y", "C:\\me@x\\file.txt", "C:/me@x/file.txt", 'ab:\\"u@h'];
  ok(plain.every(t => noSignIn(t) === t), "an address with no sign-in, the user git, an image's digest, a name with a version, npm's alias, a bare address of mail, a file's path, a drive's path and a backslash before a quote, which ends no scheme, are left as they are", JSON.stringify(plain.map(noSignIn)));
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
