// Tests the tools reader (scripts/tools-read.mjs): the count of who built and who reviewed, from pull requests
// made here, and the reading of them through a stand-in for gh, which never reaches the network. Its tests workflow
// runs this on every pull request here. Node's own modules only.
//
//   node tests/tools-read-test.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NONE, ownerFor, readPulls, said, tally } from "../scripts/tools-read.mjs";

let failed = 0, count = 0;
const ok = (cond, what, more = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${more ? `\n${more}` : ""}`); } };

const sig = tool => `\n\n🤖 Generated with [${tool}](https://example.invalid/${tool.replace(/ /g, "-")})`;
const person = (body, login = "the-owner") => ({ login, type: "User", body });
const bot = (login, body = "") => ({ login, type: "Bot", body });
const OWNER = "the-owner", own = { login: OWNER, type: "User" };
const pulls = [
  { ...own, number: 3, body: `Built.${sig("Claude Code")}`, reviews: [bot("a-reviewer[bot]"), bot("a-reviewer[bot]", "again")], comments: [person(`Security review: ${"a".repeat(40)}\n\nNo findings.${sig("Claude Code")}`)] },
  { ...own, number: 2, body: `Built.${sig("Another Tool")}`, reviews: [person("Looks right.")], comments: [person(`Code review: x${sig("Another Tool")}`), person(`From a builder session, on #2:${sig("Claude Code")}`)] },
  { login: "a-bot[bot]", type: "Bot", number: 1, body: "Bump a package.", reviews: [], comments: [bot("a-bot[bot]", "Security review: of no tool's line")] },
];
const t = tally(pulls, OWNER);
ok(JSON.stringify(t.builders) === JSON.stringify([[NONE, 1], ["Another Tool", 1], ["Claude Code", 1]].sort(([a], [b]) => a.localeCompare(b))), "each pull request's builder is the tool its description's attribution line names, or none named; ties by name", JSON.stringify(t.builders));
ok(JSON.stringify(t.reviewers) === JSON.stringify([["a-bot[bot]", 1], ["a-reviewer[bot]", 1], ["Another Tool", 1], ["Claude Code", 1]]), "a bot's review counts by its login, once a pull request; a led comment by the tool it names, or a bot's login; a person's review and an unled comment count for no tool", JSON.stringify(t.reviewers));
const closing = tool => `\n🤖 Generated with [${tool}](https://e.invalid)`;
const carried = tally([{ login: "dep[bot]", type: "Bot", body: `Bumps x.${closing("Some Tool")}`, reviews: [], comments: [] },
  { login: OWNER, type: "User", body: `Notes:${closing("Some Tool")}\nmore text`, reviews: [{ login: OWNER, type: "User", body: `${closing("Other Tool")}\nlater` }], comments: [] },
  { login: OWNER, type: "User", body: `x${closing("Claude Code")}\n\nhttps://e.invalid/session\n`, reviews: [{ login: "r[bot]", type: "Bot", body: `x${closing("Codex")}` }], comments: [] }], OWNER);
ok(carried.builders.map(([n, k]) => `${n} ${k}`).join() === `${NONE} 2,Claude Code 1` && carried.reviewers.map(([n]) => n).join() === "r[bot]",
  "builders are counted from the owner's own pull requests and the closing attribution line alone: a bot's pull request, and a line inside a description or review that more text follows, name no tool; a bare link after the line is no text; a bot's review is its login, whatever its text names", JSON.stringify(carried));
const most = tally([pulls[0], { ...pulls[0], number: 4 }, pulls[1]], OWNER);
ok(most.builders[0][0] === "Claude Code" && most.builders[0][1] === 2 && most.reviewers[0][0] === "a-reviewer[bot]", "most first", JSON.stringify(most));
ok(tally([{ ...own, number: 9, body: `x${sig("Old Tool")}\nlater${sig("New Tool")}` }], OWNER).builders[0][0] === "New Tool", "the last attribution line names the tool");
// (floor rule 4: what another account wrote names no tool)
const outsider = { login: "someone-else", type: "User" };
const theirs = tally([{ ...outsider, number: 5, body: `x${sig("Their Tool")}`, reviews: [], comments: [] },
  { ...own, number: 6, body: `x${sig("Claude Code")}`, reviews: [{ ...outsider, body: `ok${sig("Their Tool")}` }], comments: [{ ...outsider, body: `Security review: x${sig("Their Tool")}` }, { login: "THE-OWNER", type: "User", body: `Code review: x${sig("Another Tool")}` }] }], OWNER);
ok(theirs.others === 1 && JSON.stringify(theirs.builders) === JSON.stringify([["Claude Code", 1]]) && JSON.stringify(theirs.reviewers) === JSON.stringify([["Another Tool", 1]]), "a pull request another account opened is passed over and counted so; another person's review or comment names no tool; the owner's account is matched in any case", JSON.stringify(theirs));
const unread = tally([{ ...own, number: 7, body: `x${sig("Claude Code")}`, reviews: [bot("a-reviewer[bot]")], comments: [] }]);
ok(unread.others === 1 && !unread.builders.length && !unread.reviewers.length && tally([{ login: "x[bot]", type: "Bot", number: 8, body: "", reviews: [bot("r[bot]")] }]).reviewers[0][0] === "r[bot]", "with no owner's account read, only bots count");

// read through a stand-in for gh
const asked = [];
const gh = answers => args => { asked.push(args.join(" ")); const route = args[1]; const hit = Object.entries(answers).find(([k]) => route.startsWith(k)); if (!hit) throw new Error(`no answer for ${route}`); return JSON.stringify(hit[1]); };
const answers = {
  "repos/o/r/pulls?state=closed": [
    { user: { login: "o", type: "User" }, number: 7, merged_at: "2026-11-02T00:00:00Z", body: `a${sig("Claude Code")}` }, { number: 8, merged_at: null, body: "closed unmerged" },
    { user: { login: "o", type: "User" }, number: 6, merged_at: "2026-11-03T00:00:00Z", body: `b${sig("Another Tool")}` }, { number: 5, merged_at: "2026-11-01T00:00:00Z", body: "c" }],
  "repos/o/r/pulls/6/reviews": [{ user: { login: "a-reviewer[bot]", type: "Bot" }, body: "" }], "repos/o/r/pulls/7/reviews": [],
  "repos/o/r/issues/6/comments": [], "repos/o/r/issues/7/comments": [{ user: { login: "o", type: "User" }, body: `Security review: x${sig("Claude Code")}` }],
};
const read = readPulls("o/r", 2, gh(answers));
ok(read.map(p => p.number).join() === "6,7" && !asked.some(a => /\/(5|8)\//.test(a)), "the last merged pull requests, newest merge first, and nothing asked of one not taken", asked.join("\n"));
const out = said("o/r", read, tally(read, "o"), "o");
ok(/the last 2 merged pull requests of o\/r \(#7 to #6\), as the owner's account \(o\) and bots wrote them:/.test(out) && /built by: Another Tool 1, Claude Code 1/.test(out) && /reviewed by: a-reviewer\[bot\] 1, Claude Code 1/.test(out) && /a row written there decides/.test(out), "it prints what it read and that a row decides", out);
ok(!said("o/r", [{ number: 1 }], { builders: [["x\n::error::y", 1]], reviewers: [] }).includes("\n::"), "a name read from the record never starts a line of the log");

// page by page: closed pull requests updated lately but never merged fill the first page, and the merges stand after it
{
  const at = i => new Date(Date.UTC(2026, 10, 10) - i * 60000).toISOString(), routes = [];
  const unmerged = Array.from({ length: 100 }, (_, i) => ({ number: 1000 + i, merged_at: null, updated_at: at(i) }));
  const page2 = [{ user: { login: "o", type: "User" }, number: 9, merged_at: at(200), updated_at: at(101) },
    ...Array.from({ length: 99 }, (_, i) => ({ number: 2000 + i, merged_at: null, updated_at: at(300 + i) }))];
  const page3 = [{ user: { login: "o", type: "User" }, number: 8, merged_at: at(500), updated_at: at(500) }];
  const ask = args => { const r = args[1]; routes.push(r); const page = Number(/[?&]page=(\d+)/.exec(r)?.[1] ?? 0);
    if (/\/pulls\?state=closed/.test(r)) return JSON.stringify([[], unmerged, page2, page3][page] ?? []); return "[]"; };
  const two = readPulls("o/r", 2, ask);
  ok(two.map(p => p.number).join() === "9,8" && routes.filter(r => /state=closed/.test(r)).length === 3, "the merges past a first page of unmerged updates are found, page by page", routes.join("\n"));
  routes.length = 0;
  const one = readPulls("o/r", 1, ask);
  ok(one.map(p => p.number).join() === "9" && routes.filter(r => /state=closed/.test(r)).length === 3 - 1, "once a page's oldest update stands before the n-th merge, no later page is read", routes.join("\n"));
}

// every page of a pull request's reviews and comments, and a number of no form read as no pull request
{
  const routes = [];
  const ask = args => { const r = args[1]; routes.push(r); const page = Number(/[?&]page=(\d+)/.exec(r)?.[1] ?? 0);
    if (/state=closed/.test(r)) return JSON.stringify([{ user: { login: "o", type: "User" }, number: 4, merged_at: "2026-11-01T00:00:00Z" }, { number: "4/../x", merged_at: "2026-11-02T00:00:00Z" }]);
    if (/issues\/4\/comments/.test(r)) return JSON.stringify(page === 1 ? Array.from({ length: 100 }, () => ({ user: { login: "o", type: "User" }, body: "x" })) : [{ user: { login: "o", type: "User" }, body: `Security review: x${sig("Last Tool")}` }]);
    return "[]"; };
  const read = readPulls("o/r", 5, ask);
  ok(read.length === 1 && read[0].comments.length === 101 && tally(read, "o").reviewers[0]?.[0] === "Last Tool" && !routes.some(r => r.includes("..")), "a review comment past a pull request's first hundred is read, and a number of no form names no route", routes.join("\n"));
}

// the owner's account of the repository named, never of this checkout
{
  const routes = [], quiet = () => {};
  const gh = (manifest, owner) => args => { const r = args.at(-1) === ".owner | {login, type}" ? args[1] : args.at(-1); routes.push(r);
    if (/contents\/core-manifest\.md$/.test(r)) { if (manifest === null) throw new Error("404"); return manifest; }
    if (/^repos\/[^/]+\/[^/]+$/.test(r)) return JSON.stringify(owner); throw new Error(r); };
  ok(ownerFor("other/project", false, gh(null, { login: "other", type: "User" }), quiet, { GITHUB_REPOSITORY: "local/project" }) === "other" && routes.includes("repos/other/project") && !routes.some(r => r.includes("local")), "another repository's owner is read from its own host's answer, never this checkout's", routes.join("\n"));
  ok(ownerFor("other/project", false, gh("| *owner's account* | `someone` |\n", { login: "other", type: "User" }), quiet) === "someone", "its own manifest's row decides");
  ok(ownerFor("a-team/project", false, gh(null, { login: "a-team", type: "Organization" }), quiet) === null, "an organisation's, with no row, is not read");
}

// the program: no repository it can name, and gh that cannot answer, are each said and fail nothing
const here = fileURLToPath(new URL("../scripts", import.meta.url)); // (the scripts this tests, beside the folder tests/)
for (const [args, env, what] of [[["--repo", "../x"], {}, "a repository of no form"], [["--repo", "o/r", "--last", "0"], {}, "a count of no form"], [["--repo", "o/r"], { PATH: "" }, "no gh to ask"]]) {
  const r = spawnSync(process.execPath, [path.join(here, "tools-read.mjs"), ...args], { encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !(env.PATH !== undefined && /^path$/i.test(k)))), ...env } });
  ok(r.status === 0 && /^note .*the core's default stands/m.test(r.stdout), `${what}: said, and nothing fails`, r.stdout + r.stderr);
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
