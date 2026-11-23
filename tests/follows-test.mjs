// Tests of what a project follows (releases.mjs: ownerOf, followsOf, hostSaid, hostAccount): the owner's account read from the
// manifest's row or, with none, from the host, and from it whether the project follows the core's main or its releases.
// Split from releases-test.mjs (#958) so that one session reads what it changes. Node's own modules only.
//
//   node tests/follows-test.mjs
import fs from "node:fs";
import path from "node:path";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { followsOf, hostAccount, hostSaid, ownerOf } from "../scripts/releases.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";


let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// what a project follows
const manifest = (owner, row = "") =>
  `# Core manifest\n\nCore: ${CORE} at ${"a".repeat(40)}, copied whole under core/ (never edited here).\n\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`${owner}\` |\n${row}`;
ok(ownerOf(manifest("someone")) === "someone" && ownerOf("no manifest") === null, "the owner's account is read from its one row");
ok(followsOf(manifest(OWNER)) === "main" && followsOf(manifest(OWNER.toUpperCase())) === "main", "with no row, the core's own owner's project follows main, however the login is cased");
ok(followsOf(manifest("someone-else")) === "releases", "with no row, another owner's project follows the releases");
ok(followsOf(manifest(OWNER, "| *follows* | `releases` |\n")) === "releases" && followsOf(manifest("someone-else", "| *follows* | `main` |\n")) === "main", "a row decides it, either way");
ok(followsOf(manifest("someone-else", "|*follows*|  `main`  |\n")) === "main", "the row is read whatever its blanks");
ok(followsOf(manifest(OWNER, "| *follows* | releases |\n")) === null && followsOf(manifest(OWNER, "| *follows* | `main` or `releases` |\n")) === null && followsOf(manifest(OWNER, "| *follows* | `tags` |\n")) === null, "a row that says anything else, or says it without backticks, gives no answer");
ok(followsOf(manifest(OWNER, "| *follows* | `main` |\n| *follows* | `releases` |\n")) === null, "two rows give no answer");
ok(followsOf("| *owner's account* | someone |\n") === null, "no row and no owner's account to go by give no answer");
// (#481: with no row at all, the repository's own account where the host says a person holds it; a row still decides)
const PERSON = { login: "someone", type: "User" }, ORG = { login: "a-team", type: "Organization" }, BARE = "# Core manifest\n\n| Slot | Here |\n| --- | --- |\n";
ok(ownerOf(BARE, PERSON) === "someone" && ownerOf(BARE, ORG) === null && ownerOf(BARE) === null, "with no row, the owner's account is read where a person's account holds the repository, and only there");
ok(ownerOf(manifest("other"), PERSON) === "other" && ownerOf("| *owner's account* | someone |\n", PERSON) === null && ownerOf(`${manifest("a")}| *owner's account* | \`b\` |\n`, PERSON) === null, "a row decides over what was read, and a row of another form, or two, give no answer and are never read past");
ok(["| *Owner's Account* | `x` |", "| *owner’s account* | `x` |", "|**owner's account**| `x` |", "| *owners account* | x |", "| *owner's account* (a team's) | `x` |", "| the Owner's  Account | `x` |"].every(row => ownerOf(`${BARE}${row}\n`, PERSON) === null), "a row whose lead is cased or spelt otherwise is still a row: no answer, and the host's account is never read past it");
ok(ownerOf(`${manifest("other")}| *Owner's account* | \`x\` |\n`, PERSON) === "other", "the one row of its form decides beside a row spelt otherwise, as before");
ok(ownerOf(BARE, { login: "a;b", type: "User" }) === null && ownerOf(BARE, { login: "x", type: "user" }) === null, "a login of no form, and a type other than the host's own word, read as nothing");
ok(followsOf(BARE, { login: OWNER, type: "User" }) === "main" && followsOf(BARE, PERSON) === "releases" && followsOf(BARE, ORG) === null, "with no row, what the project follows goes by the account read");
{ // asked once, only when called, saying what it read
  const lines = [], calls = [];
  const host = hostSaid(l => lines.push(l), () => { calls.push(1); return PERSON; });
  ok(ownerOf(manifest("other"), host) === "other" && !calls.length && !lines.length, "with a row, the host is not asked and nothing is said");
  ok(ownerOf(BARE, host) === "someone" && followsOf(BARE, host) === "releases" && calls.length === 1 && lines.length === 1 && /^read from the host: someone, a person's account, holds the repository; a row/.test(lines[0]), "with none, it is asked once and says what it read", lines.join("\n"));
  const none = [];
  ok(ownerOf(BARE, hostSaid(l => none.push(l), () => null)) === null && /nothing/.test(none[0]) && /an account of the type x%0Ay/.test((() => { const l = []; hostSaid(x => l.push(x), () => ({ login: "a", type: "x\ny" }))(); return l[0]; })()), "nothing read is said so, and a type of no form is only quoted");
}
{ // the host's account: from the workflow's event, else from gh, else nothing
  const dir = scratchDir("host-account-"), event = path.join(dir, "event.json"), asked = [];
  try {
    fs.writeFileSync(event, JSON.stringify({ repository: { owner: { login: "someone", type: "User", id: 1 } } }));
    const gh = text => args => { asked.push(args.join(" ")); return text; };
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event }, gh("{}"))) === JSON.stringify(PERSON) && !asked.length, "the event's own account is read, and gh is not asked");
    fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "Someone/Project", owner: { login: "someone", type: "User" } } }));
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "someone/project" }, gh("{}"))) === JSON.stringify(PERSON), "an event of the repository asked about is read, whatever its case");
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG), "an event of another repository is passed over for gh's answer on the one asked about");
    ok(JSON.stringify(hostAccount({ GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG) && asked.at(-1) === "api repos/a-team/x --jq .owner | {login, type}", "with no event, gh is asked of the repository's own route", asked.join("; "));
    ok(hostAccount({ GITHUB_REPOSITORY: "../x" }, gh(JSON.stringify(PERSON))) === null && hostAccount({ GITHUB_REPOSITORY: "a/x" }, () => { throw new Error("no gh"); }) === null && hostAccount({ GITHUB_REPOSITORY: "a/x" }, gh("not json")) === null, "no repository's name, no gh, or an answer of no form: nothing read, never a guess");
    fs.writeFileSync(event, JSON.stringify({ repository: { owner: { login: "a b", type: "User" } } }));
    ok(JSON.stringify(hostAccount({ GITHUB_EVENT_PATH: event, GITHUB_REPOSITORY: "a-team/x" }, gh(JSON.stringify(ORG)))) === JSON.stringify(ORG), "an event's login of no form is passed over for gh's answer");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on what a project follows`);
process.exitCode = failed ? 1 : 0;
