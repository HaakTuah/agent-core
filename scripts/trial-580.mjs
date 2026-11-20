// TEMPORARY (#580): the trial of zizmor and actionlint against the workflow check they replace, on the same inputs; run
// by .github/workflows/trial-580.yml on the pull request's runners alone, and taken out before it is marked ready.
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { draftHoles, keysTwice, lines, unparsed } from "./workflows.mjs";
import { LONGEST } from "./yaml-keys.mjs";
import { CORE } from "./core-address.mjs";

const ZIZMOR = process.env.ZIZMOR, ACTIONLINT = process.env.ACTIONLINT;
const repo = process.cwd(), tmp = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "trial-580-"));
const W = "jobs:\n  a:\n    runs-on: ubuntu-latest\n    permissions: {}\n    steps:\n      - run: echo hi\n";
const SHA = "a".repeat(40), wf = text => ({ ".github/workflows/w.yml": text });
const call = (on, uses, extra = "") => `on:\n${on}\npermissions: {}\njobs:\n  check:\n    uses: ${CORE}/.github/workflows/${uses}@${SHA}\n${extra}`;
const TYPES = "  pull_request:\n    types: [opened, synchronize]\n", NOT_DRAFT = "    if: ${{ !github.event.pull_request.draft }}\n";
const filler = `on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${"      - run: echo some step that repeats\n".repeat(Math.ceil(LONGEST / 40))}`;
const CASES = {
  // the forbidden trigger, as the word search's cases on main write it (tests/workflows-test.mjs)
  "trigger: a key": wf(`on:\n  pull_request_target:\n${W}`),
  "trigger: a value": wf(`on: pull_request_target\n${W}`),
  "trigger: in a list, a comment after": wf(`on: [push, pull_request_target] # the labeller\n${W}`),
  "trigger: quoted in braces": wf(`on: { "pull_request_target": {} }\n${W}`),
  "trigger: single-quoted": wf(`on:\n  'pull_request_target':\n${W}`),
  "trigger: written the long way": wf(`on:\n  ? pull_request_target\n  : {}\n${W}`),
  "trigger: behind an alias": wf(`x: &t pull_request_target\non: *t\n${W}`),
  "trigger: an escape (\\x5f)": wf(`on: ["pull_request\\x5ftarget"]\n${W}`),
  "trigger: an escape (\\u005F)": wf(`on: ["pull_request\\u005Ftarget"]\n${W}`),
  "trigger: an escaped line break": wf(`on: ["pull_request_\\\n      target"]\n${W}`),
  "trigger: behind U+2028 after a comment": wf(`# ci\u2028on: pull_request_target\n${W}`),
  "trigger: behind U+0085 after a no-break space": wf(`on:\n\u00a0# a comment\u0085  pull_request_target:\n${W}`),
  "trigger: labeler as the only step": wf(`on: pull_request_target\npermissions: {}\njobs:\n  l:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@${SHA}\n`),
  "trigger: with zizmor's ignore comment": wf(`on: pull_request_target # zizmor: ignore[dangerous-triggers]\n${W}`),
  "trigger: in a comment only": wf(`# never pull_request_target\non: push\n${W}`),
  "trigger: in a script only": wf(`on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo pull_request_target\n`),
  "workflow_run (allowed by rule 2 with its check)": wf(`on:\n  workflow_run:\n    workflows: [build]\n    types: [completed]\n${W}`),
  // a key given twice (#393), and the bugs' cases on main (#872, #876, #994, #752, #610, #837, #970)
  "#393 a step's if: twice": wf(`on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: x\n        if: a\n        if: b\n        run: echo\n`),
  "#393 on: twice at the top": wf(`on: push\nname: a\non: pull_request\n${W}`),
  "#393 in a flow mapping": wf(`on: { push: {}, "push": {} }\n${W}`),
  "#393 one quoted with an escape": wf(`"o\\x6e": push\non: pull_request\n${W}`),
  "#393 in an action of the project's own": { "action.yml": "name: a\ndescription: b\nruns:\n  using: composite\n  steps:\n    - run: echo\n      shell: bash\n      shell: sh\n" },
  "#872 a key twice hidden by U+2028": wf(`on: push\u2028name: a\u2028name: b\n${W}`),
  "#876 a key twice behind U+0085 after a comment": wf(`on: push\n# c\u0085name: a\nname: b\n${W}`),
  "#876 a key twice behind U+2029 after a comment": wf(`on: push\n# c\u2029name: a\nname: b\n${W}`),
  "#994 true and True, read as one by the package": wf(`on: push\nenv:\n  true: 1\n  True: 2\n${W}`),
  "#994 an unquoted step name holding \": \"": wf(`on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: The description check: the line "Read for it:"\n        run: x\n`),
  "#752 a key twice past the length read": wf(`${filler}name: a\nname: b\n`),
  "#610 nested 12500 deep": wf(`on: push\nx: ${"[".repeat(12500)}\n${W}`),
  "#837 explicit keys 2500 deep": wf(`on: push\nx:\n  ${"? ".repeat(2500)}a\n${W}`),
  "#970 three thousand keys twice": wf(`${Array.from({ length: 3000 }, (_, i) => `k${i}: 1\nk${i}: 2\n`).join("")}on: push\n${W}`),
  "#502 a call a draft skips, no ready_for_review": wf(call(TYPES, "copies.yml", NOT_DRAFT)),
  // what the tools read that the check never did
  "untrusted text in run:": wf(`on: pull_request\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "\${{ github.event.pull_request.title }}"\n`),
  "an action pinned to a tag": wf(`on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: someone/action@v1\n`),
  "permissions: write-all": wf(`on: push\npermissions: write-all\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`),
  "an expression on an unknown context": wf(`on: push\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \${{ github.evnt.name }}\n`),
};

