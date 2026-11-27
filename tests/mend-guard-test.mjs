// Tests the guard each check's entry runs through and the watch on the hostile tests' runs (scripts/mend.mjs,
// scripts/check-runs.mjs, scripts/check-runs-read.mjs; core-changes/projects.md, "A check that fails says the mend"; #1140): an error a check did not catch fails
// with its mend, a mend that names a script to run names one there from the folder the check ran in, and a run that
// fails with no failure line, or one that says no mend, is a fault. tests/mend-test.mjs holds that each check starts
// through the guard and each hostile test through the watch. Node's own modules.
//
//   node tests/mend-guard-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { guard, missing, mended, unknown } from "../scripts/mend.mjs";
import { faultsOf, optionsOf, scriptOf } from "../scripts/check-runs-read.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
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
  const hostile = unknown("scripts/a.mjs", new Error("bad https://u:p@h.invalid/x\n::warning::x")), passed = unknown("scripts/a.mjs", new Error("FAIL: c. Mend: do it now.\n::error::y"));
  ok(mended(hostile) && mended(passed) && !/u:p@/u.test(hostile) && !/^\s*::/mu.test(hostile) && !/^\s*::/mu.test(passed),
    "an error's words are printed as the log reads text alone: no address's sign-in, and no workflow command at a line's start");
  // (the events Node raises for an error nothing caught, raised here, the process's exit and its stderr stood in for)
  const events = ["uncaughtException", "unhandledRejection"], before = events.map(e => process.listeners(e));
  ok(guard(new URL("../scripts/not-started.mjs", import.meta.url).href) === false && events.every((e, i) => process.listenerCount(e) === before[i].length),
    "a check imported by another, not started, runs no entry and installs no guard");
  const file = fileURLToPath(new URL("../scripts/c.mjs", import.meta.url)), [argv, exit, write] = [process.argv[1], process.exit, process.stderr.write];
  const said = [], codes = [];
  let installed = false;
  try {
    process.argv[1] = file;
    installed = guard(pathToFileURL(file).href);
    process.exit = code => { codes.push(code); };
    process.stderr.write = text => { said.push(String(text)); return true; };
    process.emit("uncaughtException", new RangeError("Maximum call stack size exceeded"));
    process.emit("unhandledRejection", new Error("fatal: pathspec ':(top)../x' is outside repository"), Promise.resolve());
  } finally {
    [process.argv[1], process.exit, process.stderr.write] = [argv, exit, write];
    events.forEach((e, i) => process.listeners(e).filter(l => !before[i].includes(l)).forEach(l => process.off(e, l)));
  }
  ok(installed && codes.join() === "1,1" && said.length === 2 && said.every(t => mended(t) && /^FAIL: (?:.*\/)?scripts\/c\.mjs stopped on an error it does not know: /u.test(t)),
    "a check whose entry runs through guard() fails with its mend and exit code 1 on an error thrown or rejected that it did not catch, not Node's own trace");
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
{
  let refused = "";
  try { optionsOf({ shell: true }); } catch (e) { refused = e.message; }
  const picked = optionsOf({ cwd: "x", encoding: "utf8" });
  ok(/no option shell/u.test(refused) && picked.shell === false && picked.cwd === "x" && Object.keys(picked).length === 3,
    "a run asks no shell: an option the watch does not name is refused, and the options it takes are those it names, with no shell");
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
