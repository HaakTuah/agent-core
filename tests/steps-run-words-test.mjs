// Tests the same reading on the words of a run: a word that only holds the script's name is no run, a shell's file and
// options, the commands that fetch or install, a command that runs another, and every naming of the script a step holds,
// which is accounted for or leaves the run not read. Node's own modules.
//
//   node tests/steps-run-words-test.mjs
import { kind } from "../scripts/fresh.mjs";
import { NPX, CURL, linear, inMemory, stepped, copiesOf, notRead } from "../scripts/steps-kit.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-run-words-");

// (the review of 9358ea5: a word that only holds the script's name is no run, an expression ends the reading, and
// env's -S joined to its value is read)
ok(["time echo \"node core/scripts/copies.mjs config/c.json\"", "sudo chmod +x ${{ github.workspace }}/core/scripts/copies.mjs", "time echo ${{ github.workspace }}/core/scripts/copies.mjs"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"), "a word that only holds the script's name, quoted or filled by an expression, is no run");
ok(["env -S'node core/scripts/copies.mjs config/c.json'", "env --split-string='node core/scripts/copies.mjs config/c.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })), "env's -S joined to the commands it splits is read as giving them");
ok(copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs '$GITHUB_WORKSPACE/config/c.json'") }) === "$GITHUB_WORKSPACE/config/c.json" && notRead("copies", { "a.yml": stepped("node '$GITHUB_WORKSPACE/core/scripts/copies.mjs' c.json") }),
  "the root's name in single quotes is text, never the root");
// (the review of 1dd5dbf: a shell's file and that file's arguments are never its own commands; a command that runs no
// script names it as text; env -S read only as env's)
ok(["bash -e ./run.sh -c 'node core/scripts/copies.mjs other.json'", "bash -x script.sh -c 'node core/scripts/copies.mjs other.json'", "pwsh -File x.ps1 -Command 'node core/scripts/copies.mjs other.json'"]
  .every(line => notRead("copies", { "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }))
  && ["echo Then run node core/scripts/copies.mjs your.json", "echo env -S 'node core/scripts/copies.mjs x'"]
    .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"),
  "a shell's file given arguments that name the script is not read, never read as the file's; a command that runs no script gives no run");
const longEnv = linear((n, k) => notRead("copies", { "a.yml": stepped(`env ${"-S ".repeat(n)}'node core/scripts/copies.mjs c.json' # ${k}`) }), 1250, 20000);
ok(longEnv.right && longEnv.linear, "many of env's options are read in one pass", longEnv.shown);
// (npm known by either lock file it installs from, package-lock.json or npm-shrinkwrap.json: each reads as npm; the
// exact-versions step that asked their companion runs asks nothing from #1093 on, the licence check running that check)
ok(["package-lock.json", "npm-shrinkwrap.json"].every(f => kind({ ...inMemory({}, { [f]: "{}" }), root: tmp }).o.packages === "."),
  "a project holding npm-shrinkwrap.json in place of package-lock.json reads as npm");
// (the review of b6aaf95: a shell's options read so that its -c string is found, and a shell not given a file is not
// read silently; more commands that run no script; a wrapper that moves the folder)
ok(["sh -euo pipefail -c 'node core/scripts/copies.mjs config/c.json'", "bash -eo pipefail -c 'node core/scripts/copies.mjs config/c.json'", "pwsh -ep Bypass -Command 'node core/scripts/copies.mjs config/c.json'",
  "bash -ec -- 'node core/scripts/copies.mjs config/c.json'", "bash -ce 'node core/scripts/copies.mjs config/c.json'", "bash -c -o pipefail 'node core/scripts/copies.mjs config/c.json'",
  "powershell -NoProfile \"node core/scripts/copies.mjs config/c.json\"", "pwsh -CommandWithArgs 'node core/scripts/copies.mjs config/c.json'", "powershell -exec bypass -c 'node core/scripts/copies.mjs config/c.json'"]
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a shell's options, clustered, abbreviated or with --, leave its -c string read");
ok(["sha256sum core/scripts/copies.mjs", "jq . core/scripts/copies.mjs", `${CURL} -d 'node core/scripts/copies.mjs' x`, "Write-Host core/scripts/copies.mjs"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"), "more commands that run no script name it as text");
ok(["env -C app node ../core/scripts/copies.mjs c.json", "env --chdir=app node ../core/scripts/copies.mjs c.json", "sudo -D app node ../core/scripts/copies.mjs c.json"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a wrapper that runs the command in another folder leaves the run not read");
ok(notRead("copies", { "a.yml": stepped("source /dev/stdin <<'EOF'\nnode core/scripts/copies.mjs config/custom.json\nEOF") }) && notRead("copies", { "a.yml": stepped("bash <<EOF\nnode core/scripts/copies.mjs config/custom.json\nEOF") })
  && notRead("copies", { "a.yml": stepped("cat <<EOF > notes.md\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a here-document that names the script is not read, whatever it is fed to, since what it writes may be run");
// (the review of 744fb64: commands that run others, a path before the script in a string, PowerShell's other folder,
// and a long word, read in one pass)
ok([`${NPX} node core/scripts/copies.mjs config/c.json`, "find . -exec node core/scripts/copies.mjs config/c.json ';'", "timeout 60 bash -c 'node $GITHUB_WORKSPACE/core/scripts/copies.mjs config/c.json'",
  "timeout 60 bash -c 'cd app && node ../core/scripts/copies.mjs ../config/c.json'", "pwsh -wd app -c 'node core/scripts/copies.mjs config/c.json'", `${NPX} prettier --check core/scripts/copies.mjs`]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a command that may run others, a string the reader cannot place, and PowerShell run elsewhere, are not read");
const wordy = linear((n, k) => notRead("copies", { "a.yml": stepped(`timeout 1 '${"node ".repeat(n)}x' core/scripts/copies.mjs # ${k}`) }), 5000, 40000);
ok(wordy.right && wordy.linear, "a long word is read in one pass", wordy.shown);
// (the review of be09443 and 814895c: every naming of the script a step holds is accounted for, or the run is not
// read: a here-document piped to a shell or written to a file run later, a here-string, PowerShell's -Command given
// words, a folder changed by Push-Location)
ok(["cat <<'EOF' | bash\nnode core/scripts/copies.mjs config/custom.json\nEOF", "cat > run.sh <<'EOF'\nnode core/scripts/copies.mjs config/custom.json\nEOF\nbash run.sh",
  "bash <<<'node core/scripts/copies.mjs config/custom.json'", "pwsh -c node core/scripts/copies.mjs config/custom.json", "powershell -NoProfile -Command node ./core/scripts/copies.mjs config/custom.json",
  "pwsh -c 'Push-Location app; node ../core/scripts/copies.mjs ../config/custom.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a naming of the script the reader does not account for leaves the run not read, in whatever form of the shell's");
// (on the parser, #530: a command in $( ) or ` ` is a command, as the reader's definition parts commands at ( and ), and
// its run is read as any other)
ok(copiesOf({ "a.yml": stepped('echo "$(node core/scripts/copies.mjs config/custom.json)"') }) === "config/custom.json" && copiesOf({ "a.yml": stepped("echo `node core/scripts/copies.mjs config/custom.json`") }) === "config/custom.json",
  "a command whose output a line takes runs the script all the same, and is read as its run");
// (the review of 6757c34: commands that can run another are no text; every naming of scripts/<name> is counted, as
// a run's is matched; quotes read in one pass)
ok(["awk 'BEGIN{system(\"node core/scripts/copies.mjs bad.json\")}'", "git -c alias.r='!node core/scripts/copies.mjs bad.json' r", "sed -n '1e node core/scripts/copies.mjs bad.json' x",
  "node core//scripts/copies.mjs good.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "timeout 60 node \"$CORE_AT\"scripts/copies.mjs bad.json",
  "pwsh -c 'Push-Location app; node ../core/scripts/copies.mjs ../config/custom.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a command that can run another, a second naming beside a read run, a path joined to a variable and a folder pushed are not read");
const quotes = linear((n, k) => copiesOf({ "a.yml": stepped(`echo core/scripts/copies.mjs ${"\"\\".repeat(n)} # ${k}`) }) === "checks/copies.json", 5000, 40000);
ok(quotes.right && quotes.linear, "quotes are read in one pass", quotes.shown);
// (the review of 3085de7: a naming of scripts/<name> by any path, in any case or with quotes, ./ or // inside, is
// counted; commands that can set up a run are no text)
ok(["node my_scripts/copies.mjs x.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "node ~/work/p/core/scripts/copies.mjs bad.json", "node Core/scripts/copies.mjs bad.json",
  "node core/scripts/\"copies.mjs\" good.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "node core/scripts/./copies.mjs bad.json\ntimeout 60 node core/scripts/copies.mjs x.json",
  "gh alias set r '!node core/scripts/copies.mjs bad.json'\ngh r", "export NODE_OPTIONS='--import=./core/scripts/copies.mjs'\nnode x.mjs bad.json", "cp core/scripts/copies.mjs x.mjs\nnode x.mjs bad.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a naming by any other path, case, quote or ./ in it, and a command that sets up a run, leave the run not read");
ok(copiesOf({ "a.yml": stepped("node core/scripts//copies.mjs config/c.json") }) === "config/c.json", "a path with // in it is read as the copy's");

done("steps-run-words");
