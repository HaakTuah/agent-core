// Tests of the caps' own check (size.mjs): what it counts for each role, the caps a version of the file sets, whose comment answers for
// a raise, and what is said of a pull request that raises one. Node's own modules only.
//
//   node scripts/size-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { CAPS, QUEUE, answered, capsOf, counted, raised, rolesAt } from "./size.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const file = fileURLToPath(new URL("./size.mjs", import.meta.url)), root = path.dirname(path.dirname(file));
const own = fs.readFileSync(file, "utf8");
// a version of the file from before each role had its cap, and one with a cap a role
const at = kb => `// a comment\nexport const CAP = ${kb} * 1024;\nconst other = 1;\n`;
const caps = of => `// a comment\nexport const CAPS = {\n${Object.entries(of).map(([r, kb]) => `  ${/-/.test(r) ? `"${r}"` : r}: ${kb} * 1024,\n`).join("")}};\nconst other = 1;\n`;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the caps a version of the file sets
ok(eq(capsOf(own), CAPS) && eq(capsOf(caps({ builder: 27, "stand-in": 19 })), { builder: 27 * 1024, "stand-in": 19 * 1024 }) && eq(capsOf(caps({ builder: 27 }).replace(/\n/g, "\r\n")), { builder: 27 * 1024 }),
  "the caps are read from the one block that sets them, here and in any version, whichever line endings it has");
ok(eq(capsOf(at(52)), { builder: 52 * 1024 }) && eq(capsOf("const CAP = 44 * 1024;\n"), { builder: 44 * 1024 }), "a version from before each role had its cap gives its one cap as the builder's");
ok([at(0), at("052"), at("5e1"), at("-1"), "let CAP = 52 * 1024;\n", "export const CAP = 53248;\n", `${at(52)}${at(53)}`, `${at(52)}${caps({ builder: 52 })}`, `${caps({ builder: 52 })}${caps({ builder: 53 })}`, caps({ builder: 52, reviewer: 20 }).replace("  reviewer", "  builder"),
  caps({ builder: 52 }).replace("52 * 1024", "52*1024"), caps({ builder: 52 }).replace("  builder", "builder"), `/*\n${caps({ builder: 52 })}*/\n`.replace("export const CAPS", "// export const CAPS"), "export const CAPS = {\n};\n", "", null, 5].every(t => capsOf(t) === null),
  "a block or line spelled any other way, two of them, a role named twice, or no text at all gives no caps");

// whose comment answers
const comment = (body, author_association = "OWNER") => ({ body, author_association });
ok(answered([comment("Leanness check: a fresh session read all the rules and found too little room.")]) && answered([[comment("x")], [comment("**Leanness check:** no room", "COLLABORATOR")]]) && answered([comment("Leanness check: found", "MEMBER")]),
  "a comment that opens with the leanness check's answer, from the owner, a member or a collaborator, answers, in a list or a list of pages");
ok(!answered([]) && !answered([comment("About the Leanness check: none yet")]) && !answered([comment(" Leanness check: x")]) && !answered([comment("leanness check: x")]) && !answered([comment("Leanness check")]),
  "one that only speaks of it, or opens any other way, does not");
ok(["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", null, 5].every(who => !answered([comment("Leanness check: x", who)])), "nor does anyone else's, whatever it says");
ok(!answered(null) && !answered({}) && !answered("Leanness check: x") && !answered([null, 1, "Leanness check: x", { author_association: "OWNER" }, { body: 5, author_association: "OWNER" }]), "nor a list in any other form, or an entry that is no comment");

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

// what it counts
const template = name => fs.readFileSync(fileURLToPath(new URL(`../setup/template/${name}`, import.meta.url)), "utf8");
const imported = [...`${template("AGENTS.md.tmpl")}\n${template("CLAUDE.md.tmpl")}`.matchAll(/^@core\/(\S+)$/gmu)].map(m => m[1]);
const named = /`core\/(tools\/other-builders\.md)`/u.exec(template("AGENTS.md.tmpl"))?.[1];
const expected = [...imported, named].sort(), builder = counted("builder", root);
ok(named && eq([...builder].sort(), expected) && !builder.includes("floor/topics.md") && !builder.includes("tasks/reviews.md"),
  "for the builder it counts what the starter kit's templates have a builder read at its start (the floor's security.md, its role's file, the modules read then, each tool's own part), and no file read only when a task calls for it", `${builder} against ${expected}`);
ok(eq(rolesAt(root).sort(), Object.keys(CAPS).sort()) && rolesAt(root).every(r => counted(r, root).includes("floor/security.md") && counted(r, root).includes(`roles/${r}.md`)) && counted("nobody", root) === null,
  "every role the core has a file for has a cap, and its count holds the floor and its own file");
