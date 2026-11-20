// Tests the check that the core takes each of its own modules or gives its reason (own-modules.mjs), on small texts of
// AGENTS.md made here, and then on the core's own: its tests workflow runs this on every pull request here. Reads only;
// Node's own modules.
//
//   node tests/own-modules-test.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { faults, report, SECTION } from "../scripts/own-modules.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}`); } };
const agents = body => `# x\n\nA builder elsewhere: \`tasks/c.md\`.\n\n${SECTION}\n\n${body}\n\n## Next\n\n\`tasks/d.md\` is named here.\n`;
const MODULES = ["tasks/a.md", "tasks/b.md", "tasks/c.md"];
const has = (list, part) => list.some(f => f.includes(part));

ok(faults(agents("@tasks/a.md\n\nRead when needed: `tasks/b.md` and `tasks/c.md`."), MODULES).length === 0, "each module named in the section passes");
ok(faults(agents("@tasks/a.md\n\nNot taken, each for its reason:\n\n- `tasks/b.md`: it governs games.\n- `tasks/c.md`: no\n  screen here."), MODULES).length === 0, "a module not taken, with its reason, a reason going on in an indented line, passes");
const crlf = faults(agents("@tasks/a.md\n\nRead when needed: `tasks/b.md` and `tasks/c.md`.").replace(/\n/gu, "\r\n"), MODULES);
ok(crlf.length === 0, `line ends of Windows are read as Unix's: ${crlf.join("; ")}`);

let f = faults(agents("@tasks/a.md\n\nRead when needed: `tasks/b.md`."), MODULES);
ok(f.length === 1 && has(f, "tasks/c.md is neither taken nor given a reason"), "a module named only outside the section fails");
f = faults(agents("@tasks/a.md, `tasks/b.md`, `tasks/c.md` and `tools/a.md`."), [...MODULES, "tools/a.md"]);
ok(f.length === 1 && has(f, "a.md stands in 2 folders of the modules (tasks/a.md, tools/a.md)") && has(f, "Mend:"), "a module's name that stands in two folders fails, since a manifest names it by its file's name alone");
f = faults(agents("@tasks/a.md and `tasks/b.md`; `tasks/c.md`, `tasks/d.md`."), MODULES);
ok(f.length === 1 && has(f, "names tasks/d.md, which is no module"), "a name that is no module fails");
f = faults(agents("@tasks/a.md and `tasks/b.md`.\n\nNot taken:\n\n- `tasks/c.md`:"), MODULES);
ok(f.length === 1 && has(f, "tasks/c.md has no reason"), "a module not taken with no reason fails");
f = faults(agents("@tasks/a.md and `tasks/b.md`.\n\nNot taken:\n\n- `tasks/c.md` since no screen"), MODULES);
ok(f.length === 2 && has(f, "is not in the form") && has(f, "tasks/c.md is neither taken"), "a bullet not in its form fails, and its module is not taken");
f = faults(agents("@tasks/a.md and `tasks/b.md` and `tasks/c.md`.\n\nNot taken:\n\n- `tasks/c.md`: no screen."), MODULES);
ok(f.length === 1 && has(f, "both taken and listed as not taken"), "a module both taken and not taken fails");
f = faults(agents("@tasks/a.md and `tasks/b.md`.\n\nNot taken:\n\n- `tasks/c.md`: one.\n- `tasks/c.md`: two."), MODULES);
ok(f.length === 1 && has(f, "listed twice"), "a module listed twice as not taken fails");
f = faults(agents("@tasks/a.md\n\nNot taken:\n\n- `tasks/b.md`: it governs games, unlike `tasks/c.md`."), MODULES);
ok(f.length === 1 && has(f, "tasks/c.md is neither taken"), "a module named only inside another's reason is not taken");
f = faults("# x\n\n`tasks/a.md`, `tasks/b.md`, `tasks/c.md`\n", MODULES);
ok(f.length === 1 && has(f, "has no section"), "an AGENTS.md without the section fails");

// each fault says its mend, as the script prints it
const every = [
  faults(agents("@tasks/a.md\n\nNot taken:\n\n- `tasks/b.md`:\n- `tasks/b.md`: x\n- c.md since\n\n`tasks/d.md` and `tasks/b.md`"), MODULES),
  faults("# x\n", MODULES),
].flat();
ok(every.length >= 6 && mended(every.map(f => `FAIL: ${f}`).join("\n")), `each fault says its mend: ${every.join("; ")}`);

// the core's own AGENTS.md and modules, and where they cannot be read
const own = report();
ok(own.status === 0 && own.err.length === 0 && /^each of the \d+ modules is taken here/u.test(own.out.join("\n")), `the core's own AGENTS.md: ${own.err.join("; ")}`);
const missing = report(path.join(fileURLToPath(new URL("..", import.meta.url)), "no-such-folder"));
ok(missing.status === 1 && missing.out.length === 0 && mended(missing.err.join("\n")) && missing.err[0].includes("could not be read"), "where AGENTS.md cannot be read it fails, saying its mend");

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
