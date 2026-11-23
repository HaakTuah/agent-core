// Tests the same reading on the commands a step wraps its run in: a shell given its commands as one word, a here-document,
// a wrapper's options, a subshell, a redirection and a command behind a keyword, each read as the shell reads it or said
// not read, never read wrong. Node's own modules.
//
//   node tests/steps-run-wrappers-test.mjs
import { linear, inMemory, stepped, coreCall, copiesOf, notRead } from "../scripts/steps-kit.mjs";
import { configs, runsOwn } from "../scripts/steps.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();

// (the reviews of 72474d0: an expression in single quotes, a run through an action counted by its workflow, each
// script's arguments as it reads them, a folder that is no text, a Windows path in quotes, a shell given its commands
// as one word, a here-document, and a file a call names outside the project)
ok(notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs '${{ vars.CONFIG }}'") }), "an expression of GitHub's in single quotes is filled before the shell runs, so not read");
const viaAction = inMemory({ "a.yml": { jobs: { j: { steps: [{ run: "node core/scripts/licences.mjs l.json" }, { uses: "./.github/actions/t" }] } } } },
  { ".github/actions/t/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node core/scripts/agent-tools.mjs l.json\n      shell: bash\n" });
ok(JSON.stringify(runsOwn(viaAction, "agent-tools.mjs").map(r => [r.where, r.from])) === JSON.stringify([[".github/actions/t/action.yml", ".github/workflows/a.yml"]]), "a run through a local action is counted by the workflow that uses it");
const nugetOf = run => configs(inMemory({ "n.yml": stepped(run) })).nuget;
ok(nugetOf("node core/scripts/nuget.mjs --packages restored config/n.json") === "config/n.json" && nugetOf("node core/scripts/nuget.mjs config/n.json\nnode core/scripts/nuget.mjs --projects") === "config/n.json"
  && configs(inMemory({ "a.yml": stepped("node core/scripts/reading-size.mjs -x") })).sizes === "-x" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs -x") }) === "-x",
  "each script's config is the argument it picks itself: never the NuGet check's folder, none where it lists files, and an option of one dash taken as the scripts take it");
ok(notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs c.json", { "working-directory": { toString: "x" } }) }), "a folder that is no text is not read, and stops no other reading");
ok(copiesOf({ "a.yml": stepped('bash -c "node core/scripts/copies.mjs config/c.json"') }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("sudo node core/scripts/copies.mjs config/c.json") }) === "config/c.json"
  && notRead("copies", { "a.yml": stepped("cat <<EOF > notes.md\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a shell given its commands as one word and sudo are read as runs; a here-document's lines are never read as one, and naming the script they leave its run not read");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "../../x.json", sizes: "s.json" }) }) && notRead("sizes", { "a.yml": coreCall("copies.yml", { config: "c.json", sizes: "/s.json" }) }),
  "a file a call names outside the project is not read");
