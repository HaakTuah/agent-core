// Checks scripts/guards.mjs: a path a project's file names is read only inside the project, a file reached
// through a link that leads out of it is told, a name printed to a workflow's log stays on its line, a value nested
// past the bound is told without recursion, a message names the project's place as ".", a repository and a commit
// are named only as GitHub writes them, and a line hidden from a Markdown text's reader is not read. Run by the
// core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/guards-test.mjs
import fs from "node:fs";
import path from "node:path";
import { DEEPEST, aCommit, aLogin, aRepository, inProject, asText, leadsOut, linkedOut, logged, loggedAlone, loggedCause, noSignIn, noSignInWhole, oneLine, quotedAlone, seen, tooDeep, unfolded, unrooted } from "../scripts/guards.mjs";
import { mended } from "../scripts/mend.mjs";
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
  fs.mkdirSync(path.join(elsewhere, "deep")); fs.writeFileSync(path.join(project, "up-to.json"), "here"); fs.writeFileSync(path.join(elsewhere, "up-to.json"), "away");
  fs.symlinkSync(path.join(elsewhere, "deep"), path.join(project, "far"), "junction");
  // (a link whose text, written as is, steps back by a `..` after a folder link out of the project: it leads out where
  // the system reads it from the folder the link reached, as Linux and macOS do, and stays inside where it reads it by
  // its spelling)
  let upLink = true;
  try { fs.symlinkSync(["far", "..", "up-to.json"].join(path.sep), path.join(project, "up.json")); } catch { upLink = false; }
  ok(!upLink || leadsOut(project, path.join(project, "up.json")) === (fs.readFileSync(path.join(project, "up.json"), "utf8") === "away"),
    "a link whose text steps back by a `..` after a folder link out of the project leads out exactly where the system reads it outside, though its spelling stays inside");
  // (the same `..` in the path given, written as is, never joined: a read of it leads where the link's would)
  const given = ["far", "..", "up-to.json"].join(path.sep), was = process.cwd(), readOut = fs.readFileSync(`${project}${path.sep}${given}`, "utf8") === "away";
  try {
    process.chdir(project);
    ok([`${project}${path.sep}${given}`, given].every(at => leadsOut(project, at) === readOut) && leadsOut(".", ["far", "..", "new.json"].join(path.sep)) === readOut,
      "a path given with a `..` after a folder link out of the project leads out exactly where a read of it leads outside, also where it does not stand yet, though its spelling stays inside");
    ok([["nowhere", "..", "..", "elsewhere", "new.json"], ["inner", "nowhere", "..", "..", "..", "elsewhere"], ["nowhere", ".", "new.json"]].every(parts => leadsOut(project, parts.join(path.sep))),
      "a path whose `..` or `.` stands after a part that does not stand leads out, since a write that makes its folders could follow it out of the project");
    if (process.platform === "win32") {
      const drive = project.slice(0, 2), other = drive.toUpperCase() === "C:" ? "D:" : "C:";
      ok(unfolded(`${drive}inner\\own.json`) === path.join(project, "inner", "own.json") && !leadsOut(project, `${drive}inner\\own.json`) && leadsOut(project, `${drive}away\\other.json`) && leadsOut(project, `${other}own.json`),
        "a drive's path with no folder after the drive is read from that drive's own folder, where it stays inside or leads out through a link, and on another drive leads out");
    }
  } finally { process.chdir(was); }
  if (fileLink) {
    fs.symlinkSync(path.join(elsewhere, "gone.json"), path.join(project, "dangling.json"));
    ok(leadsOut(project, path.join(project, "dangling.json")) && leadsOut(project, `${path.join(project, "dangling.json")}${path.sep}`), "a link that leads nowhere leads out, also named with a separator at its end");
    fs.symlinkSync(path.join(elsewhere, "other.json"), path.join(project, "..x.json"));
    const was = process.cwd();
    try {
      process.chdir(project);
      ok(linkedOut("out.json") && linkedOut("..x.json") && linkedOut(path.join(project, "..x.json")), "a path named inside the folder run from, a name that opens with two dots included, leads out through a link");
      ok(!linkedOut("inner/own.json") && !linkedOut(path.join(elsewhere, "other.json")) && !linkedOut("../elsewhere/other.json"), "one that stays inside, or one named outside the folder, does not");
    } finally { process.chdir(was); }
  }
  ok(unrooted(`ENOENT: open '${path.join(project, "core-manifest.md")}'`, project) === `ENOENT: open '.${path.sep}core-manifest.md'`, "a message names the project's place as \".\"", unrooted(path.join(project, "core-manifest.md"), project));
  ok(!unrooted(`at '${project.replace(/\\/gu, "/")}' and ${project}`, project).includes(tmp), "in each spelling of the place", unrooted(`at '${project.replace(/\\/gu, "/")}' and ${project}`, project));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

