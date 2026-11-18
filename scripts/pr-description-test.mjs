// Checks the description check (pr-description.mjs, beside this file): a part is there only as a heading that starts
// with its words. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/pr-description-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { asked, calledFor, costMend, doneAsked, DONE_SINCE, heldAt, missing, NO_COST, numberMend, PARTS, waitsMend, waitsOn } from "./pr-description.mjs";
import { lineMend } from "./reading.mjs";
import { asking, found, issuesOf, readable, textsOf, yesOf } from "./owner-yes.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n";

ok(missing(whole).length === 0, "a description with both headings passes");
ok(missing("### What the owner can try\nx\n###### readings TAKEN (the unsure first)\nx\n").length === 0, "any level of heading, any case, and words after the part's own");
ok(missing("## What the owner can try: nothing yet\r\n## Readings taken, the unsure first\r\n").length === 0, "a mark after the part's words, and lines that end both ways");
ok(missing("The change.").join() === PARTS.join() && missing("").length === 2 && missing(undefined).length === 2 && missing(null).length === 2, "a description with neither, an empty one and none at all each miss both");
ok(missing("## What the owner can try\nx\n").join() === "Readings taken", "one missing part is named");
ok(missing("**What the owner can try:** x\n**Readings taken:** none\nWhat the owner can try\nReadings taken\n").length === 2, "bold words, or the words on a plain line, are no heading");
ok(missing("## What the owner can trying\n## Readings takenly\n## Not what the owner can try\n##Readings taken\n").length === 2, "a longer word, the words not at the start, and a # with no space after it do not count");
ok(missing("    ## What the owner can try\n\t## Readings taken\n").length === 2, "a line indented as code is no heading");
ok(missing("## Risks\n## Rollback\n", ["Risks", "Rollback", "Test plan"]).join() === "Test plan", "a project's own parts are asked for in place of the two");
ok(missing("## **What the owner can try**\n## _Readings\u00a0 taken_ \n").length === 0 && missing("## 1. What the owner can try\n## \u2705 Readings taken\n").join() === "What the owner can try", "bold or a sign before the words, and blanks of any kind between them, are read through; a number before them is not");
ok(missing("## \u0130stanbul notes\n## STRASSE: none\n", ["\u0130stanbul", "Strasse"]).length === 0 && missing("## \u0130stanbuls\n", ["\u0130stanbul"]).length === 1, "a part whose small letters are longer than its capitals is still matched whole");
ok(missing("```\n## What the owner can try\n```\n<!--\n## Readings taken\n-->\n").length === 0, "it reads no Markdown: a heading line in a code block or a comment counts (stated in the script's header)");
ok(asked().join() === PARTS.join() && asked("").join() === PARTS.join() && asked(" | ").join() === PARTS.join() && asked("+").join() === PARTS.join(), "no argument, an empty one and one of separators alone each ask for the two");
ok(asked("Risks| Rollback ").join() === "Risks,Rollback", "a project's own parts stand in place of the two");
ok(asked("+What holds it").join() === [...PARTS, "What holds it"].join() && asked(" +A|B").join() === [...PARTS, "A", "B"].join() && asked("+Readings taken").join() === PARTS.join(), "parts led by a + are added to the two, none of them twice");
ok(missing(whole, asked("+What holds it")).join() === "What holds it" && missing(`${whole}## What holds it\n\nNone.\n`, asked("+What holds it")).length === 0, "an added part is asked for, and found");
// the line that says what a pull request waits on
ok(["nothing", "a review", "checks", "#241"].every(w => waitsOn(`x\n\nWaits on: ${w}\n`)?.kind) && waitsOn("Waits on: the owner: may the old saves go?").kind === "the owner",
  "each form of the line is read: nothing, a review, checks, an item, and the owner with the question");
ok(waitsOn("x") === null && waitsOn("Waits on: soon").kind === null && waitsOn("Waits on: the owner").kind === null && waitsOn("Waits on: the owner: why").kind === null,
  "no line is none; one in no form, or the owner without a question in one sentence ending in a question mark, is no form");
ok(waitsOn("Waits on: the owner: a?\r\nWaits on: nothing").kind === "nothing" && waitsOn("  Waits on:   a review  ").said === "a review", "the last such line counts, trimmed");
ok(costMend("x\nSession so far: 1,204 answers (opus); tokens in 3, cache written 4, cache read 5, out 6.\n") === null && costMend(`x\r\n  ${NO_COST}\r\n`) === null,
  "the cost line, or the mark that the script printed none, on a line of its own, is enough");
ok([costMend("x"), costMend(`see ${NO_COST}`), costMend("No cost line."), costMend(null)].every(m => /Mend: run `node core\/scripts\/session-cost\.mjs`/.test(m ?? "") && m.includes(NO_COST)),
  "a description with neither, or the mark inside a line, is to mend, the mend naming the script and the mark");