// (the review of 94b6a6c: a "<<" that opens no here-document hides no line, a wrapper's and a shell's options pass, an
// action two workflows use counts for each, every file named outside the project is not read, the NuGet check's
// --imports reads no config, and a reading that throws leaves nothing kept)
ok(["read x <<< hello", "n=$((1<<k))", 'echo "a <<EOF b"', 'node -e "console.log(1 << 2)"', "cat <<OPEN"].every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json")
  && notRead("copies", { "a.yml": stepped("cat <<\\EOF > x\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a \"<<\" in quotes, in <<< or in arithmetic, and one with no line that ends it, leave out no line; one after a \"\\\" does");
ok(["sudo -E node core/scripts/copies.mjs config/c.json", 'bash -ec "node core/scripts/copies.mjs config/c.json"', 'pwsh -NoProfile -Command "node core/scripts/copies.mjs config/c.json"']
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a wrapper's and a shell's own options pass to the run");
const shared = { ".github/actions/t/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node core/scripts/agent-tools.mjs l.json\n      shell: bash\n" };
ok(JSON.stringify(runsOwn(inMemory({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/t" }] } } }, "b.yml": { jobs: { j: { steps: [{ run: "node core/scripts/licences.mjs l.json" }, { uses: "./.github/actions/t" }] } } } }, shared), "agent-tools.mjs").map(r => r.from))
  === JSON.stringify([".github/workflows/a.yml", ".github/workflows/b.yml"]), "an action two workflows use counts for each");
ok(notRead("packages", { "s.yml": coreCall("signatures.yml", { directory: "../x" }) }) && notRead("copies", {}, {}, "| *copies check* | `core/scripts/copies.mjs` with `../c.json` |\n")
  && notRead("sizes", {}, {}, "| *size marks* | `/abs/s.json` |\n") && notRead("copies", { "a.yml": coreCall("copies.yml", { config: "..\\x.json", sizes: "s.json" }) }),
  "a folder, a slot or a call's file outside the project, a Windows one too, is not read");
ok(nugetOf("node core/scripts/nuget.mjs --imports\nnode core/scripts/nuget.mjs config/n.json --packages restored") === "config/n.json", "the NuGet check run to list imports reads no config");
let failOnce = true;
const flaky = { ...inMemory({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/t" }] } } }, "b.yml": stepped("node core/scripts/copies.mjs config/b.json") }), read: f => { if (failOnce) { failOnce = false; throw new Error("once"); } return null; } };
try { configs(flaky); } catch { /* (the first reading throws) */ }
ok(configs(flaky).copies === "config/b.json", "a reading that throws keeps nothing, so the next reads every step");
// (the review of eb6c597: every option of a wrapper passed, and a run behind one it cannot follow said not read; a
// here-document's end found in one pass; a "((" with no "))" opens two subshells; a path spelled for Windows in a call or a slot not read)
ok(copiesOf({ "a.yml": stepped("sudo -E -H node core/scripts/copies.mjs config/c.json") }) === "config/c.json"
  && notRead("copies", { "a.yml": stepped("sudo -u bot node core/scripts/copies.mjs config/c.json") }) && copiesOf({ "a.yml": stepped("bash -o pipefail -c 'node core/scripts/copies.mjs config/c.json'") }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("pwsh -ExecutionPolicy Bypass -Command 'node core/scripts/copies.mjs config/c.json'") }) === "config/c.json",
  "every option of a wrapper is passed, a shell's options with their values too, and a run behind a wrapper's option's value is not read");
const opened = linear((n, k) => copiesOf({ "a.yml": stepped(`${"cat <<EOF\n".repeat(n)}node core/scripts/copies.mjs config/c${k}.json`) }) === `config/c${k}.json`, 500, 8000);
ok(opened.right && opened.linear, "here-documents with no end leave every line read, in one pass", opened.shown);
ok(notRead("copies", { "a.yml": stepped("((echo a) ; cat <<EOF)\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }), "a \"((\" with no \"))\" hides no here-document after it");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "config\\c.json", sizes: "s.json" }) }) && notRead("packages", { "s.yml": coreCall("signatures.yml", { directory: "app\\web" }) })
  && notRead("copies", {}, {}, "| *copies check* | `core/scripts/copies.mjs` with `C:/c.json` |\n"), "a path a call or a slot spells for Windows is not read");
// (Codex's review of eb6c597: a redirection's file is no argument, a command after then or do is read, and a command
// string the outer shell fills is not read)
ok(["node core/scripts/copies.mjs > check.log config/c.json", "node core/scripts/copies.mjs 2>&1 config/c.json", "node core/scripts/copies.mjs 2> err.log config/c.json", "node core/scripts/copies.mjs &>out config/c.json",
  "if test -f config/c.json; then node core/scripts/copies.mjs config/c.json; fi", "for f in a; do node core/scripts/copies.mjs config/c.json; done", "node core/scripts/copies.mjs config/c.json < /dev/null"]
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a redirection's file is no argument, and a command after then or do is read");
ok(notRead("copies", { "a.yml": stepped(`bash -c "node core/scripts/copies.mjs '$CONFIG'"`) }), "a command string the outer shell fills when it runs is not read");
// (the review of 3537f48: a run behind a wrapper's option said not read only where a node run of the copy's script
// follows; and a long line of "((" read in one pass)
ok(["sudo chmod +x core/scripts/copies.mjs", "time echo core/scripts/copies.mjs", "sudo -u bot cp core/scripts/copies.mjs.bak y"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json")
  && notRead("copies", { "a.yml": stepped("sudo -u node node core/scripts/copies.mjs config/c.json") }) && notRead("copies", { "a.yml": stepped("bash -e ci/run.sh core/scripts/copies.mjs") }) && notRead("copies", { "a.yml": stepped("sudo -u bot node tools/scripts/copies.mjs") }),
  "a wrapper's command that runs no node of the copy's script is no run, and one whose node the reader cannot place, or a file given it, is not read");
const parens = linear((n, k) => copiesOf({ "a.yml": stepped(`${"(".repeat(n)}\nnode core/scripts/copies.mjs config/c.json\n# ${k}`) }) === "config/c.json", 3125, 50000);
ok(parens.right && parens.linear, "a long line of \"((\" is read in one pass", parens.shown);
// (the review of 2240d78 and 9246a3b: a node run behind a wrapper's option with node's own options, or held in one
// word, and one after a keyword, said not read; >| and {fd}> are redirections)
ok(["sudo -u bot node --no-warnings core/scripts/copies.mjs config/c.json", "sudo -u bot node -r x core/scripts/copies.mjs config/c.json", "env -S 'node core/scripts/copies.mjs config/c.json'",
  "if true; then sudo -u bot node core/scripts/copies.mjs config/c.json; fi", "for a in b; do sudo -u bot node core/scripts/copies.mjs config/c.json; done"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a node run behind a wrapper's option, with node's own options, in one word, or after a keyword, is not read");
ok(copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs >|log config/c.json") }) === "config/c.json" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs {fd}>log config/c.json") }) === "config/c.json",
  "a redirection that writes over a file, or names its descriptor, takes no argument");
// (Codex's review of 2240d78: a node run of the copy's script behind any word the reader does not know is not read; a
// brace expansion is filled when it runs)
ok(notRead("copies", { "a.yml": stepped("timeout 60s node core/scripts/copies.mjs config/c.json") }) && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs config/{copies,other}.json") })
  && copiesOf({ "a.yml": stepped('node core/scripts/copies.mjs "config/{c}.json"') }) === "config/{c}.json",
  "a node run of the script behind a word the reader does not know, and an unquoted brace expansion, are not read; a quoted brace is text");

done("steps-run-wrappers");
