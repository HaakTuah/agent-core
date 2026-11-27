// Checks an audit entry's "fetches" in the licence scan (scripts/licence-audit-fetches.mjs, read by licence-scan.mjs;
// #1495): the fetches it names in a file pass one by one, each line as the scan prints it, any other fetch there is
// read as in any other file, a line that names no fetch there and a map written wrong fail saying their mend, and a
// download it names is held to its pin; and the core's own entry for its repository names the clones of check.mjs and
// scratch-core.mjs alone. Staged in the project licence-scan-stage.mjs writes. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//   node tests/licence-audit-fetches-test.mjs
import { append, asOutput, done, entry, ok, run, write } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import fs from "node:fs";
import { pinFault, unauditedIn } from "../scripts/licence-scan.mjs";

const both = (...changes) => (dir) => { for (const change of changes) change(dir); };
const CLONES = 'import { execFileSync } from "node:child_process";\nconst git = (...args) => execFileSync("git", args);\ngit("clone", "-q", from, to);\n';
const LINE = 'git("clone", "-q", from, to);';
const named = (fetches, extra = {}) => both(write("scripts/copy.mjs", CLONES), entry({ name: "Moss tree", kind: "tool", licence: "MIT", fetches, ...extra }));

// The fetches it names pass, one by one; any other fails.
{
  let f = run(named({ "scripts/copy.mjs": [LINE] }));
  ok(f.length === 0, "passes the clone an entry's \"fetches\" names", f.join("\n"));
  f = run(both(named({ "scripts/copy.mjs": [LINE] }), append("scripts/copy.mjs", 'git("clone", "-q", other, there);\n')));
  ok(f.length === 1 && f[0].startsWith('scripts/copy.mjs: git("clone", "-q", other, there);') && mended(asOutput(f)), "fails, saying the mend, another clone in the file the entry names", f.join("\n"));
  f = run(both(named({ "scripts/copy.mjs": [LINE] }), append("scripts/copy.mjs", `${LINE}\n`)));
  ok(f.length === 1 && /fetches what no entry/u.test(f[0]), "fails the same clone a second time, each line it names standing for one", f.join("\n"));
  f = run(named({ "scripts/copy.mjs": [LINE, 'git("clone", "-q", gone, away);'] }));
  ok(f.length === 1 && /"fetches" names, for scripts\/copy\.mjs, .*which is no fetch/u.test(f[0]) && mended(asOutput(f)), "fails, saying the mend, a line it names that is no fetch of the file", f.join("\n"));
}

// A map written wrong fails, saying its mend.
for (const [what, fetches, extra, said] of [
  ["a list in place of a map", [LINE], {}, /"fetches" is not a map/u],
  ["a file with no line", { "scripts/copy.mjs": [] }, {}, /"fetches" is not a map/u],
  ["a file that is not tracked", { "scripts/copy.mjs": [LINE], "scripts/none.mjs": [LINE] }, {}, /"fetches" names scripts\/none\.mjs, no tracked file/u],
  ["the owner's own work", { "scripts/copy.mjs": [LINE] }, { kind: "own" }, /the owner's own work audits no fetch/u],
]) { const f = run(named(fetches, extra)); ok(f.some((m) => said.test(m)) && mended(asOutput(f)), `fails, saying the mend, "fetches" written as ${what}`, f.join("\n") || "(it passed)"); }

// A download it names is held to its pin, as one in a file of an entry's "files" is.
{
  const GET = "curl -fsSL https://moss.example/moss.tgz -o moss.tgz\n";
  const fault = pinFault([{ name: "Moss", kind: "tool", licence: "MIT", fetches: { "get.sh": [GET.trim()] } }], "audit.json", "get.sh", GET);
  const other = pinFault([{ name: "Moss", kind: "tool", licence: "MIT", fetches: { "else.sh": [GET.trim()] } }], "audit.json", "get.sh", GET);
  ok(/names no version/u.test(fault?.what ?? "") && other === null, "holds a download it names to its pin, and one it names in another file to none", JSON.stringify({ fault, other }));
}

// The core's own entry for its repository names the clones of check.mjs and scratch-core.mjs alone: as they stand, the
// step's reading finds no other there, and a clone added to either is found.
{
  const audit = JSON.parse(fs.readFileSync(new URL("../.github/licences-audit.json", import.meta.url), "utf8")).entries;
  const settings = { served: [], skip: [] }, added = '\ngit(tmp, "clone", "-q", from, there);\n';
  for (const f of ["scripts/check.mjs", "scripts/scratch-core.mjs"]) {
    const text = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    const now = unauditedIn(settings, audit, ".github/licences-audit.json", f, text), more = unauditedIn(settings, audit, ".github/licences-audit.json", f, text + added);
    ok(now.length === 0 && more.length === 1 && more[0] === 'git(tmp, "clone", "-q", from, there);', `the core's audit names each fetch of ${f}, and one added there is found`, JSON.stringify({ now, more }));
  }
}

done();