ok(counted("design", root).includes("roles/builder.md") && counted("orchestrator", root).includes("roles/orchestrator.md") && !counted("builder", root).includes("roles/orchestrator.md") && !counted("stand-in", root).includes("roles/shared/git.md"),
  "a role's count holds what its file names, a role's file named there with what that names, and nothing another role alone reads");

// the script itself
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "size-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const put = (name, text) => { const to = path.join(tmp, name); fs.writeFileSync(to, text); return to; };
const run = (...args) => { const r = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
const kb = Object.fromEntries(Object.entries(CAPS).map(([r, n]) => [r, n / 1024]));
const same = put("same.mjs", own), lower = put("lower.mjs", caps({ ...kb, builder: kb.builder - 1 })), old = put("old.mjs", at(kb.builder)), none = put("none.json", "[[]]"), one = put("one.json", JSON.stringify([yes]));
ok(run().status === 0 && Object.keys(CAPS).every(r => new RegExp(`^what the role ${r} reads at its start \\(floor/security\\.md, .*\\): \\d+ bytes of ${CAPS[r]}$`, "m").test(run().out)), "with no argument it holds each role's start to its cap", run().out);
ok(QUEUE.mark < 20 * 1024 && /^the queue \(QUEUE\.md\): \d+ bytes of its mark, \d+$/m.test(run().out), "it holds the queue to a mark of its own, below the general mark a project's size marks give each file", run().out);
const queueFile = path.join(root, QUEUE.file), queueText = fs.readFileSync(queueFile);
try {
  fs.writeFileSync(queueFile, Buffer.concat([queueText, Buffer.alloc(QUEUE.mark, "x")]));
  ok(run().status === 1 && /QUEUE\.md is \d+ bytes past its mark\. Mend: take out each finished line/.test(run().out) && mended(run().out), "a queue past its mark fails, saying the mend", run().out);
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
const copy = path.join(tmp, "scripts", "size.mjs"), at2 = (...args) => { const r = spawnSync(process.execPath, [copy, ...args], { cwd: tmp, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
ok(at2().status === 0, "a copy of the core counts as the core does", at2().out);
fs.appendFileSync(path.join(tmp, "roles", "stand-in.md"), `\n${"x".repeat(CAPS["stand-in"])}\n`);
ok(at2().status === 1 && /what the role stand-in reads at its start is \d+ bytes over its cap\. Mend: say the rules/.test(at2().out) && mended(at2().out) && !/the role builder reads at its start is/.test(at2().out), "a role whose start has outgrown its cap fails, it alone, saying the mend", at2().out);
fs.writeFileSync(path.join(tmp, "roles", "planner.md"), "# The planner\n\nRead at its start by the role `planner`.\n\n**Reads at its start:** `roles/shared/git.md`.\n");
ok(/the role planner has no cap\. Mend: give it a line in CAPS/.test(at2().out) && mended(at2().out), "a role with a file and no cap fails, saying the line to add", at2().out);
fs.rmSync(path.join(tmp, "roles", "planner.md")); fs.rmSync(path.join(tmp, "roles", "reviewer.md"));
ok(/gives the role reviewer a cap, and roles\/ holds no file for it\. Mend:/.test(at2().out) && mended(at2().out), "a cap for a role with no file fails, saying the mend", at2().out);
fs.writeFileSync(copy, own.replace(/^  builder: (\d+) \* 1024,$/m, (line, n) => `  builder: ${Number(n) + 8}*1024,`).replace(/^export const CAPS = \{$/m, m => `/*\n${caps(kb)}*/\n${m}`));
const hidden = at2("--raise", same, one);
ok(hidden.status === 1 && hidden.out.includes("does not set the caps the script runs with") && mended(hidden.out) && !hidden.out.includes("ok "), "run as itself, a script whose real caps hide behind a look-alike block fails the raise check, answer or no answer", hidden.out);
const elsewhere = spawnSync(process.execPath, [file], { cwd: os.tmpdir(), encoding: "utf8" });
ok(elsewhere.status === 1 && /cannot be counted: roles\/ is not here/.test(elsewhere.stderr) && mended(elsewhere.stderr), "where the core is not there (run from another folder), it fails and says so", elsewhere.stdout + elsewhere.stderr);
ok(run("--raise").status === 1 && run("--raise", same).status === 1 && run("--raise", same, path.join(tmp, "missing.json")).status === 1 && run("--raise", same, put("bad.json", "{")).status === 1 && run("--raise", path.join(tmp, "missing.mjs"), one).status === 1,
  "without its two files, or with one it cannot read, it fails");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the cap's check`);
process.exit(failed ? 1 : 0);
