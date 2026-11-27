// Tests of the caps' own check (size.mjs): what it counts for each role, the caps a version of the file sets, whose comment answers for
// a raise, and what is said of a pull request that raises one. Node's own modules only.
//
//   node tests/size-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { ghStandIn, scratchDir } from "../scripts/scratch-core.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { onPath } from "../scripts/workflow-run.mjs";
import { sizeOf } from "../scripts/file-size.mjs";
import { AGENTS, CAPS, DUE_TITLE, QUEUE, answered, capsAt, capsOf, counted, due, judged, raised as raisedWith, rolesAt, whoseOf } from "../scripts/size.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const file = fileURLToPath(new URL("../scripts/size.mjs", import.meta.url)), root = path.dirname(path.dirname(file));
const own = fs.readFileSync(file, "utf8");
// a version of the file from before each role had its cap, and one with a cap a role
const at = kb => `// a comment\nexport const CAP = ${kb} * 1024;\nconst other = 1;\n`;
const caps = of => `// a comment\nexport const CAPS = {\n${Object.entries(of).map(([r, kb]) => `  ${/-/.test(r) ? `"${r}"` : r}: ${kb} * 1024,\n`).join("")}};\nconst other = 1;\n`;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the caps a version of the file sets
ok(eq(capsOf(own), { [AGENTS.file]: AGENTS.mark, ...CAPS }) && eq(capsOf(caps({ builder: 27, "stand-in": 19 })), { builder: 27 * 1024, "stand-in": 19 * 1024 }) && eq(capsOf(caps({ builder: 27 }).replace(/\n/g, "\r\n")), { builder: 27 * 1024 }),
  "the caps are read from the one block that sets them, here and in any version, whichever line endings it has");
const share = `${caps({ builder: 27 })}export const AGENTS = { file: "AGENTS.md", mark: 18 * 1024 };\n`;
ok(eq(capsOf(share), { [AGENTS.file]: 18 * 1024, builder: 27 * 1024 }) && capsOf(`${share}${share.split("\n").at(-2)}\n`) === null && eq(capsOf(share.replace("18 * 1024 }", "18*1024 }")), { builder: 27 * 1024 }),
  "AGENTS.md's share of every role's cap is read from its one line, spelled so; two such lines give no caps (#1202)");
const withShare = kb => `${two(27, 20)}export const AGENTS = { file: "AGENTS.md", mark: ${kb} * 1024 };\n`;
ok(eq(capsOf(at(52)), { builder: 52 * 1024 }) && eq(capsOf("const CAP = 44 * 1024;\n"), { builder: 44 * 1024 }), "a version from before each role had its cap gives its one cap as the builder's");
ok([at(0), at("052"), at("5e1"), at("-1"), "let CAP = 52 * 1024;\n", "export const CAP = 53248;\n", `${at(52)}${at(53)}`, `${at(52)}${caps({ builder: 52 })}`, `${caps({ builder: 52 })}${caps({ builder: 53 })}`, caps({ builder: 52, reviewer: 20 }).replace("  reviewer", "  builder"),
  caps({ builder: 52 }).replace("52 * 1024", "52*1024"), caps({ builder: 52 }).replace("  builder", "builder"), `/*\n${caps({ builder: 52 })}*/\n`.replace("export const CAPS", "// export const CAPS"), "export const CAPS = {\n};\n", "", null, 5].every(t => capsOf(t) === null),
  "a block or line spelled any other way, two of them, a role named twice, or no text at all gives no caps");

// whose comment answers
// (the repository's owner, "someone", whose answer counts with no right read: security-review.mjs, counted)
const comment = (body, author_association = "OWNER", login = "someone") => ({ body, author_association, user: { login, type: "User" } });
const owner = whoseOf("someone", []), raised = (base, head, comments, running = capsOf(head)) => raisedWith(base, head, comments, running, owner);
const right = (login, role_name, permission, push) => ({ role_name, permission, user: { login, type: "User", permissions: { push } } });
ok(answered([comment("Leanness check: a fresh session read all the rules and found too little room.")], owner) && answered([[comment("x")], [comment("**Leanness check:** no room", "COLLABORATOR")]], owner) && answered([comment("Leanness check: found", "MEMBER")], owner),
  "a comment that opens with the leanness check's answer, from the owner, answers, in a list or a list of pages, whatever association GitHub gives it");
