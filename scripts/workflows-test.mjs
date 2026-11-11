// Checks the workflow check (workflows.mjs, beside this file): what floor rule 2 forbids fails, what it allows passes,
// and the core's own workflows pass. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/workflows-test.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { problems, reads } from "./workflows.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const sha = "0123456789abcdef0123456789abcdef01234567";
const fails = text => problems(text).length > 0;

ok(!fails(`on: [pull_request, push]\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n      - uses: ./.github/actions/setup\n`), "GitHub's own actions at a tag and the project's own pass");
ok(!fails(`      - uses: mossgrip/cache@${sha} # v3\n    uses: owner/repo/.github/workflows/x.yml@${sha}\n`), "another's action or workflow at a full commit SHA passes");
ok(fails("      - uses: mossgrip/cache@v3\n"), "another's action at a tag fails");
ok(fails("      - uses: mossgrip/cache@0123456\n"), "a short SHA fails");
ok(fails("      - uses: mossgrip/cache\n"), "no version at all fails");
ok(fails("    uses: owner/repo/.github/workflows/x.yml@main\n"), "another's workflow at a branch fails");
ok(fails(`      - uses: "mossgrip/cache@v3"\n`) && fails("      - { uses: 'mossgrip/cache@v3' }\n"), "a quoted name, or one in braces, is read too");
ok(fails("      - uses: actions-rs/toolchain@v1\n"), "a name that only starts like GitHub's own fails");
ok(!fails(`      - uses: docker://alpine@sha256:${"a".repeat(64)}\n`) && fails("      - uses: docker://alpine:3.20\n"), "a container image passes only at its digest");
ok(fails("on:\n  pull_request_target:\n"), "pull_request_target fails");
ok(fails("on: [push, pull_request_target] # the labeller\n"), "also in a list, with a comment after it");
ok(!fails("# never pull_request_target, nor uses: mossgrip/cache@v3\n"), "a line that is all comment is not read");
ok(problems("a\nb\n      - uses: mossgrip/cache@v3\n")[0].line === 3, "a finding names its line");

const files = [".github/workflows/a.yml", ".github/workflows/b.yaml", ".github/actions/setup/action.yml", ".github/dependabot.yml",
  ".github/ISSUE_TEMPLATE/config.yml", "core/.github/workflows/a.yml", "docs/a.yml"];
ok(reads(files).join() === files.slice(0, 3).join(), "it reads the project's own workflows and actions, and not the core's copy");

const core = fileURLToPath(new URL("..", import.meta.url));
const own = fs.readdirSync(`${core}.github/workflows`).filter(f => /\.ya?ml$/u.test(f));
ok(own.length > 0 && own.every(f => !fails(fs.readFileSync(`${core}.github/workflows/${f}`, "utf8"))), "the core's own workflows pass");
process.exit(failed ? 1 : 0);
