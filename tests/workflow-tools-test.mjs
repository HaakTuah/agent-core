// Checks the glue that runs zizmor and actionlint (scripts/workflow-tools.mjs; #580, #1001): its findings read from each
// tool's output, compared with the base's, and `run()` with fake tools. Run by the core's tests workflow
// (.github/workflows/tests.yml). Split out of tests/workflows-test.mjs (#1017).
//
//   node tests/workflow-tools-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { baseFolder, twiceUnfetched } from "../scripts/workflows.mjs";
import { LONGEST } from "../scripts/yaml-keys.mjs";
import { actionlintFindings, compared, isAction, isWorkflow, run, zizmorFindings } from "../scripts/workflow-tools.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || !detail ? "" : `\n     ${String(detail).slice(0, 1200)}`}`); if (!cond) failed++; };

// (the tools' findings against the base's (workflow-tools.mjs; #580): of each kind in a file, as many as the base held are
// noted, the rest fail, a line moved is no new finding, and with no base each is noted)
const finding = (file, line, rule = "syntax-check", said = 'key "x" is duplicated') => ({ file, line, tool: "actionlint", rule, said, url: "u" });
const vsBase = compared([finding("a.yml", 4), finding("a.yml", 5), finding("b.yml", 2), finding("a.yml", 9, "expression", "y")], [finding("a.yml", 3)]);
ok(vsBase.notes.length === 1 && /^note a\.yml:4: actionlint's syntax-check: key "x" is duplicated, as on the base\. Mend: /u.test(vsBase.notes[0]) && vsBase.fails.length === 3 && /^FAIL a\.yml:5: /u.test(vsBase.fails[0]) && /^FAIL b\.yml:2: /u.test(vsBase.fails[1]) && vsBase.fails.every(mended),
  "against a base, as many of a kind in a file as the base held are noted, its line aside, and the rest fail, each with its mend; a file or a kind the base lacked fails", [...vsBase.fails, ...vsBase.notes].join("\n"));
// (actionlint writes where a key was first given into what it says: a finding moved down the file, its first one too,
// is the same finding)
const dupKey = (line, first) => finding("a.yml", line, "syntax-check", `key "push" is duplicated in "on" section. previously defined at line:${first},col:3`);
const moved = compared([dupKey(5, 4)], [dupKey(3, 2)]), another = compared([dupKey(5, 4), dupKey(6, 4)], [dupKey(3, 2)]);
ok(moved.fails.length === 0 && moved.notes.length === 1 && /previously defined at line:4,col:3, as on the base\./u.test(moved.notes[0]) && another.fails.length === 1,
  "a key given twice moved down the file, the place actionlint names for its first one with it, is noted, and said as the head says it; a second such finding fails", [...moved.fails, ...moved.notes, ...another.fails].join("\n"));
// (zizmor's severity and the text it flags are of the kind: a finding swapped for another of the same words is new)
const swapped = compared([{ ...finding("a.yml", 4, "template-injection", "code injection"), what: "High\0${{ github.event.issue.title }}" }], [{ ...finding("a.yml", 4, "template-injection", "code injection"), what: "Low\0${{ github.event.issue.number }}" }]);
const kept = compared([{ ...finding("a.yml", 9, "template-injection", "code injection"), what: "High\0x" }], [{ ...finding("a.yml", 4, "template-injection", "code injection"), what: "High\0x" }]);
ok(swapped.fails.length === 1 && kept.fails.length === 0, "a zizmor finding the base held, swapped for one of the same words on other text or at another severity, fails; the same one moved is noted", [...swapped.fails, ...kept.fails].join("\n"));
const noBase = compared([finding("a.yml", 4)], null), fresh = compared([finding("a.yml", 4)], []);
ok(noBase.fails.length === 0 && noBase.notes.length === 1 && !noBase.notes[0].includes("base") && fresh.fails.length === 1, "with no base each is noted and none fails, and where nothing stood before (the core's own) each fails");
const zz = zizmorFindings(JSON.stringify([{ ident: "template-injection", desc: "code injection via template expansion", url: "https://docs.zizmor.sh/audits/#template-injection", ignored: false, determinations: { severity: "High" }, locations: [{ symbolic: { kind: "Related", annotation: "x" }, concrete: { location: { start_point: { row: 2 } } } }, { symbolic: { kind: "Primary", annotation: "may expand into attacker-controllable code" }, concrete: { location: { start_point: { row: 6 } }, feature: "${{ github.event.issue.title }}" } }] }, { ident: "artipacked", desc: "d", ignored: true, locations: [] }]), "w.yml");
const al = actionlintFindings(JSON.stringify([{ kind: "syntax-check", message: "key \"if\" is duplicated", filepath: "w.yml", line: 9 }, { kind: "runner-label", message: "label \"mine\" is unknown", filepath: "w.yml", line: 4 }]), "w.yml");
ok(zz.length === 1 && zz[0].line === 7 && zz[0].what === "High\0${{ github.event.issue.title }}" && zz[0].rule === "template-injection" && /\(may expand into attacker-controllable code\)$/u.test(zz[0].said) && zizmorFindings("not json", "w.yml") === null
  && al.length === 1 && al[0].line === 9 && al[0].rule === "syntax-check" && actionlintFindings("", "w.yml").length === 0 && actionlintFindings("{", "w.yml") === null,
  "zizmor's finding is read at its primary location's line, one it marks ignored left out; actionlint's by its line, a runner label it does not know let pass; output that is no JSON is no answer", JSON.stringify([zz, al]));
 // (a workflow zizmor could not load is said by zizmor where actionlint said nothing of it, and left to actionlint where it did)