ok(answered([comment("Leanness check: found", "MEMBER", "writer")], whoseOf("someone", [right("writer", "write", "write", true)])) && answered([comment("Leanness check: found", "COLLABORATOR", "Writer")], whoseOf("someone", [right("writer", "maintain", "write", true)]))
  && !answered([comment("Leanness check: found", "MEMBER", "reader")], whoseOf("someone", [right("reader", "read", "read", false)])) && !answered([comment("Leanness check: found", "COLLABORATOR", "reader")], owner)
  && !answered([comment("Leanness check: found")]) && !answered([comment("Leanness check: found", "MEMBER", "writer")], whoseOf("someone", [right("writer", "triage", "read", false)])),
  "a member's or collaborator's answers only where the host's rights let them write; one who may only read or triage, or whose right was not read, does not, nor does any, with no one counted");
ok(!answered([], owner) && !answered([comment("About the Leanness check: none yet")], owner) && !answered([comment(" Leanness check: x")], owner) && !answered([comment("leanness check: x")], owner) && !answered([comment("Leanness check")], owner),
  "one that only speaks of it, or opens any other way, does not");
ok(["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", null, 5].every(who => !answered([comment("Leanness check: x", who)], owner)), "nor does anyone else's, whatever it says");
ok(!answered(null, owner) && !answered({}, owner) && !answered("Leanness check: x", owner) && !answered([null, 1, "Leanness check: x", { author_association: "OWNER" }, { body: 5, author_association: "OWNER" }], owner), "nor a list in any other form, or an entry that is no comment");

// a pull request's raise
const yes = [comment("Leanness check: read whole; too little room.")];
const two = (b, r) => caps({ builder: b, reviewer: r });
ok(raised(two(27, 20), two(27, 20), []) === null && raised(two(27, 20), two(26, 19), []) === null, "a pull request that leaves each cap, or lowers one, needs no answer");
ok(raised(two(27, 20), two(27, 21), yes) === null && raised(two(27, 20), two(28, 21), yes) === null, "a raise with its answer passes");
ok(/the role reviewer rises from 20480 to 21504 bytes.*Leanness check:/.test(raised(two(27, 20), two(27, 21), [])) && /Leanness check:/.test(raised(two(27, 20), two(28, 20), [comment("Leanness check: x", "NONE")])), "a raise of one role's cap without one fails, naming the role and what is missing");
ok(/the role builder rises.*one step of a whole KB/.test(raised(two(27, 20), two(29, 20), yes)) && /one step of a whole KB/.test(raised(two(27, 20), two(27, 30), [])), "a raise of more than one step fails, with its answer or without");
ok(raised(at(27), two(27, 22), []) === null && raised(at(27), caps({ builder: 26, orchestrator: 41, "stand-in": 19 }), []) === null && raised(two(27, 20), caps({ builder: 27, reviewer: 20, design: 20 }), []) === null,
  "a role the base gives no cap is at its first cap: no raise against the one cap of before, whatever it is, and none up to the smallest cap a base with a cap a role holds");
ok(/the role design, new here, takes a first cap of 21504 bytes, above the smallest the base holds \(20480\).*Leanness check:.*Mend:/.test(raised(two(27, 20), caps({ builder: 27, reviewer: 20, design: 21 }), [])) && raised(two(27, 20), caps({ builder: 27, reviewer: 20, design: 28 }), yes) === null
  && /new here/.test(raised(caps({ builder: 27, orchestrator: 42, "stand-in": 19 }), caps({ builder: 27, orchestrator: 42, standin: 43 }), [])), "above that it needs its answer: a role's file given another name takes no room its old name had not");
ok(/the role builder rises from 27648 to 28672 bytes.*Leanness check:/.test(raised(at(27), two(28, 22), [])) && raised(at(27), two(28, 22), yes) === null && /more than one step/.test(raised(at(27), two(29, 22), yes)),
  "against the one cap of before, the builder's cap is held as that cap was");
const decoy = `/*\n${two(27, 20)}*/\nexport const CAPS = { builder: 60*1024 };\n`;
ok(/does not set the caps the script runs with/.test(raised(two(27, 20), decoy, yes, { builder: 60 * 1024 })) && raised(two(27, 20), two(27, 20), [], { builder: 27 * 1024, reviewer: 20 * 1024 }) === null, "a block that only looks like the caps', beside a real one spelled otherwise, fails: the text is not trusted");
ok(/cannot be told/.test(raised("no cap here", two(27, 20), yes)) && /cannot be told/.test(raised(null, two(27, 20), yes)) && /not the one block the check reads/.test(raised(two(27, 20), "const CAP = 99 * 1000;", yes)), "where either version's caps cannot be read, it fails and says which");

