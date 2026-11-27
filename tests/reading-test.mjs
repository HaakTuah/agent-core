// Tests of the reading script (reading.mjs): how a file says when it is read, what a role reads at its start, what a
// task calls for by its kinds, its paths, its tools and its issue, the check that every module and role says when, the
// line a pull request lists its reading on, and the script run in the core and in a scratch project that holds a copy.
// Node's own modules and git only.
//
//   node tests/reading-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { FLOOR, FLOOR_WHEN, KINDS_BY_PATH, MAKE, PAST, READ_LINE, START, TRY, asked, budget, calledByPaths, coreAt, faults, gather, hookLine, kindsOf, leftOut, library, lineMend, listed, matches as matchesIn, opening, ownOf, ownPaths, reading, readsOf, taken, whenOf } from "../scripts/reading.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
// (each case its own reading, with a budget of its own, where it gives none)
const matches = (pattern, file, within = budget()) => matchesIn(pattern, file, within);

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const file = fileURLToPath(new URL("../scripts/reading.mjs", import.meta.url)), root = path.dirname(path.dirname(file));

// how a file says when it is read
const w = text => whenOf(`# A title\n\n${text}\n\nMore, with the kind \`later\`.\n`);
ok(opening("# T\n\n\nRead when a\nthing is done.\n\nNext.") === "Read when a thing is done." && opening("Read at once.\nMore.") === "Read at once. More." && opening("# T\n") === "", "the opening paragraph is the first after the title, its lines joined");
ok(eq(w("Read when a screen changes (core archive 1): the kinds `screen` and `polish`. A screen is `x`."), { start: false, kinds: ["screen", "polish"], paths: [], tools: [], others: [], roles: [] }), "kinds are read after \"the kinds\", joined by commas, and, or; nothing after the paragraph, and no other word in backticks");
ok(eq(w("Read when an update is taken: the kind `update`; the paths `.github/dependabot.yml`, `.node-version` or\n`package*lock.json`.").paths, [".github/dependabot.yml", ".node-version", "package*lock.json"]) && eq(w("Read for the path `a/`.").paths, ["a/"]), "paths after \"the paths\" or \"the path\", over a line's end too");
ok(eq(w("Read by the tool `claude` at the start of every task."), { start: true, kinds: [], paths: [], tools: ["claude"], others: [], roles: [] }) && eq(w("Read at its start by a session of every tool but `claude` and `codex`.").others, ["claude", "codex"]) && w("Read at its start by x.").start,
  "a tool, every tool but some, and \"at the start\" or \"at its start\"");
ok(eq(w("Read at its start by the role `stand-in`: a fresh session.").roles, ["stand-in"]) && w("What every reviewer judges by, read whole.") === null && whenOf("") === null && whenOf(null) === null, "a role's file names its role; a paragraph that does not begin \"Read\" says nothing");

// the files a role's file names
const role = `# The x\n\nRead at its start by the role \`x\`.\n\n**${START}** \`tasks/a.md\`, \`roles/builder.md\` and\n\`tasks/b.md\`; with its brief, and \`tasks/not.md\`.\n\n**Hands over, gets back:**\n- y: \`tasks/z.md\`.\n`;
ok(eq(readsOf(role, START), ["tasks/a.md", "roles/builder.md", "tasks/b.md"]) && eq(readsOf(role.replace("; with", ". With"), START), ["tasks/a.md", "roles/builder.md", "tasks/b.md"]) && readsOf("# T\n\nText.\n", START) === null && eq(readsOf(`**${START}** its brief alone.\n`, START), []),
  "a role's line names its files up to the first stop or semicolon, over a line's end; with no such line, none");

// a changed path against a pattern
ok(matches(".github/workflows/", ".github/workflows/tests.yml") && !matches(".github/workflows/", "docs/.github/workflows/x.yml") && !matches(".claude/", ".claude.md") && matches(".claude/", ".claude/settings.json"), "a folder holds every path under it, from the root");
ok(matches("CLAUDE.md", "CLAUDE.md") && matches("CLAUDE.md", "tools/CLAUDE.md") && !matches("CLAUDE.md", "NOT-CLAUDE.md") && matches("package*lock.json", "app/package-lock.json") && matches("package*lock.json", "packages.lock.json") && !matches("package*lock.json", "package.json"), "a name with no folder is a file's name wherever it lies, * for any run of its letters");
ok(["Cargo.lock", "svc/yarn.lock", "bun.lockb", "packages.lock.json", "app/package-lock.json", "pnpm-lock.yaml", "npm-shrinkwrap.json", "svc/go.sum"].every(f => KINDS_BY_PATH.some(r => r.kind === "update" && matches(r.path, f))) && ["clock.json", "block.js", "padlock.md", "go.sum.txt", "package.json"].every(f => !KINDS_BY_PATH.some(r => r.kind === "update" && matches(r.path, f))),
  "a lock file of any kind is an update, and a file whose name only ends like one is not");
