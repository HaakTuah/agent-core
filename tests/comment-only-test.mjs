// Tests of the proof that a change to what runs by itself is only comments and steps' names (comment-only.mjs; floor
// rule 3): its reading of two versions of a workflow, against each way a change can hide where a comment seems to
// be (a block scalar's # lines, a heredoc's, a quoted or plain value that runs on, [ ] or { }, an input, a matrix
// entry, a job or the workflow named `name`, an expression in a step's name, a composite action's steps, every
// character YAML reads as a line break or this proof does not read); then each workflow of this repository, a comment
// and a step's name changed in it where it reads. The script run end to end, and which files it reads, are
// comment-only-run-test.mjs's. On Linux and on Windows. Git and Node's own modules only.
//
//   node tests/comment-only-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proof, readYaml } from "../scripts/comment-only.mjs";
import { BASE, edit } from "../scripts/comment-only-stage.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const passes = (after, what, before = BASE) => { const r = proof(before, after); ok(r.same === true, what, r.why); };
const fails = (after, what, why = "", before = BASE) => { const r = proof(before, after); ok(r.same !== true && (!why || r.why.includes(why)), what, r.why ?? "passed"); };

// ---- what passes: comments, blank lines between entries, steps' names ----
ok(readYaml(BASE).unread.length === 0, "the test's workflow reads", readYaml(BASE).unread.join("; "));
passes(BASE, "a file unchanged");
passes(edit("# A workflow for the test", "# Another note"), "a comment line changed");
passes(edit("      - name: The check", "      # before the check\n      - name: The check"), "a comment line added between steps");
passes(edit("# A workflow for the test\n", ""), "a comment line taken out");
passes(edit('"y" # a quoted value', '"y" # the value, quoted'), "a line's own comment changed");
fails(edit("# v7.0.1", "# v7.0.2"), "the note beside an action's version, which reviewers trust", "the note beside an action's version");
fails(edit("# the kinds", "# shellcheck disable=SC2086"), "a comment a linter reads as an instruction", "a tool may read as an instruction");
fails(edit("      - name: The check", "      # zizmor: ignore[template-injection]\n      - name: The check"), "a comment line that silences a check", "a tool may read as an instruction");
passes(edit("# the kinds", "# the kinds"), "a silencing comment taken out", edit("# the kinds", "# codeql[actions/x] the kinds"));
fails(edit("# the kinds", "# nosemgrep"), "a semgrep marker", "instruction");
fails(edit("# the kinds", "# checkov:skip=CKV_GHA_7"), "a checkov marker", "instruction");
for (const [marker, whose] of [["# lgtm[js/unsafe-shell]", "CodeQL's older"], ["# NOSONAR", "SonarQube's"], ["# ggignore", "GitGuardian's"]]) fails(edit("# the kinds", marker), `${whose} marker`, "instruction");
const quotedUses = edit("- uses: actions", '- "uses": actions');
fails(edit("# v7.0.1", "# v7.0.2", quotedUses), "the note beside an action's version under a quoted key", "the note beside an action's version", quotedUses);
const two = "jobs:\n  a:\n    steps:\n      # codeql[actions/x]\n      - run: echo \"${{ github.event.issue.title }}\" # zizmor: ignore[template-injection]\n      - run: echo \"${{ github.event.pull_request.title }}\"\n";
passes(two, "silencing comments where they stood", two);
fails(two.replace(" # zizmor: ignore[template-injection]\n", "\n").replace("pull_request.title }}\"\n", "pull_request.title }}\" # zizmor: ignore[template-injection]\n"), "a silencing comment moved to another line", "added or moved", two);
fails(two.replace("      # codeql[actions/x]\n", "").replace("      - run: echo \"${{ github.event.pull_request", "      # codeql[actions/x]\n      - run: echo \"${{ github.event.pull_request"), "a silencing comment line moved before another line", "added or moved", two);
passes(two.replace(" # zizmor: ignore[template-injection]", ""), "a silencing comment taken off its line", two);
const steps2 = "jobs:\n  a:\n    steps:\n      # nosemgrep: run-shell-injection\n      - name: One # zizmor: ignore[template-injection]\n        run: echo one\n      - name: Two\n        run: echo \"${{ github.event.pull_request.title }}\"\n";
fails(steps2.replace("      # nosemgrep: run-shell-injection\n", "").replace("      - name: Two", "      # nosemgrep: run-shell-injection\n      - name: Two"), "a silencing comment line moved from one step to another, their names read alike", "added or moved", steps2);
fails(steps2.replace("One # zizmor: ignore[template-injection]", "One").replace("- name: Two", "- name: Two # zizmor: ignore[template-injection]"), "a silencing note moved from one step's name to another's", "added or moved", steps2);
passes(steps2.replace("- name: One #", "- name: First #"), "a step renamed beside its silencing note", steps2);
passes(edit(' # a quoted value', ""), "a comment after a quoted value taken out");
passes(edit("[opened, synchronize] # the kinds", "[opened, synchronize] # what starts it"), "a comment after [ ] changed");
passes(edit("      - name: The check", "\n\n      - name: The check").replace("permissions:", "\npermissions:"), "blank lines between entries");
passes(edit("        env:", "        # about env, after the block\n        env:"), "a comment after a block scalar, less indented than its text");
passes(edit("        run: >-", "        run: >- # folded"), "a comment on a block scalar's header");
passes(edit("      - name: The check", "      - name: The checks, all of them"), "a step's name changed");
passes(edit("'Single'", '"Double, quoted"'), "a step's name quoted another way and changed");
passes(edit("      - name: The check", "      - name: Checked # with a comment").replace("# the kinds", "# kinds of event"), "a step's name and comments changed together");
passes(edit("      - name: The check", "      - name: Nullable check"), "a step's name that only begins with a word YAML reserves");
for (const name of ["null", "~", "true", "Yes", "off", "123", "1st check", "''", '""']) fails(edit("      - name: The check", `      - name: ${name}`), `a step's name YAML may read as no text, or none: ${name}`);
const compact = "jobs:\n  a:\n    steps:\n    - name: First\n      run: echo\n    - uses: x # pinned\n";
passes(compact.replace("First", "Second"), "a step's name in steps written at their key's own indentation", compact);