ok(raised(two(27, 20), withShare(18), []) === null && /AGENTS\.md's share of every role's start, new here, takes a first cap/.test(raised(two(27, 20), withShare(21), [])) && raised(withShare(18), withShare(18), []) === null,
  "AGENTS.md's first share passes at or under the smallest role's cap the base holds, and needs the answer above it (#1202)");
ok(/the cap of AGENTS\.md's share of every role's start rises from 18432 to 19456 bytes.*Leanness check:/.test(raised(withShare(18), withShare(19), [])) && raised(withShare(18), withShare(19), yes) === null && /more than one step/.test(raised(withShare(18), withShare(20), yes)),
  "a raise of it is held as a role's: one step, with the leanness check's answer");

// what it counts
const template = name => fs.readFileSync(fileURLToPath(new URL(`../setup/template/${name}`, import.meta.url)), "utf8");
const imported = [...`${template("AGENTS.md.tmpl")}\n${template("CLAUDE.md.tmpl")}`.matchAll(/^@core\/(\S+)$/gmu)].map(m => m[1]);
const named = /`core\/(tools\/other-builders\.md)`/u.exec(template("AGENTS.md.tmpl"))?.[1];
// (and here the core's own AGENTS.md, which its CLAUDE.md imports: a project's is its own file, counted by none; #1202)
const expected = [...imported, named, AGENTS.file].sort(), builder = counted("builder", root);
ok(named && eq([...builder].sort(), expected) && !builder.includes("floor/topics.md") && !builder.includes("tasks/reviews.md"),
  "for the builder it counts what the starter kit's templates have a builder read at its start (the floor's security.md, its role's file, the modules read then, each tool's own part), the core's own AGENTS.md, and no file read only when a task calls for it", `${builder} against ${expected}`);
ok(eq(rolesAt(root).sort(), Object.keys(CAPS).sort()) && rolesAt(root).every(r => counted(r, root).includes("floor/security.md") && counted(r, root).includes(`roles/${r}.md`)) && counted("nobody", root) === null,
  "every role the core has a file for has a cap, and its count holds the floor and its own file");
ok(counted("design", root).includes("roles/builder.md") && counted("orchestrator", root).includes("roles/orchestrator.md") && !counted("builder", root).includes("roles/orchestrator.md") && !counted("stand-in", root).includes("roles/shared/git.md"),
  "a role's count holds what its file names, a role's file named there with what that names, and nothing another role alone reads");

