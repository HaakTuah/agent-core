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
ok(fails(`      - "uses": mossgrip/cache@v3\n`) && fails("      - 'uses': mossgrip/cache@v3\n") && fails("      - uses : mossgrip/cache@v3\n") && fails(`      - {"uses":mossgrip/cache@v3}\n`) && fails("      - uses:\n          mossgrip/cache@v3\n"), "a quoted key and a spaced one are read; a value on the next line fails as unreadable");
ok(fails("      - ? uses\n        : mossgrip/cache@v3\n") && fails("      ? uses\n      : mossgrip/cache@v3\n") && fails(`      - ? "us\\\n          es"\n        : mossgrip/cache@v3\n`) && fails("      - { ? uses : mossgrip/cache@v3 }\n"), "a key written the long way fails as unreadable, whatever it spells");
ok(fails("x: &k uses\njobs:\n      - *k : mossgrip/cache@v3\n") && fails("      - { *k : mossgrip/cache@v3 }\n"), "a key that is an alias fails as unreadable");
ok(!fails(`      - run: node -e "console.log(a ? b : c)"\n      - run: echo "*bold*: text" && ls *.js\n      - run: |\n          echo "**Preview:** $URL"\n    if: \${{ a && b || c }}\n`), "a question mark or a star inside a script's text is no key");
ok(fails("      - uses: |\n          mossgrip/cache@v3\n") && fails("      - uses: *cache\n"), "a value in a block, or behind an alias, fails");
ok(fails(`      - "\\x75ses": mossgrip/cache@v3\n`) && fails(`on: ["pull_request\\x5ftarget"]\n`) && fails(`on: ["pull_request\\u005ftarget"]\n`), "a name spelled with a YAML escape is read as what it spells");
ok(fails(`on: ["pull_request_\\\n      target"]\n`) && fails("    steps: [uses: mossgrip/cache@v3]\n"), "a name broken over two lines by an escape, and a use in a list in brackets, are read");
ok(fails("# ci\ron:\r  pull_request_target:\r") && fails("# ci\rjobs:\r      - uses: mossgrip/cache@v3\r"), "lines that end in a lone carriage return are lines");
ok(!fails("      - run: |\n          node a.mjs \\\n            --target x\n"), "a script's own line that goes on to the next is no finding");
ok(!fails("      - run: |\n          ? a\n          : b\n          **Note**: text\n          *.js: ok\n\n          - ? maybe\n      - run: >-\n          *k : v\n    body: | # the comment\n      *bold*: text\n"), "in the text of a block no key is looked for");
ok(fails("      - run: |\n          echo\n        ? uses\n        : mossgrip/cache@v3\n") && fails("      - run: |\n          echo\n      - ? uses\n        : mossgrip/cache@v3\n") && fails("    a: |\n      text\n    *k : mossgrip/cache@v3\n"),
  "a line no more indented than the block's key is past the block, and read again");
ok(fails("x: &k uses\njobs:\n  a:\n    steps: # one step: |\n      - *k : mossgrip/cache@v3\n") && fails("jobs: # all of them: |\n  a:\n    steps:\n      - ? uses\n        : mossgrip/cache@v3\n")
  && fails("    steps: # see - >\n      - *k : mossgrip/cache@v3\n") && fails("steps: [ { name: x - |\n  , *k : mossgrip/cache@v3 } ]\n") && fails(`    name: "a: | # x"\n      ? uses\n`),
  "a | or > in a comment, after a value or inside brackets opens no block");
ok(!fails(`      - "run": |\n          ? a\n      - 'run': >2-\n          *k : v\n      - |\n            ? a\n`), "a quoted key, signs after the |, and a block that is itself an item, each open one");
ok(fails("      - run: |\n          echo\n          uses: mossgrip/cache@v3\n") && fails("      - run: |\n          pull_request_target\n"), "the two words themselves are read in a block too");
ok(!fails(`      - "uses": actions/checkout@v7\n      - run: echo 'no uses here'\n`), "a quoted key with one of GitHub's own passes; the word alone is no key");
ok(!fails(`      - uses: docker://alpine@sha256:${"a".repeat(64)}\n`) && fails("      - uses: docker://alpine:3.20\n"), "a container image passes only at its digest");
ok(fails("on:\n  pull_request_target:\n"), "pull_request_target fails");
ok(fails("on: [push, pull_request_target] # the labeller\n"), "also in a list, with a comment after it");
ok(!fails("# never pull_request_target, nor uses: mossgrip/cache@v3\n"), "a line that is all comment is not read");
ok(problems("a\nb\n      - uses: mossgrip/cache@v3\n")[0].line === 3, "a finding names its line");

const files = [".github/workflows/a.yml", ".github/workflows/b.yaml", ".github/actions/setup/action.yml", ".github/actions/setup/steps.yml", "tools/act/action.yaml", "action.yml",
  ".github/dependabot.yml", ".github/ISSUE_TEMPLATE/config.yml", "core/.github/workflows/a.yml", "core/tools/action.yml", "tools/node_modules/a/action.yml", "docs/a.yml", "docs/reaction.yml"];
ok(reads(files).join() === files.slice(0, 6).join(), "it reads the project's own workflows and its actions wherever they lie, and neither the core's copy nor an installed package's");

const core = fileURLToPath(new URL("..", import.meta.url));
const own = fs.readdirSync(`${core}.github/workflows`).filter(f => /\.ya?ml$/u.test(f));
ok(own.length > 0 && own.every(f => !fails(fs.readFileSync(`${core}.github/workflows/${f}`, "utf8"))), "the core's own workflows pass");
process.exit(failed ? 1 : 0);