// ---- what fails: text, not comments; keys named `name` that are no step's; anything not read for sure ----
fails(edit("# the shell's own comment", "# the shell's comment, changed"), "a # line inside a run block is the script's text", "more than a comment");
fails(edit("# data, not a comment", "# other data"), "a heredoc's # line inside a run block");
fails(edit('echo "a #b"', 'echo "a #c"'), "text after # inside a run block");
fails(edit("          echo folded", "          # a line\n          echo folded"), "a # line added inside a block scalar");
fails(edit("        run: echo hi", "        run: |\n          echo hi"), "a value turned into a block scalar");
// (a block scalar that keeps its blank lines, `|+`, holding one alone: that line is its text, never a blank line
// between entries; #621)
const keptOne = "jobs:\n  a:\n    env:\n      FLAG: |+\n\n    steps:\n      - run: test -z \"$FLAG\"\n";
fails(keptOne.replace("|+\n\n", "|+\n"), "a kept block scalar's one blank line taken out", "more than a comment", keptOne);
// (a quote left open on a line the proof reads as a block scalar's text, where the header gives its indentation and
// YAML would read it as a value that runs on to the end: every line after it is refused, never left unread; #621)
const openQuote = "jobs:\n  a:\n    steps:\n      - run: |2\n         \"hi\n        name: x\n";
fails(`${openQuote}      - run: sh ./added.sh\n`, "a step added after a quote left open in a block scalar whose header gives its indentation", "", openQuote);
// (the fallback reviewer's pairs on #621: a last line of spaces after a `|+` block is its text; under a header that
// gives its indentation, a line the lexer reads as YAML is refused, never read as text the lexer parts from)
const keptSpaces = "jobs:\n  a:\n    env:\n      FLAG: |+\n        x\n";
fails(`${keptSpaces}   `, "a last line of spaces added after a kept block scalar", "", keptSpaces);
for (const fixed of ["      run: |+2\n       {a\n      a: |-\n      - run: |+\n\n", "  a: |+2\n   [a\n  a: |2\n  ---\n\n"]) {
  fails(fixed.replace(/\n$/u, ""), `a line the lexer reads as YAML under a header that gives its indentation: ${JSON.stringify(fixed)}`, "", fixed);
}
fails(edit("          cat <<EOF\n", "          cat <<EOF\n\n"), "a blank line added inside a block scalar");
passes(BASE, "a blank line taken out between a block scalar and the next entry", edit("          EOF\n", "          EOF\n\n"));
passes(edit("          EOF\n", "          EOF\n\n  \n"), "blank lines added after a block scalar's last line");
passes(`${BASE}# end\n`, "a comment added at the end of a file whose last value is a block scalar");
fails(edit("          EOF\n", "          EOF\n             \n"), "a line of spaces past a block scalar's indentation, which YAML reads as its text");
const kept = edit("        run: |\n", "        run: |+\n");
fails(edit("          EOF\n", "          EOF\n\n", kept), "a blank line added after a block scalar whose trailing lines are kept", "", kept);
for (const [before, after] of [["x: |+\n  a\n\n", "x: |+\n  a\n\n\n# c\n"], ["x: |+\n  a\n  ", "x: |+\n  a\n  \n# c"], ["x: |+\n\n", "x: |+\n\n\n# c\n"], ["x: |2+\n  a\n\n", "x: |2+\n  a\n\n\n# c\n"]]) {
  fails(after, `a blank line kept by |+ added at the end of the file, a comment after it: ${JSON.stringify(before)}`, "", before);
}
passes("x: |+\n  a\n\n# c\n", "a comment added after a block's kept blank lines at the end of the file", "x: |+\n  a\n\n");
const unbroken = "jobs:\n  a:\n    steps:\n      - run: |\n          echo";
fails(`${unbroken}\n# end\n`, "a line break added after a block scalar's last line, at the end of the file", "", unbroken);
const sibling = "jobs:\n  a:\n    steps:\n      - run: |\n        shell: bash\n";
passes(sibling.replace("        shell", "        # a note\n        shell"), "a comment at the key's column after `- run: |`, which YAML reads as no text of it", sibling);
fails(sibling.replace("        shell", "          # a note\n        shell"), "a # line past the key's column after `- run: |`, its text", "", sibling);
fails(BASE.replace(/\n$/u, ""), "the last line's break taken off a block scalar");
fails(edit("          - name: one", "          - name: two"), "a matrix entry's name");
fails(edit("          name: an-input", "          name: another-input"), "an input named `name`");
fails(edit("    name: Build", "    name: Built"), "a job's name");
fails(edit("name: t", "name: u"), "the workflow's name");
fails(edit("github.ref }}", "github.sha }}"), "a step's name with an expression");
fails(edit("      - name: The check", "      - name: ${{ secrets.X }}"), "an expression put into a step's name");
fails(edit("'Single'", '"\\x24{{ toJSON(secrets) }}"'), "an expression spelt with an escape in a quoted step's name");
fails(edit("'Single'", '"a \\\\ b"'), "any backslash in a step's name");
fails(edit("runs-on: ubuntu-latest", "runs-on: windows-latest"), "a value");
fails(edit("        shell: bash\n", ""), "a line taken out");
fails(edit("persist-credentials: false", "persist-credentials: false#x"), "a # with no space before it is text");
fails(edit('X: "y"', 'X: "y # z"'), "a # inside quotes is text");
fails(edit("        run: echo hi", "        name: also\n        run: echo hi").replace("        name: also", "        name: other"), "a step's name that is not its first key",
  "", edit("        run: echo hi", "        name: also\n        run: echo hi"));
