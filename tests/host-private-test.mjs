// Tests of whether a project's repository is private, as its host says it (host-private.mjs; #1095, point 1): in a
// job, from the event GitHub runs it on, and that event's repository alone; in a session, from gh, and where gh gives
// no answer (it is not signed in), from GitHub's API with no sign-in (#1246, point 2), the host's own field read as it
// says; with no answer, it says so with the mend and never guesses. The host is a stand-in called in the test itself,
// and the clone a folder git reads, written here. Node's own modules.
//
//   node tests/host-private-test.mjs
import fs from "node:fs";
import path from "node:path";
import { privateOf } from "../scripts/host-private.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("host-private-");
const repo = "someone-else/a-hosted-clone", hosted = path.join(tmp, "clone"), git = path.join(hosted, ".git");
// (a clone as git reads it: its HEAD, its folders and its origin, which is all that is asked of it)
for (const d of ["objects", "refs/heads"]) fs.mkdirSync(path.join(git, d), { recursive: true });
fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n");
fs.writeFileSync(path.join(git, "config"), `[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/${repo}.git\n`);

const routes = [], gh = answer => route => { routes.push(route); return JSON.stringify(answer); };
const noGh = () => { throw new Error("gh: Not Found (HTTP 404)"); }, notAsked = () => { throw new Error("not asked"); };
const bareRoutes = [], bare = answer => route => { bareRoutes.push(route); return answer; };
ok(privateOf(hosted, { env: {}, ask: gh({ private: true }), bare: notAsked }).private === true && routes.join() === `repos/${repo}`, "a session asks gh of the repository its origin names, and where gh answers, makes no read with no sign-in", routes.join());
const event = path.join(tmp, "event.json");
fs.writeFileSync(event, JSON.stringify({ repository: { full_name: repo, private: false } }));
ok(privateOf(hosted, { env: { GITHUB_EVENT_PATH: event }, ask: notAsked, bare: notAsked }).private === false, "GitHub's job reads it from the event it runs on, and asks nothing else");
fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "someone-else/another", private: false } }));
const refused = privateOf(hosted, { env: { GITHUB_EVENT_PATH: event }, ask: noGh, bare: bare({ status: 404 }) });
ok(/could not be read: GitHub gave gh no answer \(gh: Not Found \(HTTP 404\)\), nor a read with no sign-in \(HTTP 404, as for a private repository or one not there\)\. Mend: sign gh in/.test(refused.unread ?? "") && refused.private === undefined && bareRoutes.join() === `repos/${repo}`,
  "an event of another repository is not read, and where gh and a read with no sign-in give no answer, it says so with the mend, a refusal never read as private", JSON.stringify(refused));

// ---- where gh is not signed in (#1246, point 2) ----
const asked = answer => privateOf(hosted, { env: {}, ask: noGh, bare: answer });
ok(asked(bare({ status: 200, private: false })).private === false && asked(bare({ status: 200, private: true })).private === true,
  "where gh gives no answer, GitHub's API with no sign-in answers, its field \"private\" read as it says");
ok([bare({ status: 200 }), bare({ status: 403 }), () => { throw new Error("offline"); }].every(answer => "unread" in asked(answer)),
  "an answer without the field, a refusal or none reads nothing");

done("whether the repository is private");
