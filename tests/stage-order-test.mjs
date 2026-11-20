// Tests the order of a pull request's checks and reviews (scripts/stage-order.mjs; tasks/reviews.md, point 10, "The
// order follows cost"; #397): each input read from a set-up made for it (the host's answer, the workflows, the merged
// pull requests, the session's word on its usage warning), the order that follows from each, and nothing read said so
// and failing nothing. Through a stand-in for gh, which never reaches the network. Its tests workflow runs this on every
// pull request here. Node's own modules and the core's yaml package.
//
//   node tests/stage-order-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { billedOf, byThemselves, isTool, main, order, rateOf, read, said } from "../scripts/stage-order.mjs";
import { NONE } from "../scripts/tools-read.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };

// ---- each input ----
ok(rateOf(["ubuntu-latest", "macos-14"]) === 10 && rateOf(["windows-2022", "ubuntu-24.04"]) === 2 && rateOf(["ubuntu-latest"]) === 1 && rateOf(["self-hosted", "linux"]) === null && rateOf([]) === null,
  "the rate is the costliest of the host's runners a suite takes, a Linux minute 1, Windows 2, macOS 10; none where no runner is the host's");
const w = runners => ({ testRunners: runners });
ok(billedOf(false, w(["hosted"])) === false && billedOf(null, w(["hosted"])) === null && billedOf(true, w(["hosted", "own"])) === true && billedOf(true, w(["own"])) === false && billedOf(true, w([])) === false && billedOf(true, w([null])) === null,
  "the proof is billed where the repository is private and a suite runs on the host's runners; not where it is public, or runs on the owner's runner or nowhere on the host; not read where the host did not say or a runner could not be read");
ok(isTool("chatgpt-codex-connector[bot]", "Codex") && isTool("Claude Code", "claude code") && !isTool("chatgpt-codex-connector[bot]", "Claude Code") && !isTool("code-helper[bot]", "Claude Code") && !isTool("Codex", "Codex Cloud") && !isTool("a-codex-fan", "Codex"),
  "a reviewer is a tool by the same name, or a bot whose login holds the tool's first word as a word of its own; a person's login, or another word of the name, matches nothing");
const bot = (login, body = "") => ({ login, type: "Bot", body }), person = (body, login = "o") => ({ login, type: "User", body });
const pulls = [
  { number: 3, login: "o", reviews: [bot("asked-reviewer[bot]")], comments: [person("@asked-reviewer review")] },
  { number: 2, login: "o", reviews: [], comments: [bot("self-reviewer[bot]", "Summary"), person("@someone review", "outsider")] },
  { number: 1, login: "dep-bot[bot]", reviews: [], comments: [bot("dep-bot[bot]", "Bump")] },
];
ok(byThemselves(pulls, "o").join() === "self-reviewer[bot]", "a bot's review starts by itself where no comment of the owner's or a bot's asked one by mention; another account's ask is no ask (floor rule 4), and a bot's comment on its own pull request is no review", byThemselves(pulls, "o").join());

// ---- the order that follows ----
const stages = o => o.stages.join("\n");
let o = order({});
ok(o.stages.length === 2 && /own run.*select\.mjs/.test(o.stages[0]) && /every review together, as before, nothing being read/.test(o.stages[1]) && !o.short.length, "nothing read: the session's own run, then every stage together when the pull request is ready, as before", stages(o));
o = order({ billed: false, builders: [[NONE, 2]], reviewers: ["r[bot]"] });
ok(o.stages.length === 2 && /nothing read being short/.test(o.stages[1]), "read, and nothing short: every stage together after the session's own run", stages(o));
o = order({ billed: true, rate: 2, builders: [["Claude Code", 3]], reviewers: ["Claude Code", "codex-app[bot]"], themselves: ["codex-app[bot]"] });
ok(o.short.map(s => s.kind).join() === "proof,review" && /2× a Linux minute/.test(o.short[0].said) && /^on the draft: every review/.test(o.stages[1]) && /^last, once: the pull request marked ready, and the host's checks/.test(o.stages[2]) && /starts by itself \(codex-app\[bot\]\)/.test(o.stages[2]),
  "a billed proof outranks a building tool's allowance: the reviews on the draft, the proof last, once, a review that starts by itself starting with it", stages(o));
o = order({ billed: true, builders: [["Claude Code", 3]], reviewers: ["Claude Code", "codex-app[bot]"], warning: "Codex" });
ok(o.short[0].said.includes("Codex, which shows its usage warning") && /host's checks and the reviews by Claude Code, together/.test(o.stages[1]) && /^last, once the checks passed .*a session of Codex gives/.test(o.stages[2]),
  "the tool under its usage warning outranks the billed proof: its reviews last, once the checks passed and the others hold nothing blocking", stages(o));