ok(numberMend("## What holds it\n\nNone\n") === null && numberMend("x") === null
  && numberMend("## What holds it\n- \"A rule\": held by its check.\n  Number: correction: misread; outcome: asked.\n## Readings taken\nNumber: x") === null,
  "the number is asked only where \"What holds it\" stands and holds more than None, and one line in its form is enough");
ok(numberMend("## What holds it\n- Number: check fires; outcome: robust; rare harm.") === null && numberMend("## What holds it\n- Number: check fires; outcome: robust; rare") !== null,
  "a number may say that its rule guards against rare and severe harm, in those words");
ok([numberMend("## What holds it\n- \"A rule\": held by its check.\n## Readings taken\nNumber: findings; outcome: robust"), numberMend("### What holds it\n- Number: findings; outcome: cost")].every(m => /Mend: under it, .*"Number: <findings \| check fires \| correction: <kind>>; outcome: <asked/.test(m ?? ""))
  && /it reads "findings; outcome: cost"/.test(numberMend("### What holds it\n- Number: findings; outcome: cost")),
  "a rule with no number under the heading, one under another heading, or one in no form, is to mend, the mend giving the form");
ok(waitsMend("Waits on: nothing") === null && /has no line "Waits on:"/.test(waitsMend("x")) && /"Waits on: soon" is in none of the forms/.test(waitsMend("Waits on: soon")) && /needs-owner/.test(waitsMend("")),
  "the mend names what is missing or wrong, and the forms, with the label for the owner");
const cs = [{ sha: "c", date: "2026-11-20T00:00:00Z" }, { sha: "b", date: "2026-11-18T00:00:00Z" }, { sha: "a", date: "2026-11-17T00:00:00Z" }];
const read = [];
ok(heldAt(cs, "2026-11-19T00:00:00Z", s => (read.push(s), s !== "a")) === true && read.join() === "b", "the line is asked where the copy's newest commit from before the pull request opened holds it, one file read");
ok(heldAt(cs, "2026-11-17T12:00:00Z", s => s !== "a") === false && heldAt(cs, "2026-11-01T00:00:00Z", () => true) === false && heldAt([], "2026-11-19T00:00:00Z", () => true) === false,
  "not where that commit's copy lacks it, where the copy changed only after the pull request opened, or where nothing changed it");
// how done will be judged (done-when.mjs): asked only of a pull request opened since the copy on its base held it
const holds = "export const DONE_SINCE = \"x\";";
ok(doneAsked("2026-11-18T00:00:00Z", holds) && doneAsked(DONE_SINCE, holds), "asked of a pull request opened on or after the day, its base's copy holding it");
ok(!doneAsked("2026-11-16T23:59:59Z", holds) && !doneAsked("2026-11-18T00:00:00Z", "an older copy") && !doneAsked("2026-11-18T00:00:00Z", null) && !doneAsked("", holds),
  "not of one opened before, one whose base's copy lacked it or could not be read, nor one with no day");
const slow = Date.now();
missing(`${"#".repeat(300000)} x\n${"## ".repeat(100000)}\n${" ".repeat(300000)}# Readings taken\n`.repeat(3));
numberMend(`## What holds it\n- Number: x${".".repeat(64000)}y${" ".repeat(64000)}\n`);
ok(Date.now() - slow < 2000, "a long description of signs and spaces is read in no time, its line \"Number:\" too");
// what a pull request's changed paths call for, in a scratch project: the merge commit against its base, the kinds of
// the project's own paths as the base holds them, the copy's own paths left out
{
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pr-description-test-")), project = path.join(tmp, "project");
  process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
  const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
  const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(project, f)), { recursive: true }); fs.writeFileSync(path.join(project, f), text); };
  for (const part of ["floor", "tasks", "roles"]) fs.cpSync(path.join(root, part), path.join(project, "core", part), { recursive: true });
  put("core-manifest.md", "# Core manifest\n\nFloor: whole. Modules: `screens.md`.\nNot taken: `game-design.md` (no game).\n"); put("checks/reading.json", `${JSON.stringify({ paths: { "src/screens/": "polish" } })}\n`); put("src/screens/a.js", "1\n");
  git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "the base");
  ok(calledFor(tmp) === null, "where no core stands, what a change calls for cannot be read");
  put("src/screens/a.js", "2\n"); put("checks/reading.json", "{}\n"); put("core-manifest.md", "# Core manifest\n\nFloor: whole. Modules: `updates.md`.\nNot taken: `game-design.md` (no game), `screens.md` (none).\n"); put("core/CLAUDE.md", "x\n"); put(".github/workflows/caf\u00e9.yml", "on: push\n");
  git("add", "-A"); git("commit", "-q", "-m", "a change that empties its own reading config");
  const called = calledFor(project);
  ok(JSON.stringify(called.map(c => c.file)) === JSON.stringify(["core/tasks/screens.md", "core/floor/topics/workflows.md"]) && /of the kind polish/.test(called[0].why),
    "a pull request's changed paths call for their files by the reading config and the manifest its base holds, not those it carries: a module the base's manifest leaves out is not asked, one the change itself leaves out still is; a path of the copy calls for nothing, and one outside ASCII is read as spelled", JSON.stringify(called));
  ok(/does not list `core\/tasks\/screens\.md`/.test(lineMend("Read for it: `core/floor/topics/workflows.md`", called, "cmd")) && lineMend("Read for it: `core/floor/topics/workflows.md`, `core/tasks/screens.md`", called, "cmd") === null, "and the line is held to them");
  git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "no parent");
  ok(calledFor(project) === null, "with no base to read against, nothing is asked");
}
// run, each failure says its mend (no pull request's date given, so the line is not asked of it here)
const run = body => spawnSync(process.execPath, [fileURLToPath(new URL("./pr-description.mjs", import.meta.url))], { env: { ...process.env, PR_BODY: body, PR_CREATED: "" }, encoding: "utf8" });
const none = run("The change, and nothing else.");
ok(none.status === 1 && /has no heading "Readings taken"\. Mend: add "## Readings taken"/.test(none.stdout) && mended(none.stdout) && run(whole).status === 0, "run, a description without its headings fails, each failure saying its mend, and one with them passes");
ok(mended(`FAIL ${waitsMend("x")}`) && mended(`FAIL ${waitsMend("Waits on: soon")}`) && mended(`FAIL ${costMend("x")}`) && mended(`FAIL ${numberMend("## What holds it\n- a rule")}`), "so do the lines' own failures, as the script prints them");
// the owner's yes where the core's floor or review guidelines change (owner-yes.mjs; #549)
{
  const said = "> Queue it from its current text; the floor's two points need my yes, and it is given.";
  const record = `**The owner's word**\n\n${said}\n\nThe owner agreed to all six.`;
  const pr = (quote, issue = "Fixes #9") => `${issue}\n\n## The owner's word\n\n${quote}\n\n## Readings taken\nNone`;
  const texts = [readable(record)];
  const floor = asking(["floor/security.md", "scripts/x.mjs"], "");
  ok(floor.join() === "floor/security.md" && asking(["roles/shared/review-guidelines.md"], "").length === 1 && asking(["roles/shared/inbox.md", "tasks/x.md"], "").length === 0,
    "the floor and the review guidelines ask the yes; another rule file does not");
  ok(asking(["core/floor/security.md", "floor/tiles.png"], "core/").length === 0 && asking(["floor/security.md"], null).length === 0,
    "in a project, a sync's copy of the floor and a folder of the project's own named floor ask nothing: only the core's own change does");
  ok(yesOf({ paths: floor, body: pr(said), texts }).note?.startsWith("the owner's yes is quoted"), "a line quoted word for word from the issue passes");
  ok(yesOf({ paths: floor, body: pr("> Queue it from its current text;   the floor's two\n> points need my yes, and it is given."), texts }).note && yesOf({ paths: floor, body: pr("> Queue it from its current text; […] and it is given."), texts }).note,
    "blanks count as one, the issue's own > marks are read through, and \"[…]\" leaves details out");
  const wrong = [yesOf({ paths: floor, body: pr("> Queue it, and my yes is given for the floor."), texts }), yesOf({ paths: floor, body: pr(said), texts: [] }), yesOf({ paths: floor, body: pr("Queue it from its current text") , texts }), yesOf({ paths: floor, body: pr(said, "Builds the floor change."), texts })];
  ok(wrong.every(w => w.mend && mended(`FAIL ${w.mend}`)) && /no line it quotes/.test(wrong[0].mend) && /no line it quotes/.test(wrong[1].mend) && /quotes nothing/.test(wrong[2].mend) && /names no issue/.test(wrong[3].mend),
    "words not on the issue, words found only in a text of an account without the higher right, a yes not quoted with >, and no issue named each fail, saying the mend");
  ok(yesOf({ paths: [], body: "x", texts: [] }).note && yesOf({ paths: floor, body: pr("> Not on the issue."), texts, read: false }).note && yesOf({ paths: floor, body: pr(said), texts, read: false }).note?.startsWith("the owner's yes is quoted"),
    "a change of no such file is asked nothing; where a text or a right could not be read the line is said, never failed, and a quote found in what was read still passes");
  ok(issuesOf("Fixes #548. Part of #545, closes #12, resolved #7, Fixes #548").join() === "548,545,12" && issuesOf("See #3 and #4.").length === 0, "the issues a description names as its own, at most three, each once; one only mentioned is none");
  ok(found("a […] c", [readable("a b c")]) && !found("a […] c", [readable("a b"), readable("c")]) && !found("[…]", [readable("x")]), "the pieces of a quote stand in one text, and a quote of marks alone is none");
  // the texts, through a host that answers as gh would: the description and comments of each issue, those by an account with maintain or admin
  const host = { "repos/o/r/issues/9": { user: { login: "boss" }, body: record, node_id: "I_9" }, "repos/o/r/issues/9/comments?per_page=100&page=1": [{ user: { login: "writer" }, body: "> my yes, as a writer", node_id: "C_1" }, { user: { login: "helper[bot]" }, body: "> my yes, as a bot", node_id: "C_2" }, { user: { login: "app" }, body: "> my yes, as an app", node_id: "C_3" }, { user: { login: "keeper" }, body: "> my yes, as a maintainer", node_id: "C_4" }],
    "repos/o/r/collaborators/boss/permission": { role_name: "admin", user: { type: "User" } }, "repos/o/r/collaborators/writer/permission": { role_name: "write", user: { type: "User" } },
    "repos/o/r/collaborators/keeper/permission": { role_name: "maintain", user: { type: "User" } }, "repos/o/r/collaborators/app/permission": { role_name: "admin", user: { type: "Bot" } } };
  // (GraphQL's answer on who edited each text: none edited, unless `edits` names its editors)
  // (the host refuses a lookup of more than 100 nodes, as GitHub's GraphQL does)
  const edited = (edits = {}) => (route, query) => route === "graphql"
    ? [...query.matchAll(/"([^"]+)"/gu)].length > 100 ? null : { data: { nodes: [...query.matchAll(/"([^"]+)"/gu)].map(([, id]) => ({ id, lastEditedAt: edits[id] ? "2026-11-18T10:00:00Z" : null, userContentEdits: { totalCount: edits[id]?.total ?? edits[id]?.length ?? 0, nodes: (edits[id] ?? []).map(login => ({ editor: login === null ? null : { login } })) } })) } }
    : host[route] ?? null;
  const asked = [], got = textsOf("o/r", [9], (route, query) => (asked.push(route), edited()(route, query)));
  ok(got.read && got.texts.length === 2 && got.texts.some(x => x.includes("my yes, as a maintainer")) && !got.texts.some(x => /as an? (writer|bot|app)/.test(x)) && !asked.some(r => r.includes("helper")),
    "the issue's text by an admin and a comment by a maintainer count; a writer's, a bot's and an admin account that is no person's do not, and no right is asked of a bot's login");
  const lost = textsOf("o/r", [9], (route, query) => (route.endsWith("keeper/permission") ? null : edited()(route, query)));
  ok(!lost.read && lost.texts.length === 1 && textsOf("o/r", [10], edited()).read === false, "an account the host does not answer on, or an issue it does not give, leaves it unread, what was read kept");
  // an edited text counts only where every editor has the higher right: one who may only write can edit another's
  const byWriter = textsOf("o/r", [9], edited({ I_9: ["boss", "writer"], C_4: ["keeper", null] })), byAdmin = textsOf("o/r", [9], edited({ I_9: ["boss", "keeper"] }));
  ok(byWriter.read && byWriter.texts.length === 0 && byAdmin.read && byAdmin.texts.length === 2,
    "a text a writer, or an account gone, edited counts no longer; one edited by accounts of the higher right alone still counts", JSON.stringify(byWriter));
  const many = textsOf("o/r", [9], edited({ I_9: Object.assign(["boss"], { total: 101 }) })), dark = textsOf("o/r", [9], route => (route === "graphql" ? null : host[route] ?? null));
  const blank = textsOf("o/r", [9], edited({ I_9: [] }));
  ok(!many.read && many.texts.length === 1 && !dark.read && dark.texts.length === 0 && !blank.read && blank.texts.length === 1,
    "a text whose editors run past the host's first hundred, are not given, or are none though it was edited, is unread, never counted", JSON.stringify([many, blank]));
  const full = Array.from({ length: 100 }, (_, i) => ({ user: { login: "keeper" }, body: `> note ${i}`, node_id: `N_${i}` }));
  const long = textsOf("o/r", [9], (route, query) => (/comments\?per_page=100&page=\d$/.test(route) ? full : edited()(route, query)));
  ok(!long.read && long.texts.length === 301 && yesOf({ paths: floor, body: pr("> note 7"), texts: long.texts, read: long.read }).note?.startsWith("the owner's yes is quoted") && yesOf({ paths: floor, body: pr("> not read"), texts: long.texts, read: long.read }).note,
    "comments past the pages read leave it unread, their texts asked of the host a hundred at a time: a quote found in them still passes, one not found is said, never failed", `${long.read} ${long.texts.length}`);
}
process.exit(failed ? 1 : 0);
