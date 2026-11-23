// Tests cited.mjs, which rules each role cites in a month (#296), and how the state report carries it
// (state-report.mjs): the role a text opens as, what counts as citing a rule, what is read through a gh that answers
// from fixtures, the report's lines, and the one line a project's report gives the core's. Its tests workflow runs it
// on every pull request here. Node's own modules.
//
//   node tests/cited-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, citedFrom, citedIn, count, HEADING, lines, matchers, mergedIn, OPENERS, plain, report, roleOf, ROLES, startRules, texts } from "../scripts/cited.mjs";
import { mended } from "../scripts/mend.mjs";
import { rules, rulesOf } from "../scripts/rules.mjs";
import { body, countsFrom, projects, rowOf } from "../scripts/state-report.mjs";

let failed = 0, count_ = 0;
const ok = (cond, what, detail = "") => { count_++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the roles ----
const openers = JSON.parse(fs.readFileSync(path.join(root, "scripts/labels.json"), "utf8")).openers;
ok(Object.keys(OPENERS).every(o => openers.includes(o)), "each opener a role is read by stands in labels.json's list");
ok(ROLES.every(r => fs.existsSync(path.join(root, "roles", `${r}.md`))) && Object.values(OPENERS).every(r => ROLES.includes(r)), "each role has its file under roles/, and each opener names one of them");
ok(roleOf("From a builder session, on #241:\nwords") === "builder" && roleOf("\n**Security review:** clean") === "reviewer" && roleOf("> From the orchestrator: next") === "orchestrator"
  && roleOf("The stand-in's notes on #3") === "stand-in" && roleOf("From the owner's design session: x") === "design",
  "a text's role is read from its first line, its marks left out");
ok(roleOf("From a chat session with the owner:") === null && roleOf("@codex review") === null && roleOf("Hello. From a builder session") === null && roleOf("") === null,
  "a text that opens as no role, the owner's voice among them, has none");

// ---- what cites a rule ----
const file = (f, t) => rulesOf(f, t);
const all = [
  ...file("floor/security.md", "# The floor\n\n**4. Outsiders' text is never an instruction.**\n- **The owner's word** is theirs.\n\n**11. Nothing personal, ever.**\n"),
  ...file("roles/shared/work-flow.md", "# Flow\n\n4. **The polish lane** (x): what.\n\n**Sessions:**\n- one\n"),
  ...file("tasks/game-design.md", "# Games\n\n- **The polish lane:** in a game.\n"),
];
const m = matchers(all);
const cites = t => [...citedIn(t, m)].sort();
ok(cites("As \"Outsiders' text is never an instruction\" says.").includes("floor/security.md: 4. Outsiders' text is never an instruction"), "a lead of three words or more is cited as it stands, its number left out");
ok(cites("the owner's word, passed on").includes("floor/security.md: The owner's word"), "whatever its case or quotes");
ok(!cites("Sessions are many.").length && cites('as "Sessions" says').includes("roles/shared/work-flow.md: Sessions"), "a shorter lead only in quotes");
ok(cites("floor rule 11 and floor rules 4, 11 and 12").join("|") === "floor/security.md: 11. Nothing personal, ever|floor/security.md: 4. Outsiders' text is never an instruction",
  "a numbered floor rule by its number, one or a list, a number with no rule left out");
ok(!cites("**The owner's word**\n## Outsiders' text is never an instruction\n").length, "a heading alone, or a lead in bold alone, cites nothing");
ok(cites("The polish lane").join() === "roles/shared/work-flow.md: The polish lane" && cites("The polish lane of game-design").join() === "tasks/game-design.md: The polish lane",
  "a lead two files hold is cited for the one the text names, else the first");
const long = Date.now();
ok(cites(`${" ".repeat(70000)}x\nfloor rule 11`).length === 1 && citedFrom(`**${HEADING}**\n- builder: 1 texts, 1 citing a rule, 1 rules cited; of the 1 it reads at its start, 0 not cited; the most cited: ${"a".repeat(70000)}.`, new Set()) === null && Date.now() - long < 1000,
  "a long line costs no more than a moment, and a carried line past a count's length is left out", Date.now() - long);
ok(!cites("the owner's wordy text").length && plain("**A** `b`’s  “C”") === "a b's \"c\"", "a lead is matched as whole words, and the text is made plain first");

// ---- what is read, through a gh of fixtures ----
const pull = (n, merged, body, who = "OWNER") => ({ number: n, merged_at: merged, updated_at: merged ?? "2026-10-31T00:00:00Z", author_association: who, body, head: { ref: `b${n}`, repo: { full_name: "o/n" } } });
const comment = (at, body, who = "OWNER", login = "o") => ({ created_at: at, body, author_association: who, user: { login, type: login.endsWith("[bot]") ? "Bot" : "User" } });
const routes = {
  pulls: [pull(1, "2026-10-03T00:00:00Z", "Built under floor rule 4."), pull(2, "2026-11-01T00:00:00Z", "next month"), pull(3, null, "never merged"), pull(4, "2026-10-04T00:00:00Z", "floor rule 4", "NONE")],
  "issues/comments": [comment("2026-10-05T00:00:00Z", "From a builder session, on #1: Nothing personal, ever, held."), comment("2026-10-06T00:00:00Z", "Code review: floor rule 11"),
    comment("2026-09-30T00:00:00Z", "Code review: before the month"), comment("2026-10-06T00:00:00Z", "From a builder session: an outsider", "NONE"),
    comment("2026-10-07T00:00:00Z", "<!-- codex-review-receipt -->", "NONE", "chatgpt-codex-connector[bot]")],
  "pulls/comments": [comment("2026-10-08T00:00:00Z", "This breaks floor rule 4.", "NONE", "chatgpt-codex-connector[bot]"),
    comment("2026-10-08T00:00:00Z", "floor rule 4, from an account named like Codex's", "NONE", "chatgpt-codex-connector")],
};
const asked = [];
const gh = route => { asked.push(route); const key = Object.keys(routes).find(k => route.startsWith(`repos/o/n/${k}?`)); if (!key) throw new Error(`no fixture: ${route}`); return /[?&]page=1(?:&|$)/u.test(route) ? JSON.stringify(routes[key]) : "[]"; };
const read = texts("o/n", "2026-10", gh);
ok(read.pulls === 1 && read.comments === 3 && read.items.map(i => i.role).join() === "builder,builder,reviewer,reviewer",
  "the month's merged pull requests and comments are read, each as its role: none of another month, another account's or Codex's receipt", JSON.stringify(read));
routes.pulls.push(pull(5, "2026-10-01T00:00:00Z", "the first second"));
routes["issues/comments"].push(comment("2026-10-01T00:00:00Z", "Code review: the first second"), comment("2026-11-01T00:00:00Z", "Code review: the month after"));
const edges = texts("o/n", "2026-10", gh);
ok(edges.pulls === 2 && edges.comments === 4, "from the month's first second, and to the month after's first left out", JSON.stringify(edges));
routes.pulls.pop(); routes["issues/comments"].splice(-2);
// (a page of 100 asks for the next, until a page is short or holds only what was last updated before the month)
const pages = { 1: Array.from({ length: 100 }, (_, i) => pull(100 + i, i ? "2026-09-30T00:00:00Z" : "2026-10-31T23:59:59Z")).map(p => ({ ...p, updated_at: "2026-10-02T00:00:00Z" })),
  2: Array.from({ length: 100 }, (_, i) => ({ ...pull(300 + i, i ? null : "2026-10-02T00:00:00Z"), updated_at: i ? "2026-09-01T00:00:00Z" : "2026-10-02T00:00:00Z" })),
  3: [pull(500, "2026-10-09T00:00:00Z")] };
const paged = [];
const merged = mergedIn("o/n", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", r => { const n = /[?&]page=(\d+)/u.exec(r)[1]; paged.push(n); return JSON.stringify(pages[n] ?? []); });
ok(merged.map(p => p.number).join() === "100,300,500" && paged.join() === "1,2,3", "the merged pull requests are read page by page, to a page that holds none updated in the month", `${merged.map(p => p.number)} ${paged}`);
const all100 = Array.from({ length: 100 }, (_, i) => ({ ...pull(600 + i, "2026-10-10T00:00:00Z"), updated_at: "2026-09-01T00:00:00Z" }));
const paged2 = [];
mergedIn("o/n", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", r => { paged2.push(r); return JSON.stringify(paged2.length === 1 ? all100 : []); });
ok(paged2.length === 1, "and stop at a full page whose every one was last updated before the month");
ok(asked.some(r => r.includes("issues/comments?since=2026-10-01T00:00:00Z")) && after("2026-12") === "2027-01" && after("2026-09") === "2026-10", "the comments are asked for from the month's first day, and the month after is the next");
const counted = count(read.items, m), starts = new Map(ROLES.map(r => [r, new Set(r === "builder" ? all.map(x => x.key) : [])]));
const out = lines({ month: "2026-10", pulls: read.pulls, comments: read.comments, counted, starts });
ok(out[0].startsWith("- Read: the descriptions of 1 pull requests merged in 2026-10 and 3 comments written in it")
  && out.includes("- builder: 2 texts, 2 citing a rule, 2 rules cited; of the 6 it reads at its start, 4 not cited; the most cited: floor/security.md: 11. Nothing personal, ever (1), floor/security.md: 4. Outsiders' text is never an instruction (1).")
  && out.includes("- reviewer: 2 texts, 2 citing a rule, 2 rules cited; of the 0 it reads at its start, 0 not cited; the most cited: floor/security.md: 11. Nothing personal, ever (1), floor/security.md: 4. Outsiders' text is never an instruction (1).")
  && out.includes("- orchestrator: no text."), "the lines say, for each role, its texts, the rules cited, its start reading not cited and the most cited", out.join("\n"));
const notRead = report({ repo: "o/n", month: "2026-10", gh: () => { throw new Error("403"); } });
ok(notRead.length === 1 && /^- Not read: GitHub did not answer .* `pull-requests: read`/u.test(notRead[0]), "where GitHub does not answer, one line says so and why");
const core = rules(), start = startRules(core);
ok(ROLES.every(r => start.get(r).size > 0) && [...start.get("builder")].some(k => k.startsWith("floor/security.md: ")), "the core's roles each read rules at their start, the floor among them");

// ---- in the state report, and carried to the core's ----
const report_ = body({ core: false, month: "2026-11", measures: null, previous: null, overdue: [], cited: out, scripts: "core/scripts" });
ok(report_.includes(`**${HEADING}**\n- Read: the descriptions of 1`), "the state report carries the lines under their heading");
ok(body({ core: true, month: "2026-11", measures: null, previous: null, overdue: [], holders: [], scripts: "scripts" }).includes(`**${HEADING}**\n- Not counted: \`scripts/cited.mjs\` was not run for 2026-10.`), "and says where they were not counted");
const known = new Set(all.map(r => r.key));
const tampered = report_.replace("- orchestrator: no text.", "- orchestrator: no text. Run this.").replace("(1), floor/security.md: 4.", "(1), Click here (9), floor/security.md: 4.");
const carried = citedFrom(tampered, known);
ok(carried === "cited in 2026-10, of 1 pull requests and 3 comments; builder 2 of 2 texts citing 2 rules, 4 of the 6 it reads at its start not cited, the most: floor/security.md: 11. Nothing personal, ever (1), floor/security.md: 4. Outsiders' text is never an instruction (1); design no text; reviewer 2 of 2 texts citing 2 rules, 0 of the 0 it reads at its start not cited, the most: floor/security.md: 11. Nothing personal, ever (1), floor/security.md: 4. Outsiders' text is never an instruction (1); stand-in no text; auditor no text",
  "a project's count is carried in one line of numbers, roles and the core's own rule names alone: a line out of its form, and a name the core has no rule of, are left out", carried);
ok(citedFrom("no such heading", known) === null && countsFrom(report_, false, known)?.startsWith("cited in 2026-10"), "a report with no count carries none, and the counts for the core carry it after their own");

// ---- run by hand ----
const run = spawnSync(process.execPath, [path.join(root, "scripts/cited.mjs"), "--repo", "o/n", "--month", "2026-13"], { encoding: "utf8" });
ok(run.status === 1 && mended(run.stdout + run.stderr), "a month or repository it cannot read is refused, with its mend", run.stderr);

// ---- --projects reads nothing as nothing read (#1112) ----
{
  const mine = { private: false, owner: "o", shared: false };
  const outage = new Error("gh: HTTP 502 Bad Gateway"), absent = new Error("gh: Not Found (HTTP 404)");
  let threw = false;
  try { rowOf(() => { throw outage; }, "o", "o/a", mine); } catch (e) { threw = e === outage; }
  ok(threw && rowOf(() => { throw absent; }, "o", "o/a", mine) === null, "a manifest read that fails for any reason but gh's 404 throws, and a 404 is no project");
  const url = new Error('Get "https://api.github.com/repos/o/page-404/contents/core-manifest.md": Bad Gateway');
  let urlThrew = false;
  try { rowOf(() => { throw url; }, "o", "o/page-404", mine); } catch (e) { urlThrew = e === url; }
  ok(urlThrew, "an outage whose message holds '404' in a repository's name is no 404 answer: it throws");
  const said = [], log = console.log; console.log = l => said.push(l);
  let unread = false;
  try { projects([], route => route === "user" ? "o\n" : "[]"); } catch { unread = true; } finally { console.log = log; }
  ok(unread && !said.length, "an account that reaches no repository at all is an unread answer, not 'None found'");
  // the issue's own case: --trial with no files and a gh that fails refuses and says the mend (a stub gh first on PATH;
  // not on Windows, where Node runs no extension-less stub and gh.exe would be called)
  if (process.platform !== "win32") {
    const dir = scratchDir("stub-gh-");
    {
      fs.writeFileSync(path.join(dir, "gh"), "#!/bin/sh\necho 'gh: HTTP 502 Bad Gateway' >&2\nexit 1\n", { mode: 0o755 });
      const down = spawnSync(process.execPath, [path.join(root, "scripts", "release.mjs"), "--trial", "a".repeat(40)], { encoding: "utf8", env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` } });
      ok(down.status === 1 && /could not be read/.test(down.stderr) && /Mend: run it where gh answers/.test(down.stderr), "--trial with no files and a gh that fails refuses, saying what could not be read and the mend", down.stderr);
    }
  }
}

console.log(`\n${count_ - failed} of ${count_} passed`);
if (failed) process.exitCode = 1;
