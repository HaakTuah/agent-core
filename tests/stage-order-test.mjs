// Tests the order of a pull request's checks and reviews (scripts/stage-order.mjs; tasks/reviews.md, point 10, "The
// order follows cost"; #397): each input read from a set-up made for it (the host's answer, the workflows, the merged
// pull requests, the session's word on its usage warning), the order that follows from each, and nothing read said so
// and failing nothing. Through a stand-in for gh, which never reaches the network. Its tests workflow runs this on every
// pull request here. Node's own modules and the core's yaml package.
//
//   node tests/stage-order-test.mjs
import fs from "node:fs";
import path from "node:path";
import { billedOf, byThemselves, isTool, known, main, order, rateOf, read, said } from "../scripts/stage-order.mjs";
import { NONE } from "../scripts/tools-read.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };

// ---- each input ----
ok(rateOf(["ubuntu-latest", "macos-14"]) === 10 && rateOf(["windows-2022", "ubuntu-24.04"]) === 2 && rateOf(["ubuntu-latest"]) === 1 && rateOf(["self-hosted", "linux"]) === null && rateOf([]) === null,
  "the rate is the costliest of the host's runners a suite takes, a Linux minute 1, Windows 2, macOS 10; none where no runner is the host's");
const w = runners => ({ testRunners: runners });
ok(billedOf(false, w(["hosted"])) === false && billedOf(null, w(["hosted"])) === null && billedOf(true, w(["hosted", "own"])) === true && billedOf(true, w(["own"])) === false && billedOf(true, w([])) === false && billedOf(true, w([null])) === null,
  "the proof is billed where the repository is private and a suite runs on the host's runners; not where it is public, or runs on the owner's runner or nowhere on the host; not read where the host did not say or a runner could not be read");
ok(billedOf(true, { testRunners: [], unknown: true, unread: [] }) === null && billedOf(true, { testRunners: ["own"], unknown: false, unread: ["ci.yml"] }) === null && billedOf(true, { testRunners: ["hosted"], unknown: true, unread: ["ci.yml"] }) === true && billedOf(false, { testRunners: [], unknown: true, unread: [] }) === false,
  "with no suite read on the host's runners, a workflow a job calls that is not read, or a file not read, leaves a private repository's proof not read, never not billed (Codex's finding on #898)");
ok(isTool("chatgpt-codex-connector[bot]", "Codex") && isTool("Claude Code", "claude code") && !isTool("chatgpt-codex-connector[bot]", "Claude Code") && !isTool("code-helper[bot]", "Claude Code") && !isTool("Codex", "Codex Cloud") && !isTool("a-codex-fan", "Codex"),
  "a reviewer is a tool by the same name, or a bot whose login holds the tool's first word as a word of its own; a person's login, or another word of the name, matches nothing");
ok(isTool("copilot-pull-request-reviewer[bot]", "GitHub Copilot") && !isTool("github-actions[bot]", "GitHub Copilot") && !isTool("github-advanced-security[bot]", "GitHub Copilot"),
  "the host's own name is no tool's word: a bot of the host is not grouped with GitHub Copilot (the security review's finding on #898)");
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
ok(o.short.map(s => s.kind).join() === "proof,review" && /2× a Linux minute/.test(o.short[0].said) && o.stages.length === 4 && /^on the draft: every review not named below/.test(o.stages[1])
  && /^on the draft, once those before hold nothing blocking: every review a session of Claude Code gives/.test(o.stages[2]) && /^last, once: the pull request marked ready, and the host's checks/.test(o.stages[3]) && /starts by itself \(codex-app\[bot\]\)/.test(o.stages[3]),
  "a billed proof outranks a building tool's allowance: the reviews that spend nothing short on the draft first, then the building tool's, the proof last, once, a review that starts by itself starting with it (the design check's finding on #898)", stages(o));
o = order({ billed: true, builders: [["Claude Code", 3]], reviewers: ["Claude Code", "codex-app[bot]"], warning: "Codex" });
ok(o.short.map(s => s.kind).join() === "review,proof,review" && o.short[0].said.includes("Codex, which shows its usage warning") && o.stages.length === 5 && /^on the draft: every review not named below/.test(o.stages[1])
  && /a session of Claude Code gives/.test(o.stages[2]) && /^once: the pull request marked ready/.test(o.stages[3]) && /^last, once the checks passed .*a session of Codex gives/.test(o.stages[4]) && !/design check/.test(stages(o)),
  "the tool under its usage warning outranks the billed proof, which outranks a building tool: each stage that spends something short after those that spend less, the warned tool's reviews last, and no review named as an example in two stages", stages(o));
o = order({ billed: true, builders: [["Claude Code", 3]], reviewers: ["Claude Code", "codex-app[bot]", "chatgpt-codex-connector[bot]", "r[bot]"], themselves: ["codex-app[bot]", "chatgpt-codex-connector[bot]", "r[bot]"], warning: "Codex" });
ok(["codex-app[bot]", "chatgpt-codex-connector[bot]", "r[bot]"].every(b => o.stages.filter(x => x.includes(b)).length === 1) && /starts by itself \(codex-app\[bot\], chatgpt-codex-connector\[bot\], r\[bot\]\)/.test(o.stages[3]),
  "with the proof billed, a review that starts by itself is named once, in the stage it starts in, never also on the draft (the design check's finding 5 on #898)", stages(o));
