// Tests the check that the core takes each of its own modules or gives its reason (own-modules.mjs), on small texts of
// AGENTS.md made here, and then on the core's own: its tests workflow runs this on every pull request here. Reads only;
// Node's own modules.
//
//   node scripts/own-modules-test.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { faults, SECTION } from "./own-modules.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}`); } };
const agents = body => `# x\n\nA builder elsewhere: \`modules/c.md\`.\n\n${SECTION}\n\n${body}\n\n## Next\n\n\`modules/d.md\` is named here.\n`;
const MODULES = ["a.md", "b.md", "c.md"];
const has = (list, part) => list.some(f => f.includes(part));

ok(faults(agents("@modules/a.md\n\nRead when needed: `modules/b.md` and `modules/c.md`."), MODULES).length === 0, "each module named in the section passes");
ok(faults(agents("@modules/a.md\n\nNot taken, each for its reason:\n\n- `modules/b.md`: it governs games.\n- `modules/c.md`: no\n  screen here."), MODULES).length === 0, "a module not taken, with its reason, a reason going on in an indented line, passes");
const crlf = faults(agents("@modules/a.md\n\nRead when needed: `modules/b.md` and `modules/c.md`.").replace(/\n/gu, "\r\n"), MODULES);
ok(crlf.length === 0, `line ends of Windows are read as Unix's: ${crlf.join("; ")}`);

let f = faults(agents("@modules/a.md\n\nRead when needed: `modules/b.md`."), MODULES);
ok(f.length === 1 && has(f, "modules/c.md is neither taken nor given a reason"), "a module named only outside the section fails");
f = faults(agents("@modules/a.md and `modules/b.md`; `modules/c.md`, `modules/d.md`."), MODULES);
ok(f.length === 1 && has(f, "names modules/d.md, which is no module"), "a name that is no module fails");
f = faults(agents("@modules/a.md and `modules/b.md`.\n\nNot taken:\n\n- `modules/c.md`:"), MODULES);
ok(f.length === 1 && has(f, "modules/c.md has no reason"), "a module not taken with no reason fails");
f = faults(agents("@modules/a.md and `modules/b.md`.\n\nNot taken:\n\n- `modules/c.md` since no screen"), MODULES);
ok(f.length === 2 && has(f, "is not in the form") && has(f, "modules/c.md is neither taken"), "a bullet not in its form fails, and its module is not taken");
f = faults(agents("@modules/a.md and `modules/b.md` and `modules/c.md`.\n\nNot taken:\n\n- `modules/c.md`: no screen."), MODULES);
ok(f.length === 1 && has(f, "both taken and listed as not taken"), "a module both taken and not taken fails");
f = faults(agents("@modules/a.md and `modules/b.md`.\n\nNot taken:\n\n- `modules/c.md`: one.\n- `modules/c.md`: two."), MODULES);
ok(f.length === 1 && has(f, "listed twice"), "a module listed twice as not taken fails");
f = faults(agents("@modules/a.md\n\nNot taken:\n\n- `modules/b.md`: it governs games, unlike `modules/c.md`."), MODULES);
ok(f.length === 1 && has(f, "modules/c.md is neither taken"), "a module named only inside another's reason is not taken");
f = faults("# x\n\n`modules/a.md`, `modules/b.md`, `modules/c.md`\n", MODULES);
ok(f.length === 1 && has(f, "has no section"), "an AGENTS.md without the section fails");

// each fault says its mend, as the script prints it
const every = [
  faults(agents("@modules/a.md\n\nNot taken:\n\n- `modules/b.md`:\n- `modules/b.md`: x\n- c.md since\n\n`modules/d.md` and `modules/b.md`"), MODULES),
  faults("# x\n", MODULES),
].flat();
ok(every.length >= 6 && mended(every.map(f => `FAIL: ${f}`).join("\n")), `each fault says its mend: ${every.join("; ")}`);

// the core's own AGENTS.md and modules
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("./own-modules.mjs", import.meta.url))], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  ok(true, "");
} catch (e) {
  ok(false, `the core's own AGENTS.md: ${e.stderr}`);
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