// what a pull request or the default branch makes of what stands past a cap (#750, point 6)
const past = [{ what: "builder", said: "what the role builder reads at its start", total: 110, cap: 100, kind: "role" }];
ok(eq(judged(past).fail, []) && /is 10 bytes over its cap$/.test(judged(past).task[0]), "with no base, what stands past a cap is a task");
ok(judged(past, { builder: 90 }).fail.length === 1 && /is 10 bytes over its cap\. Mend:/.test(judged(past, { builder: 90 }).fail[0]) && judged(past, {}).fail.length === 1, "against a base under the cap, or one without the role, it fails");
ok(judged(past, { builder: 105 }).fail.length === 1 && /5 of them this change's own/.test(judged(past, { builder: 105 }).fail[0]), "against a base past the cap already, a change that grows it fails, saying how much is its own");
ok(judged(past, { builder: 100 }).fail.length === 1 && !/this change's own/.test(judged(past, { builder: 100 }).fail[0]), "a base exactly at the cap was not past it");
ok(eq(judged(past, { builder: 110 }).fail, []) && eq(judged(past, { builder: 120 }).fail, []) && /as it stood before this change/.test(judged(past, { builder: 120 }).task[0]), "one that does not grow it is a task");
ok(judged(past, { builder: 110 }, { builder: 120 }).fail.length === 1 && /which this change lowers from 0\.1171875 KB to 0\.09765625 KB\. Mend: set it back to 0\.1171875 \* 1024, the base's cap/.test(judged(past, { builder: 110 }, { builder: 120 }).fail[0]) && eq(judged(past, { builder: 110 }, { builder: 100 }).fail, []) && eq(judged(past, { builder: 110 }, {}).fail, []), "a change that lowers a cap below what stands fails, where the base set a higher one (the design check of 9bfbe79)");
{ const lowered = [{ what: QUEUE.file, said: QUEUE.file, total: 6000, cap: 5 * 1024, kind: "queue" }], f = judged(lowered, { [QUEUE.file]: 6000 }, { [QUEUE.file]: 6 * 1024 }).fail[0];
  ok(mended(`FAIL: ${f}`) && /over its mark, which this change lowers from 6 KB to 5 KB\. Mend: set it back to 6 \* 1024, the base's mark/.test(f) && eq(Object.keys(capsAt("HEAD")).sort(), [...Object.keys(CAPS), QUEUE.file].sort()) && Object.values(capsAt("HEAD")).every(b => b > 0 && b % 1024 === 0) && eq(capsAt("--output=x"), {}), "the queue's mark lowered below what stands fails with its mend, and capsAt reads a cap for each role and the mark a revision sets, in whole KB, whatever the working tree holds, and nothing from a revision it refuses (the fallback reviewer's check of 94d700d)"); }
ok(due({ manifest: "a project's manifest" }) === null, "the scheduled look keeps no such issue in a project");
const here = process.cwd(), empty = scratchDir("size-empty-");
try { process.chdir(empty); ok(due({ manifest: null }) === null, "nor where no roles/ or queue stands to count"); } finally { process.chdir(here); fs.rmSync(empty, { recursive: true, force: true }); }
const kept = due({ manifest: null });
ok(kept.title === DUE_TITLE && (kept.body === null || /^- what the role \S+ reads at its start is \d+ bytes over its cap\.$/m.test(kept.body) || /^- QUEUE\.md is/m.test(kept.body)), "in the core it keeps the issue while a start or the queue stands past its cap, and closes it once none does", JSON.stringify(kept));

// the script itself
const tmp = scratchDir("size-test-");
const put = (name, text) => { const to = path.join(tmp, name); fs.writeFileSync(to, text); return to; };
const run = (...args) => { const r = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, OWNER: "someone" } }); return { status: r.status, out: r.stdout + r.stderr }; };
const kb = Object.fromEntries(Object.entries(CAPS).map(([r, n]) => [r, n / 1024]));
const same = put("same.mjs", own), lower = put("lower.mjs", caps({ ...kb, builder: kb.builder - 1 })), old = put("old.mjs", at(kb.builder)), none = put("none.json", "[[]]"), one = put("one.json", JSON.stringify([yes]));
ok(run().status === 0 && Object.keys(CAPS).every(r => new RegExp(`^what the role ${r} reads at its start \\(floor/security\\.md, .*\\): \\d+ bytes of ${CAPS[r] + AGENTS.mark} \\(${CAPS[r]} its own, ${AGENTS.mark} AGENTS\\.md's share\\)$`, "m").test(run().out) && new RegExp(`^what the role ${r} reads at its start \\(.*, AGENTS\\.md\\)`, "m").test(run().out)), "with no argument it holds each role's start, AGENTS.md with it, to its cap and that file's share (#1202)", run().out);
ok(QUEUE.mark < 20 * 1024 && /^the queue \(QUEUE\.md\): \d+ bytes of its mark, \d+$/m.test(run().out), "it holds the queue to a mark of its own, below the general mark a project's size marks give each file", run().out);
const queueFile = path.join(root, QUEUE.file), queueText = fs.readFileSync(queueFile);
try {
  fs.writeFileSync(queueFile, Buffer.concat([queueText, Buffer.alloc(QUEUE.mark, "x")]));
  const based = run("--base", "HEAD");
  ok(based.status === 1 && /QUEUE\.md is \d+ bytes over its cap\. Mend: take out each finished line/.test(based.out) && mended(based.out), "a queue this change takes past its mark fails, saying the mend", based.out);
  ok(run().status === 0 && /::warning::QUEUE\.md is \d+ bytes over its cap, which fails nothing: a task to trim/.test(run().out), "with no base, as on the default branch, a queue past its mark is a warning and a task, never a failure", run().out);
} finally { fs.writeFileSync(queueFile, queueText); }
ok(run("--raise", same, none).status === 0 && run("--raise", same, none).out.includes("no role's cap is raised") && run("--raise", old, none).status === 0, "against a base with the same caps, or the one cap of before at the builder's, it passes with no comment");
ok(run("--raise", lower, none).status === 1 && run("--raise", lower, none).out.includes("Leanness check:") && mended(run("--raise", lower, none).out) && run("--raise", lower, one).status === 0 && run("--raise", lower, one).out.includes("holds a leanness check's answer"), "against a base with a lower cap for a role it fails without the answer, saying the mend, and passes with it", run("--raise", lower, none).out);
for (const r of [run("--raise"), run("--raise", same, put("bad.json", "{"))]) ok(r.status === 1 && mended(r.out), "without its files it fails, saying the mend", r.out);
const over = put("over.mjs", caps({ ...kb, builder: kb.builder - 2 }));
ok(run("--raise", over, one).status === 1 && /more than one step\. Mend: set it to /.test(run("--raise", over, one).out) && mended(run("--raise", over, one).out), "a raise of more than one step fails, saying the cap to set", run("--raise", over, one).out);
// (a copy of the core whose script's real caps are not the ones its readable block says, run as itself; and one a
// role's start has outgrown)
for (const part of ["scripts", "roles", "tasks", "floor"]) fs.cpSync(path.join(root, part), path.join(tmp, part), { recursive: true });
fs.copyFileSync(queueFile, path.join(tmp, QUEUE.file));
fs.copyFileSync(path.join(root, AGENTS.file), path.join(tmp, AGENTS.file));
const standInCap = CAPS["stand-in"] + AGENTS.mark;
const copy = path.join(tmp, "scripts", "size.mjs"), at2 = (...args) => { const r = spawnSync(process.execPath, [copy, ...args], { cwd: tmp, encoding: "utf8", env: { ...process.env, OWNER: "someone" } }); return { status: r.status, out: r.stdout + r.stderr }; };
ok(at2().status === 0, "a copy of the core counts as the core does", at2().out);
// (a file it counts, at its start or the queue, as a tracked link: refused, with its mend, and counted as nothing)
if (process.platform !== "win32") {
  let device = null;
  try { sizeOf("/dev/zero"); } catch (e) { device = e; }
  ok(device !== null && mended(device.message) && sizeOf(path.join(tmp, "no-such-file")) === 0, "a size is never read of what is no regular file: it fails with its mend; a file not there counts 0", device?.message);
  for (const [name, to] of [[AGENTS.file, "/dev/null"], [QUEUE.file, "/dev/zero"]]) {
    const at = path.join(tmp, name), text = fs.readFileSync(at);
    fs.rmSync(at); fs.symlinkSync(to, at);
    try {
      const linked = at2();
      ok(linked.status === 1 && linked.out.includes(`${name} is no regular file`) && mended(linked.out), `a tracked link in the place of ${name} is refused, with its mend`, linked.out);
    } finally { fs.rmSync(at); fs.writeFileSync(at, text); }
  }
}
const git = (...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: tmp, encoding: "utf8" });
git("init", "-q"); git("add", "-A"); git("commit", "-qm", "base");
const standIn = Number(new RegExp(`the role stand-in reads at its start \\(.*\\): (\\d+) bytes of`).exec(at2().out)?.[1]);
fs.appendFileSync(path.join(tmp, "roles", "stand-in.md"), "x".repeat(standInCap - standIn));
ok(at2("--base", "HEAD").status === 0 && new RegExp(`stand-in reads at its start \\(.*\\): ${standInCap} bytes of`).test(at2().out) && !/::warning::/.test(at2().out), "a start exactly at its cap is not past it", at2().out);
git("checkout", "-q", "--", "roles/stand-in.md");
fs.appendFileSync(path.join(tmp, "roles", "stand-in.md"), `\n${"x".repeat(CAPS["stand-in"])}\n`);
let r = at2("--base", "HEAD");
ok(r.status === 1 && /what the role stand-in reads at its start is \d+ bytes over its cap\. Mend: say the rules/.test(r.out) && mended(r.out) && !/the role builder reads at its start is/.test(r.out), "a role whose start this change takes past its cap fails, it alone, saying the mend", r.out);
ok(at2().status === 0 && /::warning::what the role stand-in reads at its start is \d+ bytes over its cap, which fails nothing/.test(at2().out), "with no base, as on the default branch, it is a warning and a task (#750, point 6)", at2().out);
git("commit", "-qam", "past the cap");
r = at2("--base", "HEAD");
ok(r.status === 0 && /::warning::what the role stand-in reads at its start is \d+ bytes over its cap, as it stood before this change, which does not grow it/.test(r.out), "past its cap at the base already, a change that does not grow it passes, with the warning", r.out);
fs.appendFileSync(path.join(tmp, "roles", "stand-in.md"), "one line more\n");
r = at2("--base", "HEAD");
ok(r.status === 1 && /over its cap, 14 of them this change's own\. Mend:/.test(r.out) && mended(r.out), "one that grows it further fails, saying how much is its own", r.out);
git("checkout", "-q", "--", "roles/stand-in.md");
for (const bad of [at2("--base", "no-such-revision"), at2("--base"), at2("--other"), at2("--base", "--output=x"), at2("--base", "HEAD:roles")]) ok(bad.status === 1 && mended(bad.out), "a base git cannot read, or an option it does not know, fails, saying the mend", bad.out);
fs.appendFileSync(path.join(tmp, "roles", "stand-in.md"), `\n${"x".repeat(CAPS["stand-in"])}\n`);
fs.writeFileSync(path.join(tmp, "roles", "planner.md"), "# The planner\n\nRead at its start by the role `planner`.\n\n**Reads at its start:** `roles/shared/git.md`.\n");
ok(/the role planner has no cap\. Mend: give it a line in CAPS/.test(at2().out) && mended(at2().out), "a role with a file and no cap fails, saying the line to add", at2().out);
fs.rmSync(path.join(tmp, "roles", "planner.md")); fs.rmSync(path.join(tmp, "roles", "reviewer.md"));
ok(/gives the role reviewer a cap, and roles\/ holds no file for it\. Mend:/.test(at2().out) && mended(at2().out), "a cap for a role with no file fails, saying the mend", at2().out);
fs.writeFileSync(copy, own.replace(/^  builder: (\d+) \* 1024,$/m, (line, n) => `  builder: ${Number(n) + 8}*1024,`).replace(/^export const CAPS = \{$/m, m => `/*\n${caps(kb)}*/\n${m}`));
const hidden = at2("--raise", same, one);
ok(hidden.status === 1 && hidden.out.includes("does not set the caps the script runs with") && mended(hidden.out) && !hidden.out.includes("ok "), "run as itself, a script whose real caps hide behind a look-alike block fails the raise check, answer or no answer", hidden.out);
// (given the head's file, it reads the head as text alone, its caps those the text sets: what the head's own script
// would say of the raise or of an answer has no say)
const raising = own.replace(/^  builder: (\d+) \* 1024,$/m, (line, n) => `  builder: ${Number(n) + 1} * 1024,`), rewritten = put("rewritten.mjs", raising.replace(/^export function answered\(comments, whose = \(\) => false\) \{$/m, m => `${m}\n  return true;`));
const byBase = run("--raise", same, none, put("rights.json", "[]"), rewritten);
ok(raising !== own && fs.readFileSync(rewritten, "utf8").includes("return true;") && byBase.status === 1 && /the role builder rises.*Leanness check:/.test(byBase.out) && mended(byBase.out)
  && run("--raise", same, one, put("rights.json", "[]"), rewritten).status === 0 && run("--raise", same, none, put("rights.json", "[]"), put("same-head.mjs", own)).out.includes("no role's cap is raised"),
  "given the head's file, the raise is judged as this script reads the head's text: one without its answer fails whatever the head's own script holds, and passes with it", byBase.out);
ok(run("--raise", same, none, put("rights.json", "[]"), path.join(tmp, "missing.mjs")).status === 1 && mended(run("--raise", same, none, put("rights.json", "[]"), path.join(tmp, "missing.mjs")).out)
  && /not the one block the check reads/.test(run("--raise", same, one, put("rights.json", "[]"), put("nocaps.mjs", "const x = 1;\n")).out),
  "  and a head it cannot read, or whose caps cannot be read, fails, saying the mend");
const elsewhere = spawnSync(process.execPath, [file], { cwd: os.tmpdir(), encoding: "utf8" });
ok(elsewhere.status === 1 && /cannot be counted: roles\/ is not here/.test(elsewhere.stderr) && mended(elsewhere.stderr), "where the core is not there (run from another folder), it fails and says so", elsewhere.stdout + elsewhere.stderr);
ok(run("--raise").status === 1 && run("--raise", same).status === 1 && run("--raise", same, path.join(tmp, "missing.json")).status === 1 && run("--raise", same, put("bad.json", "{")).status === 1 && run("--raise", path.join(tmp, "missing.mjs"), one).status === 1,
  "without its two files, or with one it cannot read, it fails");

// size.yml: the step that holds a token comes before every step that runs the repository's own code, and so does the
// raise as the base's own script judges it, given the head's file
{
  const steps = parseYaml(fs.readFileSync(path.join(root, ".github/workflows/size.yml"), "utf8")).jobs.size.steps;
  const tokened = steps.map((s, i) => [s, i]).filter(([s]) => Object.values(s.env ?? {}).some(v => /github\.token|secrets\./u.test(String(v)))).map(([, i]) => i);
  const ownCode = steps.map((s, i) => [s, i]).filter(([s]) => /(^|[\s"'])(\.\/)?scripts\//mu.test(s.run ?? "")).map(([, i]) => i);
  const judge = steps.findIndex(s => /^node "\$RUNNER_TEMP\/raise\/base\/scripts\/size\.mjs" --raise .* "\$RUNNER_TEMP\/raise\/head\.mjs"$/u.test((s.run ?? "").trim()));
  ok(tokened.length === 1 && ownCode.length >= 3 && judge >= 0 && [...tokened, judge].every(i => ownCode.every(j => i < j)),
    "size.yml: the step that holds the token, and the raise as the base's own script judges it, come before every step that runs the pull request's own code", JSON.stringify({ tokened, ownCode, judge }));
}

// size.yml's step that reads the rights of those who answered, run as it stands, against a stand-in for GitHub's API:
// a writer's right is read, and counts; a reader's is read, and does not; one the host does not answer, nor the
// owner's, which needs none, nor an account outside the repository, is asked for
{
  const step = parseYaml(fs.readFileSync(path.join(root, ".github/workflows/size.yml"), "utf8")).jobs.size.steps.find((s) => /rights of those who answered/u.test(s.name ?? ""));
  const repo = fs.mkdtempSync(path.join(tmp, "repo-"));
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  git("init", "-q"); fs.mkdirSync(path.join(repo, "scripts")); fs.writeFileSync(path.join(repo, "scripts", "size.mjs"), own);
  for (const m of ["base", "head"]) { git("add", "-A"); git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", m); }
  // (git's config count given where the environment holds none, as on a runner, since the stand-in adds one to it)
  const { env, ghData, ghLog } = ghStandIn({ ...process.env, GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT ?? "0" }, fs.mkdtempSync(path.join(tmp, "gh-")), repo);
  const says = (login, author_association) => ({ user: { login, type: "User" }, author_association, body: "Leanness check: too little room." });
  fs.writeFileSync(ghData, JSON.stringify({ "issues/1/comments": [says("SomeOne", "OWNER"), says("writer", "COLLABORATOR"), says("reader", "MEMBER"), says("silent", "MEMBER"), says("outsider", "NONE"), says("bad;name", "MEMBER")],
    "collaborators/writer/permission$": right("writer", "write", "write", true), "collaborators/reader/permission$": right("reader", "read", "read", false) }));
  fs.writeFileSync(ghLog, "");
  const runner = fs.mkdtempSync(path.join(tmp, "runner-"));
  // (in bash as GitHub runs a step, found as the workflow runner finds it: on Windows, Git for Windows' own)
  // (the step runs on ubuntu, where tar knows a path by its slashes; Git for Windows' tar takes "C:" for a host, so the path is given as that bash writes it)
  const msys = p => (process.platform === "win32" ? p.replace(/^([A-Za-z]):/u, (_, l) => `/${l.toLowerCase()}`).replaceAll("\\", "/") : p);
  const script = path.join(runner, "step.sh");
  // (jq for Windows ends its lines with CR, which the step, written for ubuntu, never meets in a login it reads; here the runner's bash is given jq with the lines the step expects)
  const jqLf = "jq() { local o s; o=$(command jq \"$@\"); s=$?; if [ -n \"$o\" ]; then printf '%s\\n' \"${o//$'\\r'/}\"; fi; return $s; }\n";
  fs.writeFileSync(script, (process.platform === "win32" ? jqLf : "") + step.run);
  const r = spawnSync(onPath("bash", env), ["-e", script], { cwd: repo, encoding: "utf8", env: { ...env, ...(process.platform === "win32" ? { NoDefaultCurrentDirectoryInExePath: "1" } : {}), GH_TOKEN: "not-a-token", NUMBER: "1", OWNER: "someone", RUNNER_TEMP: msys(runner), GITHUB_REPOSITORY: "someone/project" } });
  if (r.status !== 0) console.error(r.stdout + r.stderr);
  const rights = JSON.parse(fs.readFileSync(path.join(runner, "raise", "rights.json"), "utf8")), whose = whoseOf("someone", rights);
  ok(r.status === 0 && rights.length === 2 && whose({ login: "writer", type: "User" }) && !whose({ login: "reader", type: "User" }) && !whose({ login: "silent", type: "User" }) && whose({ login: "SomeOne", type: "User" })
    && r.stdout.includes("The host's rights of silent could not be read") && !/outsider|bad;name|someone\b/iu.test(r.stdout),
    "size.yml reads the rights of those who answered: a writer's counts, a reader's and one not answered do not, and the owner, an outsider and a login of any other form are not asked for", r.stdout + r.stderr);
  // (git keeps a text file with LF where a Windows checkout has CRLF, so the two are read by their lines)
  const lf = t => t.replaceAll("\r\n", "\n");
  ok(lf(fs.readFileSync(path.join(runner, "raise", "head.mjs"), "utf8")) === lf(own) && lf(fs.readFileSync(path.join(runner, "raise", "base", "scripts", "size.mjs"), "utf8")) === lf(own),
    "  and puts by the head's script as text and the base's own scripts, for the base's to judge the raise");
}

// size.yml's step for the split mark, run as it stands on a repository of the core's form (#1413, point 6): a pull
// request that changes a file past the mark with no line under "past" fails nothing for it, and is told its question;
// a line under "past" for a file no longer past the mark still fails, with its mend
{
  const step = parseYaml(fs.readFileSync(path.join(root, ".github/workflows/size.yml"), "utf8")).jobs.size.steps.find(s => /past the split mark/u.test(s.name ?? ""));
  const repo = fs.mkdtempSync(path.join(tmp, "split-"));
  const git = (...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: repo, encoding: "utf8" });
  const marks = past => { fs.mkdirSync(path.join(repo, ".github"), { recursive: true }); fs.writeFileSync(path.join(repo, ".github/sizes.json"), JSON.stringify({ each: 1024, read: {}, total: 1024, split: 20480, past })); };
  // (the core's scripts in the repository, as in the core's own, since the check reads the repository its script stands in)
  git("init", "-q"); fs.cpSync(path.join(root, "scripts"), path.join(repo, "scripts"), { recursive: true }); marks({}); fs.writeFileSync(path.join(repo, "long.md"), "x\n".repeat(11000)); git("add", "-A"); git("commit", "-q", "-m", "base");
  fs.appendFileSync(path.join(repo, "long.md"), "one more line\n"); git("commit", "-qam", "head");
  const run = () => spawnSync(onPath("bash", process.env), ["-ec", step.run], { cwd: repo, encoding: "utf8", env: { ...process.env, ...step.env } });
  const r = run();
  ok(/^A file past the split mark/u.test(step.name) && step.env?.SIZES_BASE === "HEAD^1" && r.status === 0 && /long\.md is \d+ bytes, past the 20480-byte mark, and this PR changes it, which fails nothing: it has no line under "past"\. Mend: ask in what ways/u.test(r.stdout + r.stderr),
    "size.yml: a pull request that changes a file past the split mark with no line under \"past\" fails nothing for it, and is told its question and the line to write", r.stdout + r.stderr);
  marks({ "long.md": { mark: 22100, why: "#1" }, "short.md": { mark: 30000, why: "#2" } }); fs.writeFileSync(path.join(repo, "short.md"), "short\n"); git("add", "-A"); git("commit", "-q", "-m", "a line for a short file");
  const stale = run();
  ok(stale.status === 1 && /short\.md/u.test(stale.stderr) && mended(stale.stderr), "  and a line under \"past\" for a file no longer past the mark still fails, with its mend", stale.stdout + stale.stderr);
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the cap's check`);
process.exit(failed ? 1 : 0);