if (process.platform !== "win32") {
  const fake = scratchDir("workflow-tools-"), tool = (name, body) => { fs.writeFileSync(path.join(fake, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 }); return path.join(fake, name); };
  try {
    const z = tool("zizmor", "exit 3"), quiet = tool("quiet", "echo '[]'"), loud = tool("loud", `echo '[{"kind":"syntax-check","message":"key \\"on\\" is duplicated","line":2}]'; exit 1`), other = tool("other", `echo '[{"kind":"expression","message":"x","line":2}]'; exit 1`);
    const alone = run(fake, [".github/workflows/w.yml"], { zizmor: z, actionlint: quiet }).found, both = run(fake, [".github/workflows/w.yml"], { zizmor: z, actionlint: loud }).found, unfetched = run(fake, [".github/workflows/w.yml"], { zizmor: z, actionlint: "" }).found, beside = run(fake, [".github/workflows/w.yml"], { zizmor: z, actionlint: other }).found;
    ok(alone.length === 1 && alone[0].tool === "zizmor" && alone[0].rule === "unread" && !("quiet" in alone[0]) && both.length === 1 && both[0].tool === "actionlint" && unfetched.length === 1 && unfetched[0].rule === "unread" && beside.some(f => f.tool === "zizmor" && f.rule === "unread"),
      "a workflow zizmor could not load is said by zizmor where actionlint did not refuse it (said nothing, said only another kind, or did not run), and left to actionlint where it refused it", JSON.stringify({ alone, both, unfetched, beside }));
  } finally { fs.rmSync(fake, { recursive: true, force: true }); }
}
// (the base's texts are read in a git repository of their own, as the head's are, so actionlint reads both with their project)
const bf = baseFolder(os.tmpdir());
try { ok(fs.existsSync(path.join(bf, ".git")) && bf.startsWith(os.tmpdir()), "the base's folder is a git repository of its own under the run's temporary folder, so actionlint reads it as a project", bf); } finally { fs.rmSync(bf, { recursive: true, force: true }); }
// (where actionlint did not run, the core's own reading of a key given twice stands in for it in the core's own files)
const tw = twiceUnfetched([{ file: "a.yml", text: "on:\n  push:\n  push:\n" }, { file: "b.yml", text: "on: push\n" }]).fails;
const twLong = twiceUnfetched([{ file: "l.yml", text: `on: push\n# ${"x".repeat(LONGEST)}\n` }]).fails;
ok(twLong.length === 1 && /longer than .*Mend: cut the file/u.test(twLong[0]) && mended(twLong[0]), "where actionlint did not run, a file past the length read is told to be cut shorter", twLong.join("\n"));
ok(tw.length === 1 && /^FAIL a\.yml:3: the key "push" is given twice in one mapping, first on line 2/u.test(tw[0]) && mended(tw[0]), "where actionlint did not run, a key given twice in the core's own file fails by the core's own reading, with its mend", tw.join("\n"));
const unrun = run(".", [".github/workflows/a.yml", "tools/action.yml", ".github/actions/x/steps.yml"], { zizmor: "", actionlint: "" });
ok(unrun.found.length === 0 && unrun.unrun.join() === "zizmor,actionlint" && run(".", [".github/actions/x/steps.yml"], {}).unrun.length === 0 && isWorkflow(".github/workflows/a.YML") && !isWorkflow("tools/action.yml") && isAction("tools/action.yml"),
  "a tool not fetched is said not run, and finds nothing; none is said not run where it had no file to read");

process.exit(failed ? 1 : 0);