o = order({ billed: false, builders: [["Claude Code", 3], ["Codex", 2]], reviewers: ["Claude Code"] });
ok(/a session of Claude Code or Codex gives/.test(stages(o)) && !/Claude Code, Codex gives/.test(stages(o)), "one stage's tools are joined with \"or\" (the design check's finding 3 on #898)", stages(o));
o = order({ billed: false, builders: [["Claude Code", 3]], reviewers: ["Claude Code"], warning: "claude code" });
ok(o.short.length === 1 && o.stages.length === 3, "a tool under its warning that also builds is short once, at its higher rank", JSON.stringify(o.short));
o = order({ billed: false, builders: [["Claude Code", 30]], reviewers: ["Claude Code", "codex-app[bot]"], themselves: ["codex-app[bot]"] });
ok(/host's checks, the reviews by codex-app\[bot\] and every review not named below, asked or starting by itself, together/.test(o.stages[1]) && /^last, .*a session of Claude Code gives/.test(o.stages[2]) && !/starts by itself \(/.test(o.stages[2]), "a tool that builds is short for reviewing too: its reviews last", stages(o));
o = order({ billed: false, builders: [["Claude Code", 1]], reviewers: [] });
ok(/^the pull request marked ready: the host's checks, every review not named below, asked or starting by itself, together$/.test(o.stages[1]), "with no reviewer read, the stage after the session's run still names every other review, so none is left out (the security review's finding on #898)", stages(o));
o = order({ billed: false, builders: [["Codex", 2]], reviewers: ["chatgpt-codex-connector[bot]"], themselves: ["chatgpt-codex-connector[bot]"] });
ok(/^the pull request marked ready: the host's checks, every review not named below/.test(o.stages[1]) && /has started at the ready, and is waited for and read/.test(o.stages[2]), "a building tool's review that starts by itself is said to have started already, and is waited for and read", stages(o));
o = order({ billed: true, builders: [[NONE, 2]], reviewers: [] });
ok(/^on the draft: every review not named below/.test(o.stages[1]) && /^last, once: .*; any review that starts by itself starts then/.test(o.stages[2]), "with the proof last and no reviewer read, a review that starts by itself is still said to start with it", stages(o));

// ---- names from the record, whoever wrote them ----
ok(known("Claude Code") && known("codex") && known("chatgpt-codex-connector[bot]") && !known("Some Tool") && !known("x\n::error::y[bot]") && !known("a b[bot]") && !known("[bot]") && !known(""),
  "a name from the record stands in the order only where it is a tool the core knows or a bot's login of the plain form");
ok(byThemselves([{ number: 1, login: "o", reviews: [bot("r[bot]")], comments: [person("x\n@r review"), person("@r reviewing"), person("@r review", "outsider")] }], "o").join() === "r[bot]",
  "an ask is a comment of the owner's or a bot's that opens with the mention: one inside the text, another word, or another account's ask, is none");

// ---- read from a set-up made for each, through a stand-in for gh ----
const scratch = scratchDir("stage-order-test-");
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
  ok(/the proof: billed, .*10× a Linux minute/.test(out) && /built by Claude Code 1; reviewed by codex-app\[bot\]; starting by themselves: codex-app\[bot\]/.test(out) && /usage warning: not said/.test(out) && /short, most first: the billed proof, at 10× a Linux minute; the allowance of Claude Code, which builds/.test(out) && /4\. last, once: the pull request marked ready/.test(out) && /overrides it/.test(out),
    "it prints what it read, what is short and the order, and that the owner's word overrides it", out);
  out = said("o/r", read({ repo: "o/r", dir: path.join(scratch, "none"), ask: () => { throw new Error("no gh"); }, local: false }));
  ok(/the proof: not read: the host did not say/.test(out) && /the merged pull requests: not read/.test(out) && /every review together, as before/.test(out), "where the host answers nothing, it says so, and every stage starts together", out);
  out = said("o/r", read({ repo: "o/r", dir: flows, ask: gh(false), local: false, warning: "Claude\n::error::x" }));
  ok(/not billed, the repository being public/.test(out) && /shown, for Claude/.test(out) && !out.includes("\n::"), "a public repository's proof is not billed, and the session's word on its warning is printed, never starting a line of the log", out);
  r = read({ repo: "o/r", dir: null, ask: gh(true), local: false });
  out = said("o/r", r);
  ok(r.billed === null && r.elsewhere && /the proof: not read: the workflows are read only from the repository's own checkout/.test(out) && !/not billed/.test(out),
    "another repository's proof is not read from the checkout's workflows, and says so (Codex's finding on #898)", out);
  fs.writeFileSync(path.join(flows, "call.yml"), "on: [pull_request]\njobs:\n  call:\n    uses: someone/else/.github/workflows/t.yml@v1\n");
  fs.writeFileSync(path.join(flows, "ci.yml"), "on: [pull_request]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo lint\n");
  out = said("o/r", read({ repo: "o/r", dir: flows, ask: gh(true), local: false }));
  ok(/the proof: not read: a job's runner, a workflow a job calls/.test(out), "a private repository whose suite runs through a workflow of another repository is not read as unbilled", out);
  const hostile = args => {
    const r = args.find(a => /^repos\//.test(a)) ?? "";
    if (/pulls\?state=closed/.test(r)) return JSON.stringify(/page=1\b/.test(r) ? [
      { user: { login: "dep[bot]", type: "Bot" }, number: 6, merged_at: "2026-11-02T00:00:00Z", body: `notes${sig("Claude Code")}` },
      { user: { login: "o", type: "User" }, number: 5, merged_at: "2026-11-01T00:00:00Z", body: `x${sig("Some Tool")}` }] : []);
    if (/pulls\/[56]\/reviews/.test(r)) return JSON.stringify(/page=1\b/.test(r) ? [{ user: { login: "x\n::error::y[bot]", type: "Bot" }, body: "" }, { user: { login: "o", type: "User" }, body: `x${sig("Odd\n::error::")}` }] : []);
    if (/issues\/[56]\/comments/.test(r)) return "[]";
    return gh(true)(args);
  };
  r = read({ repo: "o/r", dir: flows, ask: hostile, local: false });
  out = said("o/r", r);
  ok(r.builders.map(([n, k]) => `${n} ${k}`).join() === `${NONE} 2` && !r.reviewers.length && !order(r).short.some(s => s.kind === "review") && !/Some Tool|::error/.test(out),
    "a builder a bot's pull request names, a tool the core does not know and a login of no plain form are passed over, and none reaches what is short or the order", out);
  out = said("o/r", read({ repo: "o/r", dir: path.join(scratch, "a", "b", "workflows"), ask: gh(true), local: false }));
  ok(/the proof: not read: no workflows folder was found here/.test(out), "a workflows folder missing outside a checkout's root leaves a private repository's proof not read (the security review's finding on #898)", out);
  fs.mkdirSync(path.join(scratch, "root", ".git"), { recursive: true });
  ok(read({ repo: "o/r", dir: path.join(scratch, "root", ".github", "workflows"), ask: gh(true), local: false }).billed === false, "and a checkout's root with none is not billed");
  fs.mkdirSync(path.join(scratch, "root", ".github"));
  fs.symlinkSync(path.join(scratch, "gone"), path.join(scratch, "root", ".github", "workflows"));
  ok(read({ repo: "o/r", dir: path.join(scratch, "root", ".github", "workflows"), ask: gh(true), local: false }).billed === null, "a dangling link for the folder leaves the proof not read, never not billed");
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const shut = path.join(scratch, "shut", ".github", "workflows");
    fs.mkdirSync(shut, { recursive: true }); fs.mkdirSync(path.join(scratch, "shut", ".git")); fs.chmodSync(shut, 0);
    try { ok(read({ repo: "o/r", dir: shut, ask: gh(true), local: false }).billed === null, "a folder that is there but cannot be listed leaves the proof not read, never not billed (the fallback security review's finding 1 on 5e6e651c)"); } finally { fs.chmodSync(shut, 0o755); }
  } else console.log("skip a folder that cannot be listed: run as root or on Windows, where a folder's rights do not stop its listing");
  fs.mkdirSync(path.join(scratch, "file", ".github"), { recursive: true }); fs.mkdirSync(path.join(scratch, "file", ".git"));
  fs.writeFileSync(path.join(scratch, "file", ".github", "workflows"), "x");
  fs.mkdirSync(path.join(scratch, "link", ".git"), { recursive: true }); fs.symlinkSync(path.join(scratch, "gone"), path.join(scratch, "link", ".github"));
  ok(["file", "link"].every(d => read({ repo: "o/r", dir: path.join(scratch, d, ".github", "workflows"), ask: gh(true), local: false }).billed === null),
    "a file where the folder stands, or a .github that leads nowhere, leaves the proof not read (the security review's finding on #898)");
  const printed = [];
  main(["--repo", "X/Y"], { say: l => printed.push(l), here: "o/r", ask: a => { if (a.join(" ") === "api repos/X/Y") return JSON.stringify({ private: true }); throw new Error("no gh"); } });
  main(["--repo", "O/R"], { say: l => printed.push(l), here: "o/r", ask: a => { if (a.join(" ") === "api repos/O/R") return JSON.stringify({ private: true }); throw new Error("no gh"); } });
  ok(/read only from the repository's own checkout/.test(printed[0]) && !/own checkout/.test(printed[1]), "main takes the checkout's workflows for its own repository alone, in any case of its name, never for another's", printed.join("\n"));
  const lines = [];
  ok(main(["--repo", "../x"], { say: l => lines.push(l), here: "o/r" }) === 0 && /nothing was read/.test(lines[0]) && main(["--repo", "o/r", "--last", "0"], { say: l => lines.push(l) }) === 0 && /nothing was read/.test(lines[1]),
    "a repository or a count of no form is said, and fails nothing");
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
