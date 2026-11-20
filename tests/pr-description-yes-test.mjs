// Checks the owner's yes asked where the core's floor or review guidelines change (scripts/owner-yes.mjs, run by scripts/pr-description.mjs; #549) and not of a file whose change only follows a file moved whole (scripts/path-only.mjs). Split from pr-description-test.mjs (#888); run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-yes-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { asking, coreAtBase, found, issuesOf, readable, textsOf, yesOf } from "../scripts/owner-yes.mjs";
import { proven } from "../scripts/path-only.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

// the owner's yes is not asked of a file whose change only follows a file moved whole (path-only.mjs; #886, point 1)
{
  const tmp = scratchDir("pr-description-moved-");
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...a) => execFileSync("git", a, { cwd: tmp, env, stdio: ["ignore", "pipe", "pipe"] }).toString();
  const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); };
  write("floor/security.md", "Read `scripts/old.mjs` and `scripts/kit/` first.\n"); write("scripts/old.mjs", "x\n"); write("scripts/kit/a.mjs", "a\n"); write("roles/shared/review-guidelines.md", "Read `scripts/old.mjs`.\n");
  git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "the base");
  git("mv", "scripts/old.mjs", "scripts/new.mjs"); git("mv", "scripts/kit", "scripts/tools");
  write("floor/security.md", "Read `scripts/new.mjs` and `scripts/tools/` first.\n"); write("roles/shared/review-guidelines.md", "Read `scripts/new.mjs` now.\n");
  git("commit", "-qam", "the move");
  const asked = ["floor/security.md", "roles/shared/review-guidelines.md"];
  ok(JSON.stringify(proven(tmp, "HEAD^1", "HEAD", asked)) === JSON.stringify(["floor/security.md"]), "read from git, a file and a folder moved whole and followed are proven, and a file with a word changed beside them is not");
  git("mv", "scripts/new.mjs", "scripts/newer.mjs"); write("scripts/path-only.mjs", "changed\n"); write("floor/security.md", "Read `scripts/newer.mjs` and `scripts/tools/` first.\n");
  git("add", "-A"); git("commit", "-qm", "the proof changed");
  ok(proven(tmp, "HEAD^1", "HEAD", asked).length === 0, "where the pull request changes the proof, nothing is proven, however its paths follow");
  git("rm", "-q", "scripts/path-only.mjs"); git("commit", "-qm", "the proof as it was"); git("mv", "scripts/tools", "scripts/box"); write("scripts/box/extra.mjs", "more\n"); write("floor/security.md", "Read `scripts/newer.mjs` and `scripts/box/` first.\n");
  git("add", "-A"); git("commit", "-qm", "a folder moved with a file added");
  ok(proven(tmp, "HEAD^1", "HEAD", asked).length === 0, "a folder that gains a file in its move holds more than it held, and its pointer is not proven");
  git("reset", "-q", "--hard", "HEAD^1"); write("floor/security.md", "Read `scripts/newer.mjs`; only `actions/` run.\n"); git("commit", "-qam", "a rule naming what is not here");
  write("actions/a.txt", "planted\n"); git("add", "-A"); git("commit", "-qm", "planted under its words");
  git("mv", "actions", "some-org"); write("floor/security.md", "Read `scripts/newer.mjs`; only `some-org/` run.\n"); git("commit", "-qam", "the planted folder moved");
  ok(proven(tmp, "HEAD^1", "HEAD", asked).length === 0, "a path outside the core's own folders follows no move: a folder planted under a rule's words, then moved, is not proven");
  git("reset", "-q", "--hard", "HEAD^1"); git("mv", "scripts/newer.mjs", "scripts/newest.mjs"); write("floor/security.md", "Read `scripts/newest.mjs`; only `actions/` run.\n"); git("commit", "-qam", "a move that rewrites the line");
  const between = proven(tmp, "HEAD^1", "HEAD", asked);
  git("mv", "actions", "some-org"); write("floor/security.md", "Read `scripts/newest.mjs`; only `some-org/` run.\n"); git("commit", "-qam", "the planted folder moved after");
  ok(between.length === 1 && proven(tmp, "HEAD^1", "HEAD", asked).length === 0, "nor does a move proven between the plant and its move, which rewrote the line, make it follow: the list of the core's own folders is fixed, read from no history");
}
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
  ok(/correct nothing in the quote: only a session the owner works with corrects[\s\S]*quote them as they stand there, and never write that record yourself/.test(yesOf({ paths: floor, body: pr("> Queue it from its curent text; the floor's two points need my yes, and it is given."), texts }).mend ?? ""),
    "a quote that corrects or miscopies the owner's words fails, its mend saying only a session the owner works with corrects them, and that the builder quotes them as they stand and writes no record itself (#775)");
  ok(yesOf({ paths: floor, body: pr("> Queue it from its current text;   the floor's two\n> points need my yes, and it is given."), texts }).note && yesOf({ paths: floor, body: pr("> Queue it from its current text; […] and it is given."), texts }).note,
    "blanks count as one, the issue's own > marks are read through, and \"[…]\" leaves details out");
  const wrong = [yesOf({ paths: floor, body: pr("> Queue it, and my yes is given for the floor."), texts }), yesOf({ paths: floor, body: pr(said), texts: [] }), yesOf({ paths: floor, body: pr("Queue it from its current text") , texts }), yesOf({ paths: floor, body: pr(said, "Builds the floor change."), texts })];
  ok(wrong.every(w => w.mend && mended(`FAIL ${w.mend}`)) && /no line it quotes/.test(wrong[0].mend) && /no line it quotes/.test(wrong[1].mend) && /quotes nothing/.test(wrong[2].mend) && /names no issue/.test(wrong[3].mend),
    "words not on the issue, words found only in a text of an account without the higher right, a yes not quoted with >, and no issue named each fail, saying the mend");
  ok(yesOf({ paths: [], body: "x", texts: [] }).note && yesOf({ paths: floor, body: pr("> Not on the issue."), texts, read: false }).note && yesOf({ paths: floor, body: pr(said), texts, read: false }).note?.startsWith("the owner's yes is quoted"),
    "a change of no such file is asked nothing; where a text or a right could not be read the line is said, never failed, and a quote found in what was read still passes");
  ok(issuesOf("Fixes #548. Part of #545, closes #12, resolved #7, Fixes #548").join() === "548,545,12" && issuesOf("See #3 and #4.").length === 0, "the issues a description names as its own, at most three, each once; one only mentioned is none");
  ok(found("my yes for […] is given", [readable("my yes for the floor is given")]) && !found("my yes for […] is given", [readable("my yes for"), readable("is given")]) && !found("[…]", [readable("x")]), "the pieces of a quote stand in one text, and a quote of marks alone is none");
  const later = [readable("We will look at this later.")];
  ok(!found("e", later) && !found("will look", later) && !found("ill look at", later) && !found("at this late", later) && found("will look at", later) && found("We will look", later),
    "a quote of fewer than three words, or one cut inside a word, is no yes: only whole words, three or more to a line, are found");
  ok(!found("We […] We […] We", later) && !found("later […] We […] will", later) && !found("We […] will […] look", later) && found("We will look […] later", later) && !found("this later […] We will look", later),
    "the pieces of a quote are found in their order, each once, one of them three words or more: common words strung by […] are no yes");
  ok(found("我同意这个改动", [readable("我同意这个改动。")]) && !found("𝐚bc plan is here", [readable("x𝐚bc plan is here")]) && !found("s note […] a", [readable("The owner's note, a plan")]) && !found("cafe\u0301 is fine", [readable("x\u0301cafe\u0301 is fine")]) && found("“the owner's note is", [readable("He said: “the owner's note is final.")]),
    "words are counted and their edges read by code points: a script without blanks, a letter past the first plane, a mark and an apostrophe are read as letters are");
  ok(found("我同意这个改动", [readable("他说我同意这个改动。")]) && found("この変更に同意します", [readable("私はこの変更に同意します。")]),
    "a clause quoted from inside a sentence of a script written without blanks is found: its edges fall on the segmenter's word boundaries");
  ok(!found("’s note is final", [readable("the owner’s note is final")]) && !found("-known plan is", [readable("a well-known plan is")]) && !found("final word of the owner’", [readable("the final word of the owner’s note")]) && found("final word of the owner’", [readable("the final word of the owner’ is given")]),
    "a piece that opens or ends with an apostrophe or hyphen joining a word in the text is cut inside that word, and no yes");
  // where the core lies, from the base's manifest alone, never the head's
  // (a base that holds `files`, and `manifest`'s text where it holds core-manifest.md, as git answers for HEAD^1)
  const git = (files, manifest = null) => args => args[0] === "show" ? (manifest === null ? { status: 1, stdout: "" } : { status: 0, stdout: manifest })
    : args[0] === "ls-tree" && files !== null ? { status: 0, stdout: args.slice(4).filter(f => files.includes(f)).join("\n") } : { status: 1, stdout: "" };
  const copy = `Core: ${CORE} at ` + "a".repeat(40) + ", copied whole under core/\n", core = ["roles", "floor/security.md"];
  ok(coreAtBase(".", git(core)) === "" && coreAtBase(".", git(["core-manifest.md", "core/roles", "core/floor/security.md"], copy)) === "core/"
    && coreAtBase(".", git(["core-manifest.md", ...core], copy)) === "" && coreAtBase(".", git(["core-manifest.md", ...core], "no line")) === ""
    && coreAtBase(".", git(null)) === null && coreAtBase(".", git(["core-manifest.md"], copy)) === null && coreAtBase(".", git(["core-manifest.md", "core/roles", "core/floor/security.md"])) === null,
    "where the core lies is read from the base, as coreAt finds it: the manifest's path or the root, whichever holds roles/ and the floor, and unread where neither does or git cannot say");
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
  const full = Array.from({ length: 100 }, (_, i) => ({ user: { login: "keeper" }, body: `> the owner's note ${i}`, node_id: `N_${i}` }));
  const long = textsOf("o/r", [9], (route, query) => (/comments\?per_page=100&page=\d$/.test(route) ? full : edited()(route, query)));
  ok(!long.read && long.texts.length === 301 && yesOf({ paths: floor, body: pr("> owner's note 7"), texts: long.texts, read: long.read }).note?.startsWith("the owner's yes is quoted") && yesOf({ paths: floor, body: pr("> a line not read"), texts: long.texts, read: long.read }).note,
    "comments past the pages read leave it unread, their texts asked of the host a hundred at a time: a quote found in them still passes, one not found is said, never failed", `${long.read} ${long.texts.length}`);
}
process.exit(failed ? 1 : 0);
