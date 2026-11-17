// Tests the tools reader (tools-read.mjs, beside this file): the count of who built and who reviewed, from pull requests
// made here, and the reading of them through a stand-in for gh, which never reaches the network. Its tests workflow
// runs this on every pull request here. Node's own modules only.
//
//   node scripts/tools-read-test.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NONE, readPulls, said, tally } from "./tools-read.mjs";

let failed = 0, count = 0;
const ok = (cond, what, more = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${more ? `\n${more}` : ""}`); } };

const sig = tool => `\n\n🤖 Generated with [${tool}](https://example.invalid/${tool.replace(/ /g, "-")})`;
const person = (body, login = "the-owner") => ({ login, type: "User", body });
const bot = (login, body = "") => ({ login, type: "Bot", body });
const pulls = [
  { number: 3, body: `Built.${sig("Claude Code")}`, reviews: [bot("a-reviewer[bot]"), bot("a-reviewer[bot]", "again")], comments: [person(`Security review: ${"a".repeat(40)}\n\nNo findings.${sig("Claude Code")}`)] },
  { number: 2, body: `Built.${sig("Another Tool")}`, reviews: [person("Looks right.")], comments: [person(`Code review: x${sig("Another Tool")}`), person(`From a builder session, on #2:${sig("Claude Code")}`)] },
  { number: 1, body: "Bump a package.", reviews: [], comments: [bot("a-bot[bot]", "Security review: of no tool's line")] },
];
const t = tally(pulls);
ok(JSON.stringify(t.builders) === JSON.stringify([[NONE, 1], ["Another Tool", 1], ["Claude Code", 1]].sort(([a], [b]) => a.localeCompare(b))), "each pull request's builder is the tool its description's attribution line names, or none named; ties by name", JSON.stringify(t.builders));
ok(JSON.stringify(t.reviewers) === JSON.stringify([["a-bot[bot]", 1], ["a-reviewer[bot]", 1], ["Another Tool", 1], ["Claude Code", 1]]), "a bot's review counts by its login, once a pull request; a led comment by the tool it names, or a bot's login; a person's review and an unled comment count for no tool", JSON.stringify(t.reviewers));
const most = tally([pulls[0], { ...pulls[0], number: 4 }, pulls[1]]);
ok(most.builders[0][0] === "Claude Code" && most.builders[0][1] === 2 && most.reviewers[0][0] === "a-reviewer[bot]", "most first", JSON.stringify(most));
ok(tally([{ number: 9, body: `x${sig("Old Tool")}\nlater${sig("New Tool")}` }]).builders[0][0] === "New Tool", "the last attribution line names the tool");

// read through a stand-in for gh
const asked = [];
const gh = answers => args => { asked.push(args.join(" ")); const route = args[1]; const hit = Object.entries(answers).find(([k]) => route.startsWith(k)); if (!hit) throw new Error(`no answer for ${route}`); return JSON.stringify(hit[1]); };
const answers = {
  "repos/o/r/pulls?state=closed": [
    { number: 7, merged_at: "2026-11-02T00:00:00Z", body: `a${sig("Claude Code")}` }, { number: 8, merged_at: null, body: "closed unmerged" },
    { number: 6, merged_at: "2026-11-03T00:00:00Z", body: `b${sig("Another Tool")}` }, { number: 5, merged_at: "2026-11-01T00:00:00Z", body: "c" }],
  "repos/o/r/pulls/6/reviews": [{ user: { login: "a-reviewer[bot]", type: "Bot" }, body: "" }], "repos/o/r/pulls/7/reviews": [],
  "repos/o/r/issues/6/comments": [], "repos/o/r/issues/7/comments": [{ user: { login: "o", type: "User" }, body: `Security review: x${sig("Claude Code")}` }],
};
const read = readPulls("o/r", 2, gh(answers));
ok(read.map(p => p.number).join() === "6,7" && !asked.some(a => /\/(5|8)\//.test(a)), "the last merged pull requests, newest merge first, and nothing asked of one not taken", asked.join("\n"));
const out = said("o/r", read, tally(read));
ok(/the last 2 merged pull requests of o\/r \(#7 to #6\)/.test(out) && /built by: Another Tool 1, Claude Code 1/.test(out) && /reviewed by: a-reviewer\[bot\] 1, Claude Code 1/.test(out) && /a row written there decides/.test(out), "it prints what it read and that a row decides", out);
ok(!said("o/r", [{ number: 1 }], { builders: [["x\n::error::y", 1]], reviewers: [] }).includes("\n::"), "a name read from the record never starts a line of the log");

// the program: no repository it can name, and gh that cannot answer, are each said and fail nothing
const here = path.dirname(fileURLToPath(import.meta.url));
for (const [args, env, what] of [[["--repo", "../x"], {}, "a repository of no form"], [["--repo", "o/r", "--last", "0"], {}, "a count of no form"], [["--repo", "o/r"], { PATH: "" }, "no gh to ask"]]) {
  const r = spawnSync(process.execPath, [path.join(here, "tools-read.mjs"), ...args], { encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !(env.PATH !== undefined && /^path$/i.test(k)))), ...env } });
  ok(r.status === 0 && /^note .*the core's default stands/m.test(r.stdout), `${what}: said, and nothing fails`, r.stdout + r.stderr);
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