const composite = "name: c\nruns:\n  using: composite\n  steps:\n    - name: First # a note\n      shell: bash\n      run: echo\n";
passes(composite.replace("# a note", "# another"), "a composite action's comment", composite);
fails(composite.replace("First", "Second"), "a composite action's step's name", "", composite);
const nested = "jobs:\n  a:\n    with:\n      steps:\n        - name: x\n";
fails(nested.replace("x", "y"), "a `name` under steps that are no job's", "", nested);

const unread = (text, what, why) => { const r = readYaml(text); ok(r.unread.length > 0 && r.unread.join(" ").includes(why), what, r.unread.join("; ") || "read"); fails(text, `${what}: no proof`, "", text); };
unread(edit("        run: echo hi", '        run: "echo a\n          # in the string"'), "a double-quoted value that runs on", "runs on");
unread(edit("        run: echo hi", "        run: 'echo a\n          # in the string'"), "a single-quoted value that runs on", "runs on");
unread(edit("        if: ${{ !cancelled() }}", "        if: github.a &&\n          github.b"), "a plain value that runs on", "runs on");
unread(edit("        if: ${{ !cancelled() }}", "        if: github.a &&\n          - github.b"), "a plain value that runs on to a line that looks like an item", "runs on");
unread(edit("          name: an-input", "          name: an-input\n            - name: more"), "a value that runs on to a line that looks like a step's name", "runs on");
unread(edit("        run: echo hi", "        run:\n          echo hi"), "a value on a line of its own", "a line of its own");
passes(edit("# the kinds", "# what starts it", edit("[opened, synchronize]", '["opened", synchronize]')), "a comment beside [ ] with a quoted word changed", edit("[opened, synchronize]", '["opened", synchronize]'));
// quoted plain words in [ ] are read (#1313), and a change to them, or a quote around anything else, is not passed
const kit = 'version: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    groups:\n      minor-and-patch:\n        patterns: ["*"]\n        update-types: ["minor", "patch"] # a new major is its own PR\n';
passes(kit.replace("its own PR", "its own pull request"), "a comment beside [ ] of quoted plain words changed", kit);
passes(kit.replace("  - package-ecosystem", "  # see the rules\n  - package-ecosystem"), "a comment line added in a file with [ ] of quoted plain words", kit);
passes("a: [\"Az09 ._/*+-\"] # x\n", "every character a plain word may hold, quoted in [ ]", "a: [\"Az09 ._/*+-\"]\n");
passes("a: [[\"x\"], [y, \"z\"]] # x\n", "quoted words in [ ] within [ ]", "a: [[\"x\"], [y, \"z\"]]\n");
passes("a: ['x', \"y\", z]\n", "single, double and plain words together in [ ]", "a: ['x', \"y\", z]\n");
fails(kit.replace('["minor", "patch"]', '["minor", "patch", "major"]'), "a word added to [ ] of quoted words", "more than a comment", kit);
fails(kit.replace('["minor", "patch"]', '["minor"]'), "a word taken out of [ ] of quoted words", "more than a comment", kit);
fails(kit.replace('["*"]', '["actions*"]'), "a quoted word in [ ] changed", "more than a comment", kit);
fails(kit.replace('"patch"] # a new', '"patch"]# a new'), "a comment beside [ ] that loses its space before it", "", kit);
for (const [list, what] of [['["a#b"]', "a #"], ['["a\\\\"]', "a backslash"], ['["a\\"b"]', "an escaped quote"], ["['it''s']", "a doubled quote"], ['["a, b"]', "a comma"], ['["a: b"]', "a colon"], ['["a]"]', "a bracket"], ['["${{ x }}"]', "an expression"], ['{ "a": b }', "{ } (only [ ] is read so)"], ['[{ "b": c }]', "{ } within [ ]"], ['[b, {c: "d"}]', "a value in { } within [ ]"], ['["a" # x\n  , "b"]', "a # between quoted words"]]) unread(`k: ${list}\n`, `a quote inside [ ] around ${what}`, list.includes("\n") ? "" : "inside [ ] or { }");
unread(edit("[opened, synchronize] # the kinds", "[opened, # the kinds\n      synchronize]"), "[ ] that runs on to the next line", "inside [ ] or { }");
unread(edit("[opened, synchronize] # the kinds", "[opened,\n      synchronize]"), "[ ] that runs on to the next line, with no #", "runs on");
unread(edit("  contents: read", "  contents: &r read"), "an anchor", "anchor");
unread(edit("  contents: read", "  contents: *r"), "an alias", "alias");
unread(edit("  contents: read", "  <<: *r"), "a merge key", "alias");
unread(edit("  contents: read", "  contents: !!str read"), "a tag", "tag");
unread(edit("  contents: read", "  ? contents\n  : read"), "an explicit key", "explicit key");
unread(`---\n${BASE}`, "a document marker", "document marker");
unread(edit("  contents: read", "  contents: read: write"), "two keys on one line", "two keys");
unread(edit("          echo folded", "          echo folded\n        # less indented\n          echo after"), "text after a less indented comment in a block", "a line of its own");
unread(edit("        run: |\n", "        run: |\n                \n"), "a blank line before a block scalar's first line, with more spaces than it", "less indented than a blank line");
const spaces = "env:\n  X: |2\n    \n  Y: z\n";
fails(spaces.replace("    \n", "\n"), "a line of spaces past a given indentation, in a block of nothing else, which YAML reads as its text", "", spaces);
const empty = "env:\n  X: |\n      \n  Y: z\n";
passes(empty.replace("  Y", "  # a note\n  Y"), "a comment after a block of blank lines alone, which YAML reads as empty", empty);
for (const [ch, name] of [["\t", "a tab"], ["\r", "a carriage return"], ["\u2028", "a line separator"], ["\u2029", "a paragraph separator"], ["\u0085", "a next line"], ["\ufeff", "a byte order mark"], ["\u0000", "a null"], ["\uffff", "a character YAML refuses in a file"]]) {
  unread(edit("# A workflow for the test", `# A workflow ${ch}for the test`), `${name}, even in a comment`, "control character");
}
const fixed = "jobs:\n  a:\n    steps:\n      - run: |2\n            # text\n          echo\n";
fails(fixed.replace("# text", "# other"), "a # line in a block scalar with its indentation given", "", fixed);
passes(fixed.replace("      - run: |2", "      # before\n      - run: |2"), "a comment before a block scalar with its indentation given", fixed);

