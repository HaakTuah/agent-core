// Tests that the core's address stands in one place (core-address.mjs): no other script holds it, the one workflow that
// must (core.yml, which may not read it from the copy it checks) holds the same, and each place where GitHub needs it
// written out follows it: the *owner's account* in AGENTS.md, the issue templates' assignee, and each link or call to
// this repository in the README and the templates. Run by GitHub in the core's own repository, it also fails where
// that repository is not the one named: after the account or the repository is renamed, the address is changed once,
// and this test names what else must follow. Reads only; Node's own modules.
//
//   node scripts/core-address-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, CORE_SOURCE, OWNER } from "./core-address.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const list = dir => fs.readdirSync(path.join(root, dir)).sort().map(f => `${dir}/${f}`);
let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}`); } };
const account = OWNER.toLowerCase(), repo = CORE.slice(OWNER.length + 1);

ok(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/u.test(CORE), "the address is one account and one repository");
ok(new RegExp(`^${CORE_SOURCE}$`, "u").test(CORE) && new RegExp(`^${CORE_SOURCE}$`).test(CORE), "its pattern's source matches it, with the u flag and without");

// one place: no other script, and no workflow but core.yml's one line
for (const f of list("scripts")) {
  if (f !== "scripts/core-address.mjs") ok(!read(f).toLowerCase().includes(account), `${f} names the account: it reads the address from core-address.mjs`);
}
for (const f of list(".github/workflows")) {
  const lines = read(f).split(/\r?\n/u).filter(l => l.toLowerCase().includes(account));
  if (f === ".github/workflows/core.yml") ok(lines.length === 1 && lines[0] === `      CORE: ${CORE}`, `${f} holds the address once, as its CORE, and the same as core-address.mjs`);
  else ok(!lines.length, `${f} names the account: only core.yml holds the address, once`);
}

// where GitHub needs it written out: each follows the one place
const templates = list(".github/ISSUE_TEMPLATE");
const slot = read("AGENTS.md").match(/\*owner's account\*: `([^`]+)`/u)?.[1];
ok(slot === OWNER, `AGENTS.md fills the *owner's account* with ${slot}, core-address.mjs says ${OWNER}`);
for (const f of templates.filter(f => f.endsWith(".md"))) {
  const assignee = read(f).match(/^assignees: (.+?)\r?$/mu)?.[1];
  ok(assignee === OWNER, `${f} assigns to ${assignee}, core-address.mjs says ${OWNER}`);
}
const named = new RegExp(`([A-Za-z0-9-]+)/${repo.replace(/[.]/gu, "\\.")}(?![A-Za-z0-9_-])`, "gu");
for (const f of ["README.md", ...templates]) {
  const others = [...read(f).matchAll(named)].map(m => m[1]).filter(o => o !== OWNER && o !== "com");
  ok(!others.length, `${f} writes this repository's address under ${[...new Set(others)].join(", ")}, core-address.mjs says ${CORE}`);
}
ok([...read("README.md").matchAll(named)].length > 0, "the README writes the address a project's manifest and calls take");

// in the core's own repository on GitHub: the address is this repository's
const here = process.env.GITHUB_REPOSITORY;
if (here) ok(here.toLowerCase() === CORE.toLowerCase(), `this repository is ${here} and core-address.mjs says ${CORE}: a core that moved changes it there and in core.yml's CORE (a fork kept as a copy fails here alone)`);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core's address`);
process.exit(failed ? 1 : 0);
