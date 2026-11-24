// Tests the steps whose findings only a tool fetched at set-up reads (step-checks-fetched.mjs, with steps.mjs; #1095,
// point 4): where the session did not fetch the tools, each stays unread and is not reported; where it did, each answers
// done where the tool finds nothing, and lists what it finds where it does; where the tool cannot run, the step is
// reported as not read, never done. On the starter kit's npm project in a scratch folder, with stand-ins for zizmor,
// actionlint and lychee. Node's own modules and git.
//
//   node tests/steps-fetched-test.mjs
import fs from "node:fs";
import path from "node:path";
import { STEPS, fetched, notDone } from "../scripts/steps.mjs";
import { NAMED } from "../scripts/step-checks-fetched.mjs";
import { kitIn } from "../scripts/steps-kit.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-fetched-"), d = kitIn(tmp)("an-npm-project", { packages: "." });
const WORKFLOWS = "20 November 2026, the workflow check runs zizmor and actionlint", LINKS = "20 November 2026, the pointer check reads Markdown's links with lychee";
const step = lead => STEPS.find(s => s.lead === lead);

ok([WORKFLOWS, LINKS].every(l => step(l)?.fetched) && STEPS.filter(s => s.fetched).every(s => s.unread && !s.check && !s.held && s.fetched.tools.length && typeof s.fetched.check === "function"),
  "each step that gives a check for where the session fetched its tools stays unread where it did not, the two among them");
ok(!fetched(step(WORKFLOWS), {}) && !fetched(step(WORKFLOWS), { ZIZMOR: "z" }) && fetched(step(WORKFLOWS), { ZIZMOR: "z", ACTIONLINT: "a" }) === step(WORKFLOWS).fetched.check,
  "the workflow step's check runs only where both tools were fetched");