// ---- this repository's own workflows: each that reads takes a comment and a step's name ----
const files = execFileSync("git", ["ls-files", "-z", ".github/workflows"], { cwd: root, encoding: "utf8" }).split("\0").filter(f => /\.ya?ml$/iu.test(f));
const own = files.map(f => [f, fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/gu, "\n")]).filter(([, text]) => readYaml(text).unread.length === 0);
ok(own.length > 0, `${own.length} of this repository's ${files.length} workflows read`);
for (const [f, text] of own) {
  const r = proof(text, `# a comment added\n${text}`);
  const named = readYaml(text).lines.find(l => l.stepName);
  const renamed = named ? text.split("\n").map((line, i) => (i + 1 === named.n ? `${line.slice(0, named.valueAt)}Renamed for the test` : line)).join("\n") : text;
  const s = proof(text, renamed);
  ok(r.same === true && s.same === true, `${f}: a comment added${named ? " and a step renamed" : ""}`, r.why ?? s.why);
}

// ---- the starter kit's Dependabot configs, as a project holds them: each reads, so a comment changed in one takes rule
// 8's one review (#1313) ----
const kits = fs.readdirSync(path.join(root, "setup/template")).filter(f => /^dependabot.*\.ya?ml\.tmpl$/u.test(f));
ok(kits.length > 0, `${kits.length} of the starter kit's Dependabot configs`);
for (const f of kits) {
  const text = fs.readFileSync(path.join(root, "setup/template", f), "utf8").replace(/\r\n/gu, "\n");
  const r = proof(text, `# a comment added\n${text.replace(/ # /u, " # changed: ")}`);
  ok(r.same === true, `setup/template/${f}: a comment added and one changed`, r.why);
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the proof that a change is comments and steps' names alone`);
process.exitCode = failed ? 1 : 0;