const timed = (cmd, args, cwd) => { const t = Date.now(); const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 120000 }); return { ...r, ms: Date.now() - t }; };
function tools(root, files) {
  const out = {};
  const ymls = files.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(f));
  if (ZIZMOR) for (const persona of ["regular", "auditor"]) {
    const r = timed(ZIZMOR, ["--offline", "--no-progress", "--format", "json-v1", "--persona", persona, "--no-exit-codes", ...files], root);
    let found; try { found = JSON.parse(r.stdout).map(f => `${f.ident}[${f.determinations.severity}/${f.determinations.confidence}]@${f.locations.find(l => l.symbolic.kind === "Primary")?.symbolic.key.Local?.given_path ?? "?"}:${(f.locations.find(l => l.symbolic.kind === "Primary")?.concrete.location.start_point.row ?? -1) + 1}${f.ident === "dangerous-triggers" ? ` (${f.locations.find(l => l.symbolic.kind === "Primary")?.symbolic.annotation})` : ""}`); }
    catch { found = [`ERROR status ${r.status}${r.error ? ` ${r.error.code}` : ""}: ${(r.stderr || "").trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`]; }
    out[`zizmor ${persona}`] = { ms: r.ms, found };
  }
  if (ACTIONLINT && ymls.length) {
    const r = timed(ACTIONLINT, ["-format", "{{json .}}", "-shellcheck=", "-pyflakes=", "-no-color", ...ymls], root);
    let found; try { found = JSON.parse(r.stdout || "[]").map(e => `${e.kind}@${e.filepath}:${e.line}: ${e.message.slice(0, 140)}`); }
    catch { found = [`ERROR status ${r.status}${r.error ? ` ${r.error.code}` : ""}: ${(r.stdout + r.stderr).trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`]; }
    out.actionlint = { ms: r.ms, found };
  }
  return out;
}
function old(root, files) {
  const found = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n?/gu, "\n");
    const t = Date.now();
    for (const l of lines(text).slice(0, 3)) found.push(`trigger@${f}:${l}`);
    if (text.length <= LONGEST) {
      for (const k of keysTwice(text).slice(0, 3)) found.push(`key twice@${f}:${k.line}${k.key === null ? " (a part not read)" : ` ${JSON.stringify(k.key).slice(0, 30)}`}`);
      for (const j of draftHoles(text)) found.push(`draft skip@${f}: ${j}`);
      for (const u of unparsed([{ file: f, text }]).fails) found.push(`no YAML to the core's reader@${u.slice(5, 120)}`);
    } else found.push(`past the length read@${f}`);
    found.push(`(${Date.now() - t} ms)`);
  }
  return found;
}
const report = (name, root, files) => {
  console.log(`\n### ${name}`);
  console.log(`old: ${JSON.stringify(old(root, files))}`);
  for (const [tool, { ms, found }] of Object.entries(tools(root, files))) console.log(`${tool} (${ms} ms): ${JSON.stringify(found)}`);
};

const listed = root => execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(f => /^\.github\/(workflows\/[^/]+|actions\/.+)\.ya?ml$/iu.test(f) || /(^|\/)action\.ya?ml$/iu.test(f));
report("the core's own workflows", repo, listed(repo));
for (const [kit, args] of [["npm", ["--npm", "."]], [".NET", ["--nuget", "."]], ["npm, private", ["--npm", ".", "--private"]]]) {
  const dir = fs.mkdtempSync(path.join(tmp, "kit-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const r = spawnSync(process.execPath, [path.join(repo, "scripts/init.mjs"), "--owner", "someone", "--at", execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), ...args], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) { console.log(`\n### the starter kit, ${kit}: init failed: ${(r.stdout + r.stderr).slice(-400)}`); continue; }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  report(`the starter kit's project, ${kit}`, dir, listed(dir));
}
for (const [name, files] of Object.entries(CASES)) {
  const dir = fs.mkdtempSync(path.join(tmp, "case-"));
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  report(name, dir, Object.keys(files));
}