const name = "a%b\r\n::name::value\u2028c\u0007d";
ok(!/[\r\n\u2028\u0007]/u.test(logged(name)) && logged(name).startsWith("a%25b%0D%0A: :name: :value") && logged("plain/name.js") === "plain/name.js", "a name printed to the log stays on its one line, escaped as GitHub documents, each \"::\" broken", logged(name));
// (a pull request chooses its files' names: none is read by the runner as a workflow command, "::" at a line's start or
// "##[" anywhere, also where only letters beyond ASCII stand between the marks; #1348)
{
  const hostile = "::a##[group]b:\u00e9:c#\u00e9#[d#\u00f8#\u00e5[e:::\u0001###[f";
  const shownAs = asText(hostile), commands = /:[^\u0000-\u007f]*:|#[^\u0000-\u007f]*#[^\u0000-\u007f]*\[/u;
  ok(shownAs === ": :a# #[group]b: \u00e9:c# \u00e9#[d# \u00f8#\u00e5[e: : :?## #[f" && !commands.test(shownAs) && !commands.test(logged(hostile)),
    "a name holding \"::\", \"##[\", a letter beyond ASCII between their marks or a control character is shown with none of them read as a command", shownAs);
  ok(asText(shownAs) === shownAs && ["src/App.csproj", "12:30:45", "a:b#c[d", "a#b#[c", "\u00e6:\u00f8"].every(t => asText(t) === t),
    "and shown again it changes nothing, nor does it change a name with no such pair");
}

ok(oneLine("100%Coverage/App.csproj") === "100%Coverage/App.csproj" && oneLine("a\nb\u2028c") === "a?b?c", "a name with no control character is shown as it stands, \"%\" and all; one with them, on one line");

let deep = 1;
for (let i = 0; i < 20000; i++) deep = [deep];
const wide = { a: Array.from({ length: 150000 }, (_, k) => `x${k}`) };
ok(tooDeep(deep) && !tooDeep(wide) && !tooDeep({ a: { b: [1, { c: "d" }] } }) && !tooDeep("text") && !tooDeep(null), "nesting past the bound is told, without recursion; a wide or shallow value is not");
let at = 1;
for (let i = 0; i < DEEPEST; i++) at = [at];
ok(!tooDeep(at) && tooDeep([at]), `nesting is bounded at ${DEEPEST} objects and lists`);