ok(matches(".github/dependabot.yml", ".github/dependabot.yml") && !matches(".github/dependabot.yml", "x/.github/dependabot.yml") && matches("src/**/*.css", "src/a/b/c.css") && matches("src/*.css", "src/a.css") && !matches("src/*.css", "src/a/b.css") && !matches("a.b", "aXb") && matches("./a/", "a/b"), "a path with a folder is from the root, * within a folder and ** across them, and a dot is a dot");
// (the matcher walks the path, never backtracking: "**/" may match nothing, the parts that stand between stars are
// literal, and a pattern of many stars side by side that matches nothing answers at once; #673)
const slowAt = Date.now();
ok(matches("**/x", "x") && matches("**/x", "a/b/x") && matches("a*a", "aa") && !matches("a*a", "a") && matches("*b*", "abc") && !matches("x*", "abc") && matches("a?b", "a?b") && !matches("a?b", "axb") && matches("src/a.(x)", "src/a.(x)") && !matches(`${"*a".repeat(40)}b`, "a".repeat(200)) && !matches(`${"**/".repeat(40)}*z*z*z*q`, "a/".repeat(100)) && Date.now() - slowAt < 1000,
  "a pattern's stars, ** across folders and literal parts match as before, and one of many stars side by side that matches nothing answers at once");
const walkAt = Date.now();
ok(matches("*a".repeat(200), "a".repeat(2000)) && matches(`x/${"*".repeat(100000)}y`, `x/${"z/".repeat(25000)}y`) && !matches("x/a*b", "x/a/zb") && matches("a**b", "a\nb") && !matches("x/a*b", "x/a\n/b") && Date.now() - walkAt < 2000,
  "a pattern that passes the one-pass check is walked in time its parts times the path's length, a run of stars as one part, * never across a folder, and ** across a line's end too (where the old expression did not, so such a path calls for more, never less)");
// (a reading's budget, #673: each try paid from it, a try past it matching, which calls for more reading, never less)
const deep = `x/${"*a".repeat(100)}q`, near = `x/${"a/".repeat(200)}aq`;
ok(!matches(deep, near) && matches(deep, near, budget(50000)), "a pattern whose walk would pass what is left of its reading's budget matches, calling for more reading, and one within it is walked");
let seed = 1;
const draw = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n; };
const pick = (from, n) => Array.from({ length: n }, () => from[draw(from.length)]).join("");
const tries = Array.from({ length: 3000 }, () => [pick(["*", "**/", "/", "a", "b", "./"], 1 + draw(7)), pick(["/", "a", "b", "\\", "./"], draw(9)), MAKE + draw(1400)]);
const cutShort = tries.filter(([p, f, n]) => matches(p, f, budget(n)) !== matches(p, f));
ok(cutShort.length > 100 && cutShort.every(([p, f, n]) => matches(p, f, budget(n)) && !matches(p, f)), `whatever is left of its budget, a try answers as with all of it or matches, never less (${cutShort.length} of ${tries.length} tries cut short)`);
const spent = budget(50000);
ok(matches(deep, near, spent) && spent.over && spent.left === 0 && matches("a", "b", spent) && matches("x/", "y/z", spent) && !matches("a", "b") && !matches("x/", "y/z"),
  "once a reading's budget is spent, every try after it in that reading matches, and a try with a budget of its own answers as before");