o = order({ billed: false, builders: [["Claude Code", 30]], reviewers: ["Claude Code", "codex-app[bot]"], themselves: ["codex-app[bot]"] });
ok(/host's checks and the reviews by codex-app\[bot\], together/.test(o.stages[1]) && /a session of Claude Code gives/.test(o.stages[2]) && !/starts by itself/.test(o.stages[2]), "a tool that builds is short for reviewing too: its reviews last", stages(o));
o = order({ billed: false, builders: [["Codex", 2]], reviewers: ["chatgpt-codex-connector[bot]"], themselves: ["chatgpt-codex-connector[bot]"] });
ok(/^the pull request marked ready: the host's checks$/.test(o.stages[1]) && /has started at the ready, and is waited for and read/.test(o.stages[2]), "a building tool's review that starts by itself is said to have started already, and is waited for and read", stages(o));

// ---- read from a set-up made for each, through a stand-in for gh ----
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "stage-order-test-"));
try {
  const flows = path.join(scratch, "workflows");
  fs.mkdirSync(flows);
  fs.writeFileSync(path.join(flows, "ci.yml"), "on: [pull_request]\njobs:\n  test:\n    runs-on: macos-14\n    steps:\n      - run: node core/scripts/shape.mjs checks/shape.json --suite unit -- node --test\n");
  const sig = tool => `\n\n🤖 Generated with [${tool}](https://example.invalid/x)`;
  const gh = priv => args => {
    const r = args.find(a => /^repos\//.test(a)) ?? "";
    if (args.includes("--jq")) return JSON.stringify({ login: "o", type: "User" });
    if (/contents\/core-manifest\.md$/.test(r)) throw new Error("404");
    if (/^repos\/o\/r$/.test(r)) { if (priv === null) throw new Error("HTTP 403"); return JSON.stringify({ private: priv, owner: { login: "o", type: "User" } }); }
    if (/pulls\?state=closed/.test(r)) return JSON.stringify(/page=1\b/.test(r) ? [{ user: { login: "o", type: "User" }, number: 4, merged_at: "2026-11-01T00:00:00Z", body: `x${sig("Claude Code")}` }] : []);
    if (/pulls\/4\/reviews/.test(r)) return JSON.stringify(/page=1\b/.test(r) ? [{ user: { login: "codex-app[bot]", type: "Bot" }, body: "" }] : []);
    if (/issues\/4\/comments/.test(r)) return "[]";
    throw new Error(`no answer for ${r}`);
  };
  let r = read({ repo: "o/r", dir: flows, ask: gh(true), local: false });
  ok(r.priv === true && r.billed === true && r.rate === 10 && r.builders[0][0] === "Claude Code" && r.reviewers.join() === "codex-app[bot]" && r.themselves.join() === "codex-app[bot]",
    "it reads the host's word that the repository is private, the macOS runner a suite takes, who built and reviewed the last merged pull request, and the review that started by itself", JSON.stringify(r));
  let out = said("o/r", r);
  ok(/the proof: billed, .*10× a Linux minute/.test(out) && /built by Claude Code 1; reviewed by codex-app\[bot\]; starting by themselves: codex-app\[bot\]/.test(out) && /usage warning: not said/.test(out) && /short, most first: the billed proof, at 10× a Linux minute; the allowance of Claude Code, which builds/.test(out) && /3\. last, once: the pull request marked ready/.test(out) && /overrides it/.test(out),
    "it prints what it read, what is short and the order, and that the owner's word overrides it", out);
  out = said("o/r", read({ repo: "o/r", dir: path.join(scratch, "none"), ask: () => { throw new Error("no gh"); }, local: false }));
  ok(/the proof: not read: the host did not say/.test(out) && /the merged pull requests: not read/.test(out) && /every review together, as before/.test(out), "where the host answers nothing, it says so, and every stage starts together", out);
  out = said("o/r", read({ repo: "o/r", dir: flows, ask: gh(false), local: false, warning: "Claude\n::error::x" }));
  ok(/not billed, the repository being public/.test(out) && /shown, for Claude/.test(out) && !out.includes("\n::"), "a public repository's proof is not billed, and the session's word on its warning is printed, never starting a line of the log", out);
  const lines = [];
  ok(main(["--repo", "../x"], { say: l => lines.push(l), here: "o/r" }) === 0 && /nothing was read/.test(lines[0]) && main(["--repo", "o/r", "--last", "0"], { say: l => lines.push(l) }) === 0 && /nothing was read/.test(lines[1]),
    "a repository or a count of no form is said, and fails nothing");
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