ok(["owner/name", "own-er/na.me_1"].every(aRepository) && !["../..", "o/..", "./n", "o/n/x", "o", "o/n x", "", undefined].some(aRepository), "a repository is named as <owner>/<name>, neither part dots alone");
ok(["example-writer", "A1", "a".repeat(39)].every(aLogin) && !["-example", "a".repeat(40), "example/../writer", "example writer", "example-app[bot]", "", undefined].some(aLogin), "a login is a letter or digit, then up to 38 letters, digits or hyphens, and nothing else");
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
  ok([`+\ngit+\nhttps://${user}:${pass}\\t@example.invalid/x`, `.\ngit\n+https://${user}:${pass}\\t@example.invalid/x`, `1\nab\nhttps://${user}:${pass}\\t@example.invalid/x`, `h\nttps://${user}:${pass}\\t@example.invalid/x`, `ht\ttps://${user}:${pass}\\t@example.invalid/x`, `w\ns://${pass}\\@example.invalid/x`, `say h\nttps://${user}:${pass}\\t@example.invalid/x`].every(t => !noSignInWhole(t).includes(pass) && !noSignIn(t).includes(pass) && !loggedAlone(t).includes(pass)),
    "a scheme that is no special one, read from any break that a letter follows, is read beside a special one");
  const marked = loggedAlone(`https://${user}:${pass}. Mend: tail@example.invalid/x`);
  ok(!marked.includes(pass) && !marked.includes("tail") && marked.startsWith("https://[cut]example.invalid/x. Mend: take any user or password out of"), "a sign-in that holds a mend's marker is cut whole, \"[cut]\" where it was, and a mend of its own opens with what to do", marked.replaceAll(pass, "<pass>"));
  // (the URL standard reads a sign-in from an address to a later "@" where the words between are a message's own mend:
  // it is cut all the same, and the mend that stands in for it says what to do, then what was cut)
  const lost = ["could not fetch https://registry.npmjs.org. Mend: install @scope/x and run again", "checks/https:shape.json cannot be read. Mend: mail me@example.invalid", `https://${user}:${pass}. Mend: tail@example.invalid/x`];
  const read = lost.map(t => loggedAlone(t));
  ok(read[0].startsWith("could not fetch https://[cut]scope/x and run again. Mend: take any user or password out of each address cut at \"[cut]\"") && read[1].startsWith("checks/https:[cut]example.invalid. Mend: take "),
    "a message whose mend the URL standard reads into a sign-in shows where it was cut, and its mend opens with what to do", JSON.stringify(read[0]));
  ok(read.every((r, i) => r.split(". Mend: ").length === 2 && r.split(". Mend: ")[0].replaceAll("[cut]", "") === noSignInWhole(lost[i]) && /were cut where "\[cut\]" stands, the message's own mend with them$/u.test(r) && mended(`FAIL: ${r}`)),
    "it cuts as much as a value cut whole, holds one mend, and says what was cut, a failure that says its mend", JSON.stringify(read.map(r => r.replaceAll(pass, "<pass>"))));
  const wrapped = lost.map(t => `x.json cannot be read (${loggedCause(t)}). Mend: correct it to JSON`);
  ok(wrapped.every(w => w.split("Mend: ").length === 2 && mended(`FAIL: ${w}`) && !w.includes(pass) && w.includes("[cut]") && w.includes(`; the words from an address to a later "@" may hold a sign-in`)),
    "a message inside a failure's line, as its cause, is cut as one printed alone and says so in words, the line's one mend the caller's", JSON.stringify(wrapped.map(w => w.replaceAll(pass, "<pass>"))));
  const cause = "Unexpected token in \"a. Mend: b\"";
  ok(loggedCause(cause) === "Unexpected token in \"a. mend: b\"" && loggedCause("plain") === "plain" && loggedCause(`https://${user}:${pass}@example.invalid/x`) === "https://example.invalid/x",
    "a cause keeps no \"Mend: \" marker of its own and adds nothing where the cut took no mend", loggedCause(cause));
  ok(noSignIn(`https://${user}:${pass}@sha256:${"0".repeat(32)}/x`) === `https://sha256:${"0".repeat(32)}/x`, "a host named as a digest, with a port and a path after it, is no digest");
  ok(!loggedAlone(`could not read https://${user}:${pass} x@example.invalid/x`).includes(pass), "a value printed on its own to the log has its sign-in cut whole");
  const refused = "checks/https:shape.json cannot be read. Mend: write it as \"src/\" names it, or mail me@example.invalid";
  ok(loggedAlone(refused) === refused, "a message printed on its own keeps the mend it holds", loggedAlone(refused));
  ok([`https://${user}:${pass}@sha256:${"0".repeat(29)}443`, `-https://${user}:${pass}@example.invalid/x`, `1https://${user}:${pass}@example.invalid/x`, `.wss:${user}:${pass}@example.invalid/x`].every(t => !noSignIn(t).includes(pass)),
    "a host named as a digest whose port is digits alone, and a special scheme after a digit, \"-\" or \".\", are cut");
  const lettered = [`x\n-ab-https:${user}:${pass}@example.invalid`, `x\nab-https:${user}:${pass}@example.invalid`, `-ab-https:${user}:${pass}@example.invalid`, `1ab-https:/${user}:${pass}@example.invalid`];
  ok(lettered.every(t => noSignIn(t) === t && noSignInWhole(t) === t), "a scheme with letters before its special ending, a sign before them or none, is no special one and holds no sign-in without \"//\"", JSON.stringify(lettered.map(noSignIn)).replaceAll(user, "<user>").replaceAll(pass, "<pass>"));
  ok([`-https:${user}:${pass}@example.invalid`, `x\n-https:${user}:${pass}@example.invalid`, `-ab-https://${user}:${pass}@example.invalid`, `x\n-ab-https://${user}:${pass}@example.invalid`, `-ahttps://${user}:${pass}@example.invalid`, `-ab-git://${user}:${pass}@example.invalid`].every(t => !noSignIn(t).includes(pass) && !noSignInWhole(t).includes(pass)),
    "a special scheme right after a sign is cut, and a scheme read from the letter after a sign, with \"//\", is cut as it is with no sign");
  const plain = ["https://registry.npmjs.org/@scope/x/-/x-1.0.0.tgz", "git+ssh://example.invalid/x.git#abc", "x@1.2.3", "mail me@example.invalid",
    "ssh://git@example.invalid/x.git", `docker://alpine@sha256:${"0123abcd".repeat(8)}`, "npm:@scope/x@1.0.0", "C:\\\\@types", "file:../@scope/x", "file:me@x/y", "C:\\me@x\\file.txt", "C:/me@x/file.txt", 'ab:\\"u@h'];
  ok(plain.every(t => noSignIn(t) === t), "an address with no sign-in, the user git, an image's digest, a name with a version, npm's alias, a bare address of mail, a file's path, a drive's path and a backslash before a quote, which ends no scheme, are left as they are", JSON.stringify(plain.map(noSignIn)));
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
