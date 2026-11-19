// Tests of the proof that a pull request is queue-only (scripts/queue-only.mjs; floor rule 8; #750, point 2): one that
// adds a line for an open, queued issue of the owner's that carries the owner's word, or needs none, and removes a line
// whose issue is closed, is proved; one that changes another file, a line that names no issue, an issue another
// account opened, one not queued, one queued on the stand-in's word, one with no word that can be read, one still open
// whose line goes, or one that cannot be read, is not, each saying why. Node's own modules.
//
//   node tests/queue-only-test.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carries, changed, judge } from "../scripts/queue-only.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HEAD = "a".repeat(40), OWNER = "The-Owner";
const pull = { state: "open", changed_files: 1, head: { sha: HEAD } };
const file = (patch, more = {}) => [[{ filename: "QUEUE.md", status: "modified", patch, ...more }]];
const WORD = "**What it is**\nA design.\n\n**The owner's word**\nSaid to a chat session:\n\n> Make it so.\n";
const issues = {
  "#10": { state: "open", author: "the-owner", labels: ["enhancement", "queued", "by:chat"], body: WORD },
  "#11": { state: "open", author: OWNER, labels: ["bug", "queued", "by:builder"], body: "A bug." },
  "#12": { state: "open", author: OWNER, labels: ["queued", "by:look"], body: "The look's task." },
  "#13": { state: "open", author: OWNER, labels: ["queued", "by:owner"], body: "Typed by the owner." },
  "#20": { state: "closed", author: OWNER, labels: ["queued"], body: "" },
  "#30": { state: "open", author: "someone-else", labels: ["queued", "by:chat"], body: WORD },
  "#31": { state: "open", author: OWNER, labels: ["by:chat"], body: WORD },
  "#32": { state: "open", author: OWNER, labels: ["queued", "by:chat", "stand-in-yes"], body: WORD },
  "#33": { state: "open", author: OWNER, labels: ["queued", "by:builder"], body: WORD },
  "#34": { state: "open", author: OWNER, labels: ["queued", "by:chat"], body: "**The owner's word**\nThe owner said yes, roughly.\n" },
  "#35": { state: "open", author: OWNER, labels: ["queued", "by:chat"], body: WORD, pull: true },
};
const read = (item) => issues[item] ?? null;
const of = (patch, files = file(patch), p = pull) => judge(p, files, { progress: "QUEUE.md", owner: OWNER, read });
const row = (n, who = "builder", waits = "") => `| #${n} | ${who} | ${waits} |`;

ok(of(`@@ -1,2 +1,2 @@\n ${row(5)}\n-${row(20)}\n+${row(10)}`).head === HEAD, "a line added for an issue of the owner's word, and one removed whose issue is closed: proved");
ok([11, 12, 13].every((n) => of(`@@ -1 +1,2 @@\n ${row(5)}\n+${row(n)}`).head === HEAD), "  so is a line for a bug, a task of the look, or an issue the owner typed");
ok(of(`@@ -1 +1 @@\n-${row(10)}\n+${row(10, "rule builder", "#11")}`).head === HEAD && of(`@@ -1,2 +1,2 @@\n-${row(13)}\n ${row(5)}\n+${row(13)}`).head === HEAD,
  "  and a line edited or moved in place, its issue still as asked");
const not = (verdict, why) => verdict.head === null && verdict.why.includes(why);
ok(not(of(`@@ -1 +1 @@\n-${row(10)}`), "is not a closed issue"), "a line removed whose issue is still open is not");
ok(not(of(`@@ -1 +1,2 @@\n+${row(30)}`), "not opened by the owner's account") && not(of(`@@ -1 +1,2 @@\n+${row(31)}`), "not labelled queued")
  && not(of(`@@ -1 +1,2 @@\n+${row(32)}`), "labelled stand-in-yes") && not(of(`@@ -1 +1,2 @@\n+${row(33)}`), "no owner's word")
  && not(of(`@@ -1 +1,2 @@\n+${row(34)}`), "no owner's word") && not(of(`@@ -1 +1,2 @@\n+${row(35)}`), "not an open issue") && not(of(`@@ -1 +1,2 @@\n+${row(99)}`), "could not be read"),
  "nor one adding a line for an issue another account opened, one not queued, one on the stand-in's word, one with no word read, a pull request, or one that cannot be read");
ok(not(of("@@ -1 +1,2 @@\n+Some prose about the queue."), "names no issue") && not(of("@@ -1 +1,2 @@\n+| inbox/idea.md | builder | |"), "names no issue"),
  "nor a line that names no issue, or an inbox file");
ok(not(of(`@@ -1 +1,2 @@\n+${row(10)}`, [[...file("")[0], { filename: "README.md", status: "modified", patch: "@@" }]], { ...pull, changed_files: 2 }), "more than one file")
  && not(of(`@@ -1 +1,2 @@\n+${row(10)}`, file(`@@ -1 +1,2 @@\n+${row(10)}`, { filename: "AGENTS.md" })), "is not QUEUE.md")
  && not(of(`@@ -1 +1,2 @@\n+${row(10)}`, file(`@@ -1 +1,2 @@\n+${row(10)}`, { status: "renamed", previous_filename: "Q.md" })), "changed in place")
  && not(of("", file(undefined)), "no patch") && not(of(`@@ -1 +1,2 @@\n+${row(10)}`, undefined, { ...pull, state: "closed" }), "no open pull request"),
  "nor one that changes another file, another file alone, the file moved, a patch GitHub leaves out, or a closed pull request");
ok(not(of(`@@ -1 +1,13 @@\n${Array.from({ length: 13 }, (_, i) => `+${row(100 + i)}`).join("\n")}`), "more than 12 issues"), "nor one that names more than a dozen issues");
ok(carries(WORD) && carries("## What it is\nA design.\n\nThe owner agreed to it.") && !carries("## What it is\nA design.") && !carries("The owner's word: yes") && !carries("> Make it so."),
  "the owner's word is a quote under its heading, or a design the text says the owner agreed to, and nothing else");
ok(changed("@@ -1 +1 @@\n-a\n+b\n c")?.added.join() === "b" && changed("") === null && changed("diff --git") === null, "a patch's lines are read from GitHub's form alone");

const usage = spawnSync(process.execPath, [path.join(root, "scripts", "queue-only.mjs")], { encoding: "utf8" });
ok(usage.status === 2 && usage.stderr.includes("usage:"), "with no files named, it says how it is run");

console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
