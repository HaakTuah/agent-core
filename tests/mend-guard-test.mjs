// Tests the guard each check's entry runs through and the watch on the hostile tests' runs (scripts/mend.mjs,
// scripts/check-runs.mjs; AGENTS.md, "A check that fails says the mend"; #1140): an error a check did not catch fails
// with its mend, a mend that names a script to run names one there from the folder the check ran in, and a run that
// fails with no failure line, or one that says no mend, is a fault. tests/mend-test.mjs holds that each check starts
// through the guard and each hostile test through the watch. Node's own modules.
//
//   node tests/mend-guard-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { missing, mended, unknown } from "../scripts/mend.mjs";
import { faultsOf, scriptOf } from "../scripts/check-runs.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
// Node run in a folder, on its scripts/c.mjs where no arguments are given: its exit code and its output as one text
const execFileSyncOr = (at, args = ["scripts/c.mjs"]) => {
  try { return { status: 0, out: execFileSync(process.execPath, args, { cwd: at, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { status: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
};

// a mend that names a script to run names one that is there from the folder the check ran in (#1140, point 3)
{
  const at = scratchDir("mend-paths-");
  fs.mkdirSync(path.join(at, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(at, "scripts/x.mjs"), "");
  const here = "FAIL: a. Mend: run node scripts/x.mjs, then commit.", gone = "FAIL: a. Mend: run `node core/scripts/x.mjs --write`.";
  ok(mended(here, { from: at }) && !mended(gone, { from: at }) && mended(gone) && missing(gone, at).length === 1 && /core\/scripts\/x\.mjs/u.test(missing(gone, at)[0]),
    "a mend naming a script there from the folder it ran in is mended; one naming a path not there is not, where the folder is given");
  ok(mended("FAIL: a. Mend: run `if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs; fi`.", { from: at })
    && mended("FAIL: a. Mend: run node <the core's path>scripts/x.mjs, or node ${dir}scripts/y.mjs.", { from: at })
    && mended("FAIL: a. Mend: run node scripts/x.mjs.", { from: at }) && mended("note node core/scripts/gone.mjs\nFAIL: a. Mend: do it here.", { from: at }),
    "a path the line tests for first, a placeholder, a sentence's full stop and a line that is no failure are not read as a path not there");
  fs.rmSync(at, { recursive: true, force: true });
}

// an error a check did not catch fails with its mend, through guard() (#1140, point 1)
{
  ok(mended(unknown("scripts/a.mjs", new RangeError("Invalid string length"))) && /^FAIL: scripts\/a\.mjs stopped on an error it does not know: Invalid string length\. Mend: run it again; if it fails the same way, file a bug with this line\.$/mu.test(unknown("scripts/a.mjs", new RangeError("Invalid string length")))
    && mended(unknown("scripts/a.mjs", "a string thrown\nits second line")) && mended(unknown("scripts/a.mjs", new Error(""))),
    "an error not caught is worded as a failure with its mend, of any kind and with any message");
  ok(unknown("scripts/a.mjs", new Error("FAIL: b. Mend: do this here.")) === "FAIL: b. Mend: do this here.", "an error whose message is a mended failure is said as it stands");
  const at = scratchDir("mend-guard-");
  fs.mkdirSync(path.join(at, "scripts"), { recursive: true });
  const mendUrl = new URL("../scripts/mend.mjs", import.meta.url).href;
  const ways = { thrown: 'throw new RangeError("Maximum call stack size exceeded");', rejected: 'await Promise.reject(new Error("fatal: pathspec \':(top)../x\' is outside repository"));', later: 'setTimeout(() => { JSON.parse("{"); });' };
  for (const [way, body] of Object.entries(ways)) {
    fs.writeFileSync(path.join(at, "scripts/c.mjs"), `import { guard } from ${JSON.stringify(mendUrl)};\nif (guard(import.meta.url)) { ${body} }\n`);
    const r = execFileSyncOr(at);
    ok(r.status === 1 && mended(r.out) && /FAIL: scripts\/c\.mjs stopped on an error it does not know: /u.test(r.out) && !/^\S.*\n\s*\^\s*$/mu.test(r.out),
      `a check whose entry runs through guard() fails with its mend on an error ${way} it did not catch, not Node's own trace`);
  }
  fs.writeFileSync(path.join(at, "scripts/c.mjs"), `import { guard } from ${JSON.stringify(mendUrl)};\nif (guard(import.meta.url)) { throw new RangeError("x"); }\n`);
  const bare = execFileSyncOr(at, ["--input-type=module", "-e", `import ${JSON.stringify(new URL("scripts/c.mjs", `file://${at}/`).href)}; console.log("imported");`]);
  ok(bare.status === 0 && /imported/u.test(bare.out), "a check imported by another, not started, runs no entry and installs no guard");
  fs.rmSync(at, { recursive: true, force: true });
}

// the runs the hostile tests make, read (#1140, point 2)
ok(scriptOf(process.execPath, ["core/scripts/a.mjs", "--x"]) === "core/scripts/a.mjs" && scriptOf(process.execPath, ["--no-warnings", "/p/scripts/a.mjs"]) === "/p/scripts/a.mjs"
  && scriptOf("git", ["scripts/a.mjs"]) === "" && scriptOf(process.execPath, ["--input-type=module", "-e", "x"]) === "" && scriptOf(process.execPath, ["tests/a-test.mjs"]) === ""
  && scriptOf(process.execPath, ["scripts/pure-sync.mjs"]) === "",
  "a run read is Node's of a script under scripts/; another program's, code evaluated, a test and a proof's are not");
{
  const at = scratchDir("mend-runs-");
  ok(faultsOf(0, "", at).length === 0 && faultsOf(null, "", at).length === 0 && faultsOf(1, "FAIL: a. Mend: do it here.", at).length === 0
    && /no failure line/u.test(faultsOf(1, "Error: x\n    at y", at).join()) && /says no mend/u.test(faultsOf(2, "FAIL: a", at).join())
    && /not there/u.test(faultsOf(1, "FAIL: a. Mend: run node core/scripts/z.mjs now.", at).join()),
    "a run that fails with no failure line, one unmended or one naming a script not there is a fault; one that passed, was killed or says its mend is none");
  fs.rmSync(at, { recursive: true, force: true });
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