// a small core
const texts = {
  "roles/builder.md": `# B\n\nRead at the start by the role \`builder\`.\n\n**${START}** \`tasks/work.md\`, \`roles/shared/git.md\`.\n`,
  "roles/design.md": `# D\n\nRead at its start by the role \`design\`.\n\n**${START}** \`roles/builder.md\` and what that names.\n`,
  "roles/reviewer.md": `# R\n\nRead at its start by the role \`reviewer\`.\n\n**${START}** \`tasks/guidelines.md\`, \`tasks/work.md\`.\n`,
  "tasks/work.md": "# W\n\nRead at the start of every task.\n",
  "roles/shared/git.md": "# G\n\nRead at the start of every task.\n",
  "tasks/guidelines.md": "# G\n\nRead at its start by every reviewer.\n",
  "tasks/reviews.md": "# R\n\nRead when a PR is reviewed: the kind `review`.\n",
  "tasks/screens.md": "# S\n\nRead when a screen changes: the kinds `screen` and `polish`.\n",
  "tasks/games.md": "# G\n\nRead before a polish task: the kind `polish`.\n",
  "tasks/updates.md": "# U\n\nRead for an update: the kind `update`; the paths `.github/dependabot.yml` and `package*lock.json`.\n",
  "tools/claude.md": "# C\n\nRead by the tool `claude` at the start of every task.\n",
  "tasks/others.md": "# O\n\nRead at the start of every task by a session of every tool but `claude`.\n",
  "tools/kiro.md": "# K\n\nRead by a session of the tool `kiro`, and by whoever hands it a task.\n",
};
texts["floor/topics/workflows.md"] = "# W\n\nRead before a workflow or a lock file changes: the kinds `workflow` and `update`; the paths `.github/workflows/` and `*lock.json`.\n";
const lib = gather(f => texts[f] ?? null, folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/")));
const files = got => got.task.map(t => t.file);
ok(eq(reading(lib, { role: "builder" }), { start: [FLOOR, "roles/builder.md", "tasks/work.md", "roles/shared/git.md"], task: [] }), "a role reads at its start the floor, its own file and the files that names, in that order, and nothing a task alone calls for");
ok(eq(reading(lib, { role: "design" }).start, [FLOOR, "roles/design.md", "roles/builder.md", "tasks/work.md", "roles/shared/git.md"]) && eq(reading(lib, { role: "reviewer" }).start, [FLOOR, "roles/reviewer.md", "tasks/guidelines.md", "tasks/work.md"]),
  "a role's file named there brings what it names too; another role reads its own and no other's");
ok(/"planner" is no role the core has a file for\. Mend: give one of builder, design, reviewer/.test(reading(lib, { role: "planner" }).error) && reading(lib, { role: "" }).error, "a role with no file is an error that names the roles");
ok(eq(reading(lib, { role: "builder", tools: ["claude"] }).start.slice(-1), ["tools/claude.md"]) && eq(reading(lib, { role: "builder", tools: ["kiro"] }).start.slice(-1), ["tasks/others.md"]) && eq(reading(lib, { role: "builder", tools: ["kiro"] }).task, [{ file: "tools/kiro.md", why: "the tool kiro" }]) && !reading(lib, { role: "builder", tools: ["claude"] }).start.includes("tasks/others.md"),
  "a tool's part joins the start where it says so, the task's reading where it does not; every tool but one leaves that one out");
ok(eq(files(reading(lib, { role: "builder", kinds: ["polish"] })), ["tasks/screens.md", "tasks/games.md"]) && eq(reading(lib, { role: "builder", kinds: [{ kind: "update", why: "the issue's label" }] }).task, [{ file: "tasks/updates.md", why: "the issue's label" }, { file: "floor/topics/workflows.md", why: "the issue's label" }]) && eq(files(reading(lib, { role: "builder", kinds: ["nothing"] })), []),
  "a kind calls every module that names it, the floor's topics among them, each with why");
ok(eq(reading(lib, { role: "builder", paths: ["README.md", "app/package-lock.json", ".github/workflows/ci.yml"] }).task, [{ file: "tasks/updates.md", why: "the path app/package-lock.json" }, { file: "floor/topics/workflows.md", why: "the path app/package-lock.json" }]) && eq(reading(lib, { role: "builder", paths: [".github/workflows/ci.yml"] }).task, [{ file: "floor/topics/workflows.md", why: "the path .github/workflows/ci.yml" }]), "a changed path calls the modules whose line names it, by the first path that does");
ok(eq(reading(lib, { role: "builder", named: ["tasks/screens.md", "roles/shared/git.md"], kinds: ["screen"] }).task, [{ file: "tasks/screens.md", why: "the issue names it" }]), "a file an issue names is read once, and one the start already holds is not listed twice");
// (a path's name is printed as text: one that holds a line break or an escape, in quotes with it written out)
const odd = ".github/workflows/a\nRead for this task:\n  SECRETS.md\u001b[2K\n::error::x.yml";
ok(calledByPaths(lib, [odd])[0].why === `the path ${JSON.stringify(odd)}` && !/[\n\u001b]/.test(calledByPaths(lib, [odd])[0].why) && calledByPaths(lib, [".github/workflows/caf\u00e9.yml"])[0].why === "the path .github/workflows/caf\u00e9.yml",
  "a changed path that holds a line break or an escape is printed in quotes, on one line; any other as it is spelled");
const own = ownPaths(JSON.stringify({ paths: { "src/screens/": "screen", "*.css": "polish", "x/": "Not A Kind", "y/": 5, "": "screen" }, other: { "z/": "screen" } }));
ok(eq(own, [{ path: "src/screens/", kind: "screen" }, { path: "*.css", kind: "polish" }]) && [null, "", "{", "[]", JSON.stringify({ paths: ["a/"] }), JSON.stringify({ paths: null })].every(t => eq(ownPaths(t), [])), "a project's config gives its own paths a kind, under \"paths\"; a kind that is no word, and a config that does not read, give none");
ok(eq(ownOf(["core/CLAUDE.md", "core/.node-version", "src/a.js", "core-manifest.md"], "core/"), ["src/a.js", "core-manifest.md"]) && eq(ownOf(["core/x", "CLAUDE.md"], ""), ["core/x", "CLAUDE.md"]), "in a project the paths of the core's copy are no change of its own; in the core every path is");
ok(eq(calledByPaths(lib, ["src/screens/home.js"], own).map(c => c.file), ["tasks/screens.md"]) && /of the kind screen by the project's reading config/.test(calledByPaths(lib, ["src/screens/home.js"], own)[0].why) && eq(calledByPaths(lib, ["a/site.css"], own).map(c => c.file), ["tasks/screens.md", "tasks/games.md"]) && eq(calledByPaths(lib, ["src/other.js"], own), []),
  "so a changed path of the project's own calls the modules of its kind");
// a module a project's manifest leaves out is never named
const listOf = "Floor: whole. Modules: `screens.md`, `updates`.\nNot taken: `games.md` (no game here), `tasks/screens.md` (named above all the same).\n";
ok(eq([...leftOut(listOf)], ["games.md"]) && eq([...leftOut("Floor: whole. Modules: all.\nNot taken: `games.md` (x).")], []) && eq([...leftOut("Modules: all (see `screens.md`).\nNot taken: `games.md` (x).")], []) && eq([...leftOut("Modules: `updates.md`.\nNot taken: `tasks/screens.md` (see `games.md` instead), `tools/kiro.md`.")], ["screens.md", "kiro.md"]) && eq([...leftOut("Modules: some of them.\nNot taken: `games.md`.")], []) && eq([...leftOut(null)], []),
  "a module is left out where the manifest's list does not name it and its \"Not taken:\" does; with \"all\", or a line that cannot be read, none is");
ok(eq(files(reading(taken(lib, leftOut(listOf)), { role: "builder", kinds: ["polish"] })), ["tasks/screens.md"]) && eq(calledByPaths(taken(lib, leftOut(listOf)), ["a/site.css"], own).map(c => c.file), ["tasks/screens.md"]) && eq(reading(taken(lib, leftOut(listOf)), { role: "builder" }).start, reading(lib, { role: "builder" }).start),
  "so a kind or a path calls only the modules the project takes, and the start is the same");
// (a reading's budget, #673: past it each kind and module whose patterns are left is called, saying so, never fewer;
// every kind of try, and making a pattern ready, spends it, so a reading of many stops at it; a reading's own budget is
// never another's)
const changes = [".github/workflows/ci.yml", "README.md"], exactly = calledByPaths(lib, changes, own), cutOff = calledByPaths(lib, changes, own, budget(MAKE));
ok(eq(exactly, [{ file: "floor/topics/workflows.md", why: "the path .github/workflows/ci.yml" }]) && exactly.every(c => cutOff.some(d => d.file === c.file)) && eq(cutOff.map(c => c.file).sort(), ["floor/topics/workflows.md", "tasks/games.md", "tasks/screens.md", "tasks/updates.md"]) && cutOff.every(c => c.why.startsWith(PAST)),
  "a reading past its budget calls each module a path pattern or its kind names, the files it would call among them, each saying why", JSON.stringify(cutOff));
const ofOne = paths => ({ roles: {}, modules: { "tasks/one.md": { start: false, kinds: [], paths, tools: [], others: [], roles: [] } } });
const kindsOfTry = { "a folder": [i => `d${i}/`, j => `e${j}/x.js`], "a name exactly": [i => `n${i}.md`, j => `p/longer${j}.js`], "a pattern's ends": [i => `a${i}*z`, j => `b${j}`],
  "its runs in order": [i => `*${i}q*z`, j => `b${j}z`], "a walk": [i => `x/*${i}*q`, j => `x/${j}/q`] };
for (const [what, [pattern, file]] of Object.entries(kindsOfTry)) {
  const patterns = Array.from({ length: 100 }, (_, i) => pattern(i)), within = budget(patterns.reduce((n, p) => n + MAKE + TRY * p.length, 0) + 100 * 100 * TRY / 2);
  calledByPaths(ofOne(patterns), Array.from({ length: 100 }, (_, j) => file(j)), [], within);
  ok(within.over, `ten thousand tries of ${what} run out a budget of half their own steps`);
}
const made = budget(5000 * MAKE);
calledByPaths(ofOne(Array.from({ length: 10000 }, (_, i) => `m${i}.md`)), ["a.md"], [], made);
ok(made.over, "making ten thousand patterns ready runs out a budget of half the steps they take");
const hundred = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`tasks/m${i}.md`, { start: false, kinds: [], paths: Array.from({ length: 100 }, (_, j) => `q${i}x${j}/*.css`), tools: [], others: [], roles: [] }]));
const within = budget(1 << 18), many = calledByPaths({ roles: {}, modules: hundred }, Array.from({ length: 10000 }, (_, j) => `src/p${j}/f.js`), [], within);
ok(within.over && within.left === 0 && many.length === 100 && many.every(c => c.why === PAST), "a reading of ten thousand patterns on ten thousand paths, a hundred million tries, stops at its budget, each module then called at once");
const before = calledByPaths(lib, [near, ...changes], own), wasted = budget(1 << 16);
calledByPaths(ofOne(Array.from({ length: 4000 }, () => `x/${"*a".repeat(600)}q`)), [`x/${"a/".repeat(1000)}aq`], [], wasted);
ok(wasted.over && eq(calledByPaths(lib, [near, ...changes], own), before) && !before.some(c => c.why.startsWith(PAST)), "a reading answers the same after another ran past its budget: each spends its own");
ok(eq([...kindsOf(lib).keys()].filter(k => !Object.values(FLOOR_WHEN).some(f => f.kinds.includes(k))), ["polish", "review", "screen", "update", "workflow"]) && eq(kindsOf(lib).get("update"), ["tasks/updates.md", "floor/topics/workflows.md"]), "the kinds are those the modules name, each with its files");

