// Tests the reader of where a project's tests run and who pays (scripts/runners.mjs; tasks/tests.md, "The slow suites
// run once per batch, wherever they run"; #733, point 6): each kind of project read from its workflows and its host, a
// row of the manifest overriding a reading, the advice where a public repository takes a runner of its own, and a run
// told no repository refused with its mend (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/runners-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { main, read, runnersRow, workflowsIn } from "../scripts/runners.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };

// A project's workflows, each { name: text }, in a folder of its own; a host that says whether the repository is
// private (null: it does not answer).
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "runners-test-"));
let n = 0;
const flows = files => { const dir = path.join(scratch, String(n++)); fs.mkdirSync(dir); for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), t); return dir; };
const host = priv => () => { if (priv === null) throw new Error("HTTP 403"); return JSON.stringify({ private: priv }); };
// (a job runs the tests where it starts a suite through the shape check, as every suite is started)
const suite = "      - run: node core/scripts/shape.mjs checks/shape.json --suite unit -- npm test\n";
const ci = `on:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n${suite}`;
const own = `on: [pull_request]\njobs:\n  test:\n    runs-on: [self-hosted, linux]\n    steps:\n${suite}`;
const nightly = "on:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  look:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node look.mjs\n";

try {
  const rel = "| *users get* | `releases` |\n";
  let r = read({ repo: "o/n", dir: flows({ "ci.yml": ci }), gh: host(false) });
  ok(r.cadence === "merge" && /before its merge/.test(r.when), "where no row says users get a release, every merge goes live, and the slow suites run on each pull request, as now", r.when);
  r = read({ repo: "o/n", dir: flows({ "ci.yml": ci }), manifest: rel, gh: host(false) });
  ok(r.where === "hosted" && !r.billed && r.cadence === "hourly" && /the host's free minutes, the repository being public/.test(r.said[1]) && !r.advice, "a public repository on the host's runners: free, the slow suites once an hour", r.said.join(" | "));
  r = read({ repo: "o/n", dir: flows({ "ci.yml": ci }), manifest: rel, gh: host(true) });
  ok(r.where === "hosted" && r.billed && r.cadence === "nightly", "a private one: minutes billed, the slow suites once a night", r.said.join(" | "));
  r = read({ repo: "o/n", dir: flows({ "ci.yml": own }), manifest: rel, gh: host(true) });
  ok(r.where === "self-hosted" && r.cadence === "nightly" && !r.advice, "a private one on a runner of the owner's own: once a night, the machine's hours being the cost", r.said.join(" | "));
  r = read({ repo: "o/n", dir: flows({ "ci.yml": own }), gh: host(false) });
  ok(r.where === "self-hosted" && /stranger's pull request would run its code/.test(r.advice ?? "") && /needs-owner/.test(r.advice ?? ""), "a public one on a runner of the owner's own: the owner is advised once, nothing waits", r.advice);
  r = read({ repo: "o/n", dir: flows({ "look.yml": nightly }), manifest: rel, gh: host(false) });
  ok(r.where === "local" && r.cadence === "release" && /computer alone/.test(r.said[0]), "no workflow on a pull request or a push: the tests run on a computer, the slow suites before each release", r.said[0]);
  r = read({ repo: "o/n", dir: path.join(scratch, "none"), gh: host(false) });
  ok(r.where === "local", "no workflows at all: a computer alone");
  r = read({ repo: "o/n", dir: flows({ "ci.yml": ci }), manifest: rel, gh: host(null) });
  ok(r.billed && r.cadence === "nightly" && /was not read, so taken as billed/.test(r.said[1]), "a host that does not say whether the repository is private: taken as billed, and said so", r.said[1]);
  const matrix = `on: push\njobs:\n  test:\n    strategy:\n      matrix:\n        os: [ubuntu-latest, self-hosted]\n    runs-on: \${{ matrix.os }}\n    steps:\n${suite}`;
  ok(workflowsIn(flows({ "m.yml": matrix })).testRunners.join() === "own" && workflowsIn(flows({ "c.yml": ci })).testRunners.join() === "hosted", "a runner of its own named in the matrix that runs-on takes is read too, and the host's where only its labels name it");
  const group = `on: push\njobs:\n  test:\n    runs-on:\n      group: ours\n    steps:\n${suite}`;
  ok(read({ repo: "o/n", dir: flows({ "g.yml": group }), gh: host(true) }).where === "self-hosted", "a runner group is read as the owner's own");
  r = read({ repo: "o/n", dir: flows({ "l.yml": `on: push\njobs:\n  test:\n    runs-on: big-box\n    steps:\n${suite}` }), gh: host(true) });
  ok(r.where === "self-hosted" && /could not be read, so taken as the owner's own/.test(r.said[0]), "a label of the project's own is not read, taken as the owner's own and said so", r.said[0]);
  r = read({ repo: "o/n", dir: flows({ "ci.yml": "on: [pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n" }), gh: host(false) });
  ok(r.where === "local", "a job that starts no suite through the shape check runs no tests here, whatever it runs");
  const hostedMatrix = `on: pull_request\njobs:\n  test:\n    strategy:\n      matrix:\n        os: [ubuntu-latest, windows-latest]\n        node: ["20.x"]\n    runs-on: \${{ matrix.os }}\n    steps:\n${suite}`;
  const fromJson = `on: pull_request\njobs:\n  test:\n    strategy:\n      matrix:\n        include: \${{ fromJSON(github.event_name == 'push' && '[{"os":"ubuntu-latest","node":".nv"}]' || '[{"os":"windows-latest","suite":"x"}]') }}\n    runs-on: \${{ matrix.os }}\n    steps:\n${suite}`;
  const called = "on: pull_request\njobs:\n  review:\n    uses: ./.github/workflows/other.yml\n";
  r = read({ repo: "o/n", dir: flows({ "m.yml": hostedMatrix, "j.yml": fromJson, "c.yml": called }), manifest: rel, gh: host(false) });
  ok(r.where === "hosted" && r.cadence === "hourly" && !r.advice, "a matrix whose runs-on key takes only the host's labels, beside other keys, in a list or in fromJSON's literals, reads as the host's, and a job that calls a workflow takes no runner", r.said.join(" | ") + (r.advice ?? ""));
  r = read({ repo: "o/n", dir: flows({ "ci.yml": ci, "deploy.yml": "on: push\njobs:\n  deploy:\n    runs-on: self-hosted\n    steps:\n      - run: ./deploy\n" }), manifest: rel, gh: host(false) });
  ok(r.where === "hosted" && r.cadence === "hourly" && /forks off that job/.test(r.advice ?? ""), "a deploy job on the owner's machine is not where the tests run, but in a public repository it is advised on all the same", r.advice);
  const bad = workflowsIn(flows({ "ci.yml": ci, "broken.yml": "on: [\n" }));
  ok(bad.onHost && bad.unread.includes("broken.yml"), "a workflow that cannot be read is named, and the rest still read");
  // A row of the manifest overrides each reading, and what was read is still said.
  const rows = "| *test runners* | `local` |\n| *billed minutes* | `no` |\n| *users get* | `releases` |\n";
  r = read({ repo: "o/n", dir: flows({ "ci.yml": ci }), manifest: rows, gh: host(true) });
  ok(r.where === "local" && !r.billed && /manifest's row \*test runners\* says \(read: hosted\)/.test(r.said[0]) && /manifest's row \*billed minutes\* says/.test(r.said[1]), "rows of the manifest override the readings, which are still printed", r.said.join(" | "));
  ok(runnersRow("| *test runners* | `the cloud` |") === undefined && runnersRow("| *test runners* | `self-hosted` |") === "self-hosted", "a row with no value the slot takes overrides nothing");
  // The program: a repository not named is refused, with its mend.
  let said = "";
  const err = console.error; console.error = l => { said += `${l}\n`; };
  const status = main(["--repo", "../.."], { gh: host(false), say: () => {} });
  console.error = err;
  ok(status === 1 && mended(said), "a repository not named as <owner>/<name> is refused, saying its mend", said);
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }

console.log(failed ? `${failed} of ${count} failed` : `${count} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
