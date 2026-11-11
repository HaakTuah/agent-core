// Checks the workflow check (workflows.mjs, beside this file): the forbidden trigger is found however it is written,
// and the core's own workflows pass. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/workflows-test.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lines, reads } from "./workflows.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const fails = text => lines(text).length > 0;

ok(!fails("on: [pull_request, push]\non:\n  pull_request:\n  workflow_run:\n    workflows: [build]\n"), "the other triggers pass");
ok(fails("on:\n  pull_request_target:\n") && fails("on: pull_request_target\n") && fails("on: [push, pull_request_target] # the labeller\n"), "the trigger fails as a key, as a value and in a list with a comment after it");
ok(fails(`on: { "pull_request_target": {} }\n`) && fails("on:\n  'pull_request_target':\n") && fails("on:\n  ? pull_request_target\n  : {}\n"), "quoted, in braces or written the long way");
ok(fails(`on: ["pull_request\\x5ftarget"]\n`) && fails(`on: ["pull_request\\u005Ftarget"]\n`) && fails(`on: ["pull_request\\U0000005ftarget"]\n`) && fails(`on: ["\\x70ull_request_target"]\n`), "a name spelled with a YAML escape is read as what it spells");
ok(fails(`on: ["pull_request_\\\n      target"]\n`) && fails(`on: ["pull_\\\n  request_\\\n  target"]\n`), "a name broken over two or three lines by an escape is joined");
ok(fails("# ci\ron:\r  pull_request_target:\r") && fails("# ci\r\non:\r\n  pull_request_target:\r\n"), "lines that end in a lone carriage return, or in both, are lines");
ok(!fails("# never pull_request_target\n  # nor here: pull_request_target\n"), "a line that is all comment is not read");
ok(!fails("      - run: |\n          node a.mjs \\\n            --target x\n") && !fails(`      - run: echo "\\U99999999"\n`), "a script's own line that goes on to the next, and an escape that spells nothing, are no finding");
ok(lines("a\nb\non: pull_request_target\n")[0] === 3, "a finding names its line");

const files = [".github/workflows/a.yml", ".github/workflows/b.yaml", ".github/actions/setup/action.yml", ".github/actions/setup/steps.yml", "tools/act/action.yaml", "action.yml",
  ".github/dependabot.yml", ".github/ISSUE_TEMPLATE/config.yml", "core/.github/workflows/a.yml", "core/tools/action.yml", "tools/node_modules/a/action.yml", "docs/a.yml", "docs/reaction.yml"];
ok(reads(files).join() === files.slice(0, 6).join(), "it reads the project's own workflows and its actions wherever they lie, and neither the core's copy nor an installed package's");

const core = fileURLToPath(new URL("..", import.meta.url));
const own = fs.readdirSync(`${core}.github/workflows`).filter(f => /\.ya?ml$/u.test(f));
ok(own.length > 0 && own.every(f => !fails(fs.readFileSync(`${core}.github/workflows/${f}`, "utf8"))), "the core's own workflows pass");
process.exit(failed ? 1 : 0);