if (process.platform !== "win32") {
  // (stand-ins: zizmor and actionlint that find one thing in a workflow that holds "FINDME", else nothing; lychee that
  // lists each [text](path) of a file as its --dump does, and reports no heading)
  const bin = scratchDir("steps-fetched-tools-"), tool = (name, body) => { fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n[ "$1" = --version ] && exit 0\n${body}\n`, { mode: 0o755 }); return path.join(bin, name); };
  const last = 'for a; do f="$a"; done';
  const ZIZMOR = tool("zizmor", `${last}\nif grep -q FINDME "$f"; then echo '[{"ident":"template-injection","desc":"code injection","url":"","locations":[{"symbolic":{"kind":"Primary"},"concrete":{"location":{"start_point":{"row":2}}}}]}]'; else echo '[]'; fi`);
  const ACTIONLINT = tool("actionlint", `${last}\nif grep -q FINDME "$f"; then echo '[{"kind":"expression","message":"no such context","line":4}]'; exit 1; fi; echo '[]'`);
  const LYCHEE = tool("lychee", `${last}\ncase " $* " in *" --dump "*) dir=$(dirname "$f"); grep -o '](\\([^)#]*\\))' "$f" | sed -e 's/^](//' -e 's/)$//' | grep -v : | while read -r l; do echo "file://$dir/$l"; done ;; *) echo '{"error_map":{}}' ;; esac`);
  const broken = tool("lychee-broken", 'echo "it broke" >&2; exit 1');
  const env = { ZIZMOR, ACTIONLINT, LYCHEE }, was = { ...process.env };
  const ran = (vars, lead) => { Object.assign(process.env, vars); try { return notDone(d).find(m => m.lead === lead); } finally { for (const k of Object.keys(vars)) if (k in was) process.env[k] = was[k]; else delete process.env[k]; } };

  ok(!ran({}, WORKFLOWS) && !ran({}, LINKS), "where the session fetched no tool, neither step is reported");
  ok(!ran(env, WORKFLOWS) && !ran(env, LINKS), "on the starter kit's project, the tools finding nothing, both steps read done");

  const flow = path.join(d, ".github/workflows/own.yml");
  fs.writeFileSync(flow, "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo FINDME\n");
  const found = ran(env, WORKFLOWS);
  ok(found && !found.unread && found.mend.includes("`.github/workflows/own.yml`:3 zizmor's template-injection") && found.mend.includes("`.github/workflows/own.yml`:4 actionlint's expression") && found.mend.startsWith("File one task, an issue,"),
    "a finding the tools hold in the project's own workflow is listed by file, line and audit, with the task to file", found?.mend);
  const many = Array.from({ length: NAMED + 3 }, (_, i) => path.join(d, `.github/workflows/w${i}.yml`));
  for (const f of many) fs.writeFileSync(f, "on: push\njobs: {}\n# FINDME\n");
  const counted = ran(env, WORKFLOWS);
  ok(counted?.mend.includes(`; and ${2 * (NAMED + 4) - NAMED} more, which the check's run lists`), `past ${NAMED} findings the rest are counted, not named`, counted?.mend);
  for (const f of [flow, ...many]) fs.rmSync(f);
  ok(!ran(env, WORKFLOWS), "once the workflow is mended, the step reads done again");
  // (what another step reads already is its own: a key given twice, step 460's, and a workflow the core's reader cannot
  // read, which every step that reads the workflows reports as not read)
  const twice = tool("actionlint-twice", `echo '[{"kind":"syntax-check","message":"key duplicated","line":8},{"kind":"syntax-check","message":"unknown key","line":3}]'; exit 1`);
  fs.writeFileSync(flow, "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo a\n        if: always()\n        if: always()\n");
  const left = ran({ ...env, ACTIONLINT: twice }, WORKFLOWS);
  ok(left?.mend.includes("`.github/workflows/own.yml`:3 actionlint's syntax-check") && !left.mend.includes("own.yml`:8"),
    "a key given twice, which its own step reports, is left out of the tools' findings; another finding of their syntax check stays", left?.mend);
  fs.writeFileSync(flow, "on: push\nenv: [A\njobs: {}\n");
  const unreadable = ran(env, WORKFLOWS);
  ok(unreadable?.unread && unreadable.mend.includes("could not read the project") && unreadable.mend.includes("own.yml"),
    "a workflow the core's reader cannot read is reported as not read, as by every step that reads the workflows", unreadable?.mend);
  fs.rmSync(flow);
  const gone = ran({ ZIZMOR: path.join(bin, "none"), ACTIONLINT }, WORKFLOWS);
  ok(gone?.unread && gone.mend.includes("zizmor could not start"), "where a tool named cannot start, the step is reported as not read, never done or not done", gone?.mend);
  const dead = path.join(bin, "dead");
  fs.writeFileSync(dead, "#!/bin/sh\nexit 3\n", { mode: 0o755 });
  const died = ran({ ZIZMOR, ACTIONLINT: dead }, WORKFLOWS);
  ok(died?.unread && died.mend.includes("actionlint could not start (exit 3)"), "and so where it starts and fails before it reads anything", died?.mend);
  // (an action that is a link out of the project is given to neither tool, as the project's reader leaves it: floor topic 5)
  const far = path.join(scratchDir("steps-fetched-far-"), "action.yml"), action = path.join(d, "x/action.yml");
  fs.writeFileSync(far, "runs:\n  using: composite\n  steps: []\n# FINDME\n");
  fs.mkdirSync(path.dirname(action));
  fs.symlinkSync(far, action);
  ok(!ran(env, WORKFLOWS), "an action that is a link out of the project is not read, nor given to the tools");
  fs.rmSync(path.dirname(action), { recursive: true });

  const agents = path.join(d, "AGENTS.md"), text = fs.readFileSync(agents, "utf8");
  fs.writeFileSync(agents, `${text}\nSee [the notes](docs/gone.md).\n`);
  const link = ran(env, LINKS);
  ok(link && !link.unread && link.mend.includes("`AGENTS.md`:") && link.mend.includes("to docs/gone.md"), "a link in a rule file to no tracked file is listed by file, line and link", link?.mend);
  const stopped = ran({ LYCHEE: broken }, LINKS);
  ok(stopped?.unread && stopped.mend.includes("lychee could not run on the rule files"), "where lychee cannot run, the step is reported as not read, never done", stopped?.mend);
  fs.writeFileSync(agents, text);
  ok(!ran(env, LINKS), "once the link is mended, the step reads done again");
  // (a rule file SECURITY.md names that links out of the project is left out, as the project's reader leaves it:
  // floor topic 5)
  const model = path.join(d, "docs/threat-model.md"), held = fs.readFileSync(model, "utf8"), outside = path.join(scratchDir("steps-fetched-out-"), "out.md");
  fs.writeFileSync(outside, "See [the notes](gone.md).\n");
  fs.rmSync(model);
  fs.symlinkSync(outside, model);
  ok(!ran(env, LINKS), "a rule file that is a link out of the project is not read, nor given to lychee");
  fs.rmSync(model);
  fs.writeFileSync(model, held);
}

done("the steps read by a tool fetched at set-up");