ok(["tasks/updates.md", "floor/topics/dependencies.md", "floor/topics/licences.md", "floor/topics/what-ships.md"].every(f => calledByPaths(library(root, ""), ["app/package-lock.json"]).some(c => c.file === f && c.why === "the path app/package-lock.json")) && calledByPaths(library(root, ""), ["a/clock.json"]).length === 0,
  "in the core as it stands a changed lock file calls the updates' module and the floor's topics an update touches, by its kind, and a name that only ends like one calls nothing");
// the check that every module and role says when
const fault = change => { const t = { ...texts, ...change }; return faults(gather(f => t[f] ?? null, folder => Object.keys(t).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/"))), f => f in t || f === FLOOR); };
ok(eq(fault({}), []), "a core whose modules and roles each say when has no fault");
const each = [
  [{ "tasks/new.md": "# N\n\nA module about something.\n" }, /tasks\/new\.md does not say when it is read\. Mend: open it, under its title, with a paragraph that begins "Read"/],
  [{ "tasks/new.md": "# N\n\nRead when it is needed.\n" }, /tasks\/new\.md says "Read" but not when in words the reading script matches, and no role's file names it\. Mend: add/],
  [{ "tasks/new.md": "# N\n\nRead at the start of every task.\n" }, /tasks\/new\.md says it is read at the start, and no role's file names it\. Mend:/],
  [{ "tasks/new.md": "# N\n\nRead for the kind `Two Words`.\n" }, /`Two Words` is no kind the script can match\. Mend:/],
  [{ "roles/planner.md": "# P\n\nThe planner plans.\n\n**Reads at its start:** `roles/shared/git.md`.\n" }, /roles\/planner\.md does not say when it is read\. Mend: .*the role `planner`/],
  [{ "roles/planner.md": "# P\n\nRead at its start by the role `planner`.\n" }, /roles\/planner\.md names no file its role reads at its start\. Mend:/],
  [{ "roles/planner.md": `# P\n\nRead at its start by the role \`planner\`.\n\n**${START}** \`tasks/gone.md\`.\n` }, /roles\/planner\.md names tasks\/gone\.md, which is no file of the core\. Mend:/],
  [{ "roles/planner.md": `# P\n\nRead at its start by the role \`planner\`.\n\n**${START}** \`${FLOOR}\`, \`roles/shared/git.md\`.\n` }, /which every role reads whatever its file names\. Mend: take it out/],
  [{ "roles/The Planner.md": `# P\n\nRead at its start by the role \`The Planner\`.\n\n**${START}** \`roles/shared/git.md\`.\n` }, /its name is no word a session can give as its role\. Mend:/],
];
for (const [change, said] of each) { const found = fault(change); ok(found.some(f => said.test(f)) && mended(found.map(f => `FAIL: ${f}`).join("\n")), `a fault is found, each saying its mend: ${String(said).slice(1, 60)}`, found.join("\n")); }

// the line a pull request lists its reading on
ok(eq(listed(`x\n${READ_LINE} \`a.md\`\n\n ${READ_LINE} \`core/tasks/b.md\`, \`floor/topics/workflows.md\`\n`), ["core/tasks/b.md", "floor/topics/workflows.md"]) && listed("no line") === null && eq(listed(`${READ_LINE} nothing its paths call for`), []), "the description's last such line gives the files it lists; none where there is no line");
const called = [{ file: "floor/topics/workflows.md", why: "the path .github/workflows/ci.yml" }, { file: "tasks/updates.md", why: "the path x" }];
ok(lineMend("x", [], "cmd") === null && lineMend(`${READ_LINE} \`tasks/updates.md\`, \`floor/topics/workflows.md\`, \`more.md\``, called, "cmd") === null, "a pull request whose paths call for nothing needs no line, and one that lists each file passes, whatever else it lists");
ok(/is missing; it must list `floor\/topics\/workflows\.md` \(the path \.github\/workflows\/ci\.yml\), `tasks\/updates\.md`/.test(lineMend("x", called, "cmd")) && /does not list `floor\/topics\/workflows\.md`.*Mend: read each of those files whole, check the change against it.*\(cmd prints the line\)/.test(lineMend(`${READ_LINE} \`tasks/updates.md\``, called, "cmd")) && !/updates/.test(lineMend(`${READ_LINE} \`tasks/updates.md\``, called, "cmd").split("Mend:")[0])
  && mended(`FAIL ${lineMend("x", called, "cmd")}`), "one that lacks a file fails, naming each file lacking with the path that called it, and the mend");

// what an issue names under "What to read"
ok(["constructor", "toString", "__proto__", "hasOwnProperty"].every(w => !Object.hasOwn(lib.modules, w)), "a name every object carries is no file of the core");
ok(eq(asked("**What it is**\nAn idea, `not this`.\n\n**What to read**\nThe kinds `screen`, and `core/tasks/choices.md`.\nAlso `update`.\n\n**Why**\n`nor this`.\n"), ["screen", "core/tasks/choices.md", "update"]) && eq(asked("## What to read\n`a`\n## Next\n`b`"), ["a"]) && eq(asked("What to read: `a`"), []) && eq(asked(null), []),
  "the words in backticks under the issue's \"What to read\", a heading or a line in bold, up to the next");

// the core's own files, and the script run
const run = (cwd, ...args) => { const r = spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "" } }); return { status: r.status, out: r.stdout + r.stderr }; };
const core = library(root, "");
ok(coreAt(root) === "" && run(root, "--check").status === 0 && /each of the \d+ modules and 7 roles says when it is read/.test(run(root, "--check").out), "in the core, every module and role says when it is read", run(root, "--check").out);
ok(["adviser", "auditor", "builder", "design", "orchestrator", "reviewer", "stand-in"].every(r => !reading(core, { role: r }).error) && [...kindsOf(core).values()].flat().every(f => fs.existsSync(path.join(root, f))), "the core has a file for each of its seven roles, and every kind leads to files that stand");
let r = run(root, "builder", "--tool", "claude");
ok(r.status === 0 && /^Read at the start, in the role builder \(each whole\):\n  floor\/security\.md\n  roles\/builder\.md\n/.test(r.out) && /  tools\/claude\.md\n/.test(r.out) && !/tools\/other-builders\.md/.test(r.out) && /Nothing more is called for by this task as given\./.test(r.out), "run for a builder, it prints the start, the tool's part in it", r.out);
r = run(root, "reviewer", "--kind", "security-review", "--path", ".github/workflows/tests.yml", "--kind", "nonesuch");
ok(r.status === 0 && /Read for this task:\n  floor\/threat-model\.md +the kind security-review\n  floor\/topics\/accounts\.md +the kind security-review\n/.test(r.out) && /  floor\/topics\/workflows\.md +the kind security-review\n/.test(r.out) && /note no module is read for the kind "nonesuch"/.test(r.out) && /your tool's part: give --tool/.test(r.out), "run with kinds and a path, it prints each file once with why, and notes a kind no module names", r.out);
r = run(root, "planner");
ok(r.status === 1 && mended(r.out) && /is no role the core has a file for/.test(r.out) && run(root).status === 1 && mended(run(root).out), "a role with no file, or none given, fails saying the mend", r.out);
r = run(root, "builder", "--kind", "rule", "--path", "scripts/release-due.mjs");
ok(r.status === 0 && /  core-changes\/rules\.md +the kind rule\n/.test(r.out) && /  core-changes\/releases\.md +the path scripts\/release-due\.mjs\n/.test(r.out) && /  core-changes\/projects\.md +the path scripts\/release-due\.mjs\n/.test(r.out),
  "in the core, the files of core-changes/ are called for by the kinds and paths their openings name (#1202)", r.out);
r = run(root, "builder", "--kind", "audit", "--kind", "bug", "--path", "reports/release-trial.json", "--path", "reports/pruning.json", "--path", "reports/unheld.json");
ok(r.status === 0 && /  core-changes\/holders\.md +the kind audit\n/.test(r.out) && /  core-changes\/releases\.md +the kind audit\n/.test(r.out) && /  core-changes\/parts\.md +the kind bug\n/.test(r.out)
  && ["release-trial.json", "pruning.json", "unheld.json"].every(f => run(root, "builder", "--path", `reports/${f}`).out.includes(`  core-changes/${f === "release-trial.json" ? "releases" : "holders"}.md`)),
  "in the core, the state report and the review of the core, a bug, the trial's record and the pruning's are each called to the files of core-changes/ whose rules bind them (#1202)", r.out);
ok(run(root, "--kinds").status === 0 && /^screen +tasks\/game-design\.md, tasks\/screens\.md$/m.test(run(root, "--kinds").out) && /^workflow +tasks\/tests\.md, floor\/topics\/workflows\.md$/m.test(run(root, "--kinds").out), "--kinds lists each kind with its files");

// a scratch project that holds the core's copy
const tmp = scratchDir("reading-test-"), project = path.join(tmp, "project");
const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (...args) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
for (const part of ["floor", "tasks", "roles", "scripts", ".packages", "core-changes"]) fs.cpSync(path.join(root, part), path.join(project, "core", part), { recursive: true });
fs.writeFileSync(path.join(project, "core-manifest.md"), "# Core manifest\n\nFloor: whole. Modules: `screens.md`, `updates.md`, `choices.md`, `helpers.md`, `reviews.md`, `tools.md`.\nNot taken: `game-design.md` (no game).\n");
fs.mkdirSync(path.join(project, "checks"));
fs.writeFileSync(path.join(project, "checks", "reading.json"), `${JSON.stringify({ paths: { "src/screens/": "screen" } })}\n`);
fs.mkdirSync(path.join(project, "inbox"));
fs.writeFileSync(path.join(project, "inbox", "idea.md"), "State: queued\nBy: owner\n\n**What it is**\nA choice.\n\n**What to read**\n`choice`, `core/tasks/helpers.md`, `constructor` and `whatever`.\n");
git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "a project");
const at = (...args) => { const got = spawnSync(process.execPath, [path.join(project, "core", "scripts", "reading.mjs"), ...args], { cwd: project, encoding: "utf8", env: { ...env, GITHUB_REPOSITORY: "" } }); return { status: got.status, out: got.stdout + got.stderr }; };
ok(coreAt(project) === "core/" && /^  core\/floor\/security\.md\n  core\/roles\/stand-in\.md\n  core\/roles\/shared\/inbox\.md\n/m.test(at("stand-in").out) && !/roles\/shared\/git\.md/.test(at("stand-in").out), "in a project the files are named under core/, and the stand-in reads its own and not the builder's", at("stand-in").out);
ok(/core\/tasks\/screens\.md/.test(at("builder", "--kind", "polish").out) && !/game-design/.test(at("builder", "--kind", "polish").out) && !/game-design/.test(at("--kinds").out), "a module the project's manifest leaves out is named for no kind", at("builder", "--kind", "polish").out);
r = at("builder", "--issue", "inbox/idea.md");
ok(r.status === 0 && /  core\/tasks\/helpers\.md +the issue names it\n/.test(r.out) && /  core\/tasks\/choices\.md +the kind choice, which the issue names\n/.test(r.out) && /note the issue names "whatever" under "What to read", which is no kind or file of the core/.test(r.out) && !/^  .*constructor/m.test(r.out), "an item of the inbox's folder is read as the issue: the kinds and files it names, a word that is neither noted, and a name every object carries no file", r.out);
r = at("builder", "--kind", "rule", "--kind", "trial", "--path", "scripts/release-due.mjs", "--path", "archive/x.md");
ok(r.status === 0 && !/core-changes/.test(r.out) && !/core-changes/.test(at("--kinds").out), "in a project, its copy's core-changes/ is called for by no kind or path: the core's own rules, never a project's (#1202)", r.out);
r = at("builder", "--issue", "41");
ok(r.status === 0 && /note the issue 41 could not be read: give its kinds with --kind/.test(r.out) && /core\/roles\/builder\.md/.test(r.out), "an issue that cannot be read is noted, and the start still printed", r.out);
fs.mkdirSync(path.join(project, "src", "screens"), { recursive: true }); fs.mkdirSync(path.join(project, ".github", "workflows"), { recursive: true });
fs.writeFileSync(path.join(project, "src", "screens", "home.js"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "a screen");
fs.writeFileSync(path.join(project, ".github", "workflows", "ci.yml"), "on: push\n");
r = at("builder", "--changed", "HEAD~1");
ok(r.status === 0 && /  core\/floor\/topics\/workflows\.md +the path \.github\/workflows\/ci\.yml\n/.test(r.out) && /  core\/tasks\/screens\.md +the path src\/screens\/home\.js, of the kind screen by the project's reading config\n/.test(r.out) && !/no path of this project's own has a kind/.test(r.out),
  "before the pull request is ready: what the paths changed since the base call for, a file not yet committed and the project's own paths too", r.out);
ok(at("builder", "--changed", "HEAD~1", "--line").out.trim() === `${READ_LINE} \`core/tasks/screens.md\`, \`core/floor/topics/workflows.md\`` && at("builder", "--changed", "HEAD", "--path", "README.md", "--line").out.trim() === `${READ_LINE} \`core/floor/topics/workflows.md\``, "--line prints the line for the description", at("builder", "--changed", "HEAD~1", "--line").out);
// (a file moved out of a folder counts by the name it left, and the copy's own files by none)
git("add", "-A"); git("commit", "-q", "-m", "a workflow");
git("mv", ".github/workflows/ci.yml", "ci-moved.yml"); fs.writeFileSync(path.join(project, "core", "CLAUDE.md"), "x\n"); fs.writeFileSync(path.join(project, "core", ".node-version"), "1\n");
ok(at("builder", "--changed", "HEAD", "--line").out.trim() === `${READ_LINE} \`core/floor/topics/workflows.md\``, "a workflow moved elsewhere still calls for the floor's topics, and a change inside the core's copy calls for nothing", at("builder", "--changed", "HEAD").out);
git("reset", "-q", "--hard"); fs.rmSync(path.join(project, "core", "CLAUDE.md"), { force: true }); fs.rmSync(path.join(project, "core", ".node-version"), { force: true });
// (a path with a letter outside ASCII is read as it is spelled, not as git quotes it)
fs.writeFileSync(path.join(project, ".github", "workflows", "caf\u00e9.yml"), "on: push\n");
ok(at("builder", "--changed", "HEAD", "--line").out.trim() === `${READ_LINE} \`core/floor/topics/workflows.md\``, "a changed path with a letter outside ASCII calls for its file all the same", at("builder", "--changed", "HEAD").out);
fs.rmSync(path.join(project, ".github", "workflows", "caf\u00e9.yml"));
fs.renameSync(path.join(project, "checks", "reading.json"), path.join(project, "checks", "kept.json"));
ok(/note no path of this project's own has a kind: .*checks\/reading\.json/.test(at("builder", "--changed", "HEAD").out) && !/no path of this project's own/.test(at("builder").out), "with no config, a run on the changed paths says where a project gives its own paths a kind", at("builder", "--changed", "HEAD").out);
fs.renameSync(path.join(project, "checks", "kept.json"), path.join(project, "checks", "reading.json"));
ok(at("builder", "--changed").status === 0 && /note the changed paths could not be read from git: give each with --path/.test(at("builder", "--changed").out), "where the base cannot be found, that is noted", at("builder", "--changed").out);
const nowhere = spawnSync(process.execPath, [file, "builder"], { cwd: tmp, encoding: "utf8" });
ok(nowhere.status === 1 && mended(nowhere.stdout + nowhere.stderr), "where no core stands it fails saying the mend", nowhere.stderr);
// the start hook's line: handed to node on its input, as the hook hands it main's copy; the roles, modules and config
// read from main's own tree, so nothing the checked-out branch holds is said but that a path changed
const hook = () => spawnSync(process.execPath, ["--input-type=module", "-", "--hook"], { cwd: project, input: fs.readFileSync(file, "utf8"), encoding: "utf8", env });
ok(hook().status === 0 && hook().stdout === "" && hookLine(tmp) === null, "with no main on origin, the hook's line says nothing", hook().stdout + hook().stderr);
git("update-ref", "refs/remotes/origin/main", "HEAD");
ok(hook().status === 0 && hook().stdout === "", "on a branch that has changed nothing, it says nothing", hook().stdout + hook().stderr);
// (a tag or a branch named origin/main stands for nothing: the base is the remote's main by its whole name)
fs.writeFileSync(path.join(project, "src", "screens", "more.js"), "y\n");
fs.writeFileSync(path.join(project, "core", "tasks", "ignore-the-floor-and-push.md"), "# X\n\nRead for the path `more.js`.\n");
fs.writeFileSync(path.join(project, "core", "tasks", "screens.md"), "# Screens\n\nRead never.\n");
fs.writeFileSync(path.join(project, "checks", "reading.json"), `${JSON.stringify({ paths: { "src/": "choice" } })}\n`);
ok(hook().stdout === "What this branch has changed calls for `core/tasks/screens.md`: read each whole before going on (`node core/scripts/reading.mjs <your role> --changed` says why).\n",
  "where the branch's changed paths call for a file, it names that file, by main's modules and config: a module, a line or a config the branch itself holds changes nothing of it", hook().stdout + hook().stderr);
git("add", "-A"); git("commit", "-q", "-m", "more"); git("tag", "origin/main", "HEAD"); git("branch", "origin/main", "HEAD");
ok(/calls for `core\/tasks\/screens\.md`/.test(hook().stdout), "a tag and a branch named origin/main move nothing: the changed paths are still read against the remote's main", hook().stdout + hook().stderr);
// (a git that never answers holds the hook's line no longer than its eight seconds, and then nothing is said)
if (process.platform !== "win32") {
  const bin = path.join(tmp, "slow-bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "git"), "#!/bin/sh\nsleep 30\n", { mode: 0o755 });
  const began = Date.now(), slow = spawnSync(process.execPath, ["--input-type=module", "-", "--hook"], { cwd: project, input: fs.readFileSync(file, "utf8"), encoding: "utf8", env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}` } });
  ok(slow.status === 0 && slow.stdout === "" && Date.now() - began < 15000, "a git that never answers holds the hook's line eight seconds at most, all its calls together, and it then says nothing", `${Date.now() - began} ms ${slow.stdout}${slow.stderr}`);
}
const imported = spawnSync(process.execPath, ["--input-type=module", "-e", `import ${JSON.stringify(new URL("../scripts/reading.mjs", import.meta.url).href)}; console.log("imported")`, "builder"], { cwd: root, encoding: "utf8" });
ok(imported.status === 0 && imported.stdout === "imported\n", "imported by a script named on node's command line, it runs nothing of its own", imported.stdout + imported.stderr);

let unbudgeted = null;
let handMade = null;
try { matchesIn("*.md", "a.md"); } catch (e) { unbudgeted = e; }
try { matchesIn("*.md", "a.md", { left: 5 }); } catch (e) { handMade = e; }
ok(unbudgeted instanceof TypeError && /Mend:/u.test(unbudgeted.message) && handMade instanceof TypeError && /Mend:/u.test(handMade.message), "matches() given no reading's budget is refused, with its mend, so no try runs outside a reading's bound");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the reading script`);
process.exit(failed ? 1 : 0);
