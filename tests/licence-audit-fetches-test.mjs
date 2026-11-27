// Checks an audit entry's "fetches" in the licence scan (scripts/licence-audit-fetches.mjs, read by licence-scan.mjs;
// #1495): the fetches it names in a file pass one by one, each line as the scan prints it, any other fetch there is
// read as in any other file, a line that names no fetch there and a map written wrong fail saying their mend, and a
// download it names is held to its pin, an entry naming one of a file that reaches users ships, and a fetch the base
// named and the head does not fails; and the core's own entry for its repository names the clones of check.mjs and
// scratch-core.mjs alone. Staged in the project licence-scan-stage.mjs writes. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//   node tests/licence-audit-fetches-test.mjs
import { append, asOutput, done, entry, json, ok, run, write } from "../scripts/licence-scan-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import fs from "node:fs";
import { pinFault, unauditedIn } from "../scripts/licence-scan.mjs";
import { KIT_CONFIGS } from "../scripts/check-configs.mjs";
import { packagesHeld } from "../scripts/step-checks-packages.mjs";

const both = (...changes) => (dir) => { for (const change of changes) change(dir); };
const CLONES = 'import { execFileSync } from "node:child_process";\nconst git = (...args) => execFileSync("git", args);\ngit("clone", "-q", from, to);\n';
const LINE = 'git("clone", "-q", from, to);';
const named = (fetches, extra = {}) => both(write("scripts/copy.mjs", CLONES), entry({ name: "Moss tree", kind: "tool", licence: "MIT", fetches, ...extra }));

// The fetches it names pass, one by one; any other fails.
{
  let f = run(named({ "scripts/copy.mjs": [LINE] }));
  ok(f.length === 0, "passes the clone an entry's \"fetches\" names", f.join("\n"));
  f = run(both(named({ "scripts/copy.mjs": [LINE] }), append("scripts/copy.mjs", 'git("clone", "-q", other, there);\n')));
  ok(f.length === 1 && f[0].startsWith('scripts/copy.mjs: git("clone", "-q", other, there);') && f[0].includes('to the "fetches" for scripts/copy.mjs') && mended(asOutput(f)), "fails, saying the mend, another clone in the file the entry names", f.join("\n"));
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

// An entry that names a fetch of a file that reaches users ships, as one whose "files" covers it does.
{
  const f = run(both(write("site/copy.js", CLONES), entry({ name: "Moss tree", kind: "tool", licence: "MIT", fetches: { "site/copy.js": [LINE] } })));
  ok(f.some((m) => m.includes("Moss tree: it audits a fetch of site/copy.js, which reaches users, so it ships")) && mended(asOutput(f)), "fails, saying the mend, an entry that names a fetch of a file that reaches users and does not ship", f.join("\n") || "(it passed)");
}

// A download it names is held to its pin, as one in a file of an entry's "files" is: by the scan, where a pull request
// adds it, and by the sync's step.
{
  const GET = "curl -fsSL https://moss.example/moss.tgz -o moss.tgz\n", moss = (fetches) => ({ name: "Moss", kind: "tool", licence: "MIT", fetches });
  const fault = pinFault([moss({ "get.sh": [GET.trim()] })], "audit.json", "get.sh", GET);
  const other = pinFault([moss({ "else.sh": [GET.trim()] })], "audit.json", "get.sh", GET);
  ok(/names no version/u.test(fault?.what ?? "") && other === null, "holds a download it names to its pin, and one it names in another file to none", JSON.stringify({ fault, other }));
  const f = run(both(write("scripts/get.sh", GET), entry(moss({ "scripts/get.sh": [GET.trim()] }))), () => {});
  ok(f.some((m) => /names no version/u.test(m)) && mended(asOutput(f)), "fails, saying the mend, a pull request that adds a download it names unpinned", f.join("\n") || "(it passed)");
  const files = { [KIT_CONFIGS.licences]: JSON.stringify({ ships: [], audit: "audit.json", scan: { served: [], skip: [] } }), "audit.json": JSON.stringify({ entries: [moss({ "get.sh": [GET.trim()] })] }), "get.sh": GET };
  const said = packagesHeld({ files: Object.keys(files), workflows: {}, read: (q) => files[q] ?? null });
  ok(/`get\.sh` downloads what may be a program, and Moss, in audit\.json, names no version/u.test(said ?? ""), "the sync's step asks the pin of a download it names", said ?? "(it asked none)");
}

// A fetch the base's audit named, which the head's no longer names, fails: the base allows what it held unaudited alone.
{
  const f = run(json("audit.json", (j) => { j.entries = j.entries.filter((e) => e.name !== "Moss tree"); }), named({ "scripts/copy.mjs": [LINE] }));
  ok(f.length === 1 && f[0].startsWith(`scripts/copy.mjs: ${LINE} fetches what no entry audits`) && mended(asOutput(f)), "fails, saying the mend, a fetch the base's audit named and the head's does not", f.join("\n") || "(it passed)");
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
