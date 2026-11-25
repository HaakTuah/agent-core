// Tests of whether a project's repository is private, as its host says it (host-private.mjs; #1095, point 1): in a
// job, from the event GitHub runs it on, and that event's repository alone; in a session, from gh, and where gh gives
// no answer (it is not signed in), from GitHub's API with no sign-in (#1246, point 2), the host's own field read as it
// says; with no answer, it says so with the mend and never guesses. The host is a stand-in called in the test itself,
// and the clone a folder git reads, written here. Node's own modules.
//
//   node tests/host-private-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { privateOf } from "../scripts/host-private.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("host-private-");
const repo = "someone-else/a-hosted-clone", hosted = path.join(tmp, "clone");
// (a clone as git reads it: its HEAD, its folders and its origin, which is all that is asked of it; a backslash in a
// config value is an escape, so a Windows path is written with each doubled, as git writes it)
const clone = (at, origin) => {
  for (const d of ["objects", "refs/heads"]) fs.mkdirSync(path.join(at, ".git", d), { recursive: true });
  fs.writeFileSync(path.join(at, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(at, ".git", "config"), `[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = ${origin.replaceAll("\\", "\\\\")}\n`);
};
clone(hosted, `https://github.com/${repo}.git`);

const routes = [], gh = answer => route => { routes.push(route); return JSON.stringify(answer); };
const noGh = () => { throw new Error("gh: Not Found (HTTP 404)"); }, notAsked = () => { throw new Error("not asked"); };
const bareRoutes = [], bare = answer => route => { bareRoutes.push(route); return answer; };
ok(privateOf(hosted, { env: {}, ask: gh({ private: true }), bare: notAsked }).private === true && routes.join() === `repos/${repo}`, "a session asks gh of the repository its origin names, and where gh answers, makes no read with no sign-in", routes.join());
const event = path.join(tmp, "event.json");
fs.writeFileSync(event, JSON.stringify({ repository: { full_name: repo, private: false } }));
ok(privateOf(hosted, { env: { GITHUB_EVENT_PATH: event }, ask: notAsked, bare: notAsked }).private === false, "GitHub's job reads it from the event it runs on, and asks nothing else");
fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "someone-else/another", private: false } }));
const refused = privateOf(hosted, { env: { GITHUB_EVENT_PATH: event }, ask: noGh, bare: bare({ status: 404 }) });
ok(/could not be read: GitHub gave gh no answer \(gh: Not Found \(HTTP 404\)\), nor a read with no sign-in \(HTTP 404, as for a private repository or one not there\)\. Mend: .*CORE_PRIVATE.*/.test(refused.unread ?? "") && refused.private === undefined && bareRoutes.join() === `repos/${repo}`,
  "an event of another repository is not read, and where gh and a read with no sign-in give no answer, it says so with the mend, a refusal never read as private", JSON.stringify(refused));

// (a public repository whose visibility the session read another way is offered CORE_PRIVATE=false too: #1265, point 1)
ok(/read in a step of its own that runs none of the project's code: .*for a private repository, `true`.*for a public one, `false`, where the session read it so another way/.test(refused.unread ?? ""),
  "the mend offers CORE_PRIVATE for a public repository too, false as read in a step that runs none of the project's code, beside true for a private one", refused.unread);

// ---- where gh is not signed in (#1246, point 2) ----
const asked = answer => privateOf(hosted, { env: {}, ask: noGh, bare: answer });
ok(asked(bare({ status: 200, private: false })).private === false && asked(bare({ status: 200, private: true })).private === true,
  "where gh gives no answer, GitHub's API with no sign-in answers, its field \"private\" read as it says");
ok([bare({ status: 200 }), bare({ status: 403 }), () => { throw new Error("offline"); }].every(answer => "unread" in asked(answer)),
  "an answer without the field, a refusal or none reads nothing");
ok(asked(bare({ status: 404 })).unread && privateOf(hosted, { env: { CORE_PRIVATE: "true" }, ask: noGh, bare: bare({ status: 404 }) }).private === true
  && privateOf(hosted, { env: { CORE_PRIVATE: "false" }, ask: noGh, bare: bare({ status: 404 }) }).private === false
  && privateOf(hosted, { env: { CORE_PRIVATE: "true" }, ask: noGh, bare: bare({ status: 200, private: false }) }).private === false
  && "unread" in privateOf(hosted, { env: { CORE_PRIVATE: "yes" }, ask: noGh, bare: bare({ status: 404 }) }),
  "where neither answers, the host's answer a session read in a step of its own, given as CORE_PRIVATE, is taken, never over what the host said, and a value but true or false is none");

// ---- a clone made from a folder, as check.mjs's scratch clone is (#1246, point 6) ----
const scratch = path.join(tmp, "scratch"), deeper = path.join(tmp, "deeper"), loose = path.join(tmp, "loose");
const inside = path.join(tmp, "inside"), afar = path.join(tmp, "afar");
clone(scratch, hosted); clone(deeper, pathToFileURL(scratch).href); clone(loose, path.join(tmp, "not-there")); clone(afar, "file://some-other-machine/share/clone"); clone(inside, path.join(hosted, "sub"));
fs.mkdirSync(path.join(hosted, "sub"));
bareRoutes.length = 0;
ok([scratch, deeper].every(at => privateOf(at, { env: {}, ask: noGh, bare: bare({ status: 200, private: false }) }).private === false) && bareRoutes.every(r => r === `repos/${repo}`) && bareRoutes.length === 2,
  "a clone made from a folder, or from a clone of one, names the repository its first clone's origin names", bareRoutes.join());
ok([loose, inside, afar].every(at => /names no repository on github\.com, nor does the origin of the clone it was made from/.test(privateOf(at, { env: {}, ask: notAsked, bare: notAsked }).unread ?? "")),
  "a clone whose folder is not there, is on another machine, or is a folder inside another clone and no clone itself, names none, and asks nothing");

// ---- an origin that names another machine, a UNC path or a device path (#1295) ----
// (every path the reader probes or reads is recorded, so each case bites on every system: the origins as written are
// stopped as written, and `file:////host/share`, which names no host, is stopped once mapped, to `//host/share` where
// node maps it, and refused by node on Windows)
const probed = [], { existsSync, realpathSync } = fs;
fs.existsSync = at => { probed.push(String(at)); return existsSync(at); };
fs.realpathSync = (at, ...rest) => { probed.push(String(at)); return realpathSync(at, ...rest); };
const unc = ["\\\\some-other-machine\\share\\clone", "//some-other-machine/share/clone", "\\\\?\\UNC\\some-other-machine\\share\\clone", "/\\some-other-machine\\share\\clone", "file:////some-other-machine/share/clone"].map((origin, n) => {
  const at = path.join(tmp, `unc-${n}`); clone(at, origin); return at;
});
const answers = path.join(tmp, "answers.json");
fs.writeFileSync(answers, JSON.stringify({ [path.join(tmp, "elsewhere")]: { private: true } }));
const uncRead = unc.map(at => privateOf(at, { env: {}, ask: notAsked, bare: notAsked }));
unc.forEach(at => privateOf(at, { env: { CORE_HOST_ANSWERS: answers }, ask: notAsked, bare: notAsked }));
fs.existsSync = existsSync; fs.realpathSync = realpathSync;
// (a path on another machine, or one that would be once joined: node joins `//host/share` and `.git` to `/host/share/.git`)
const far = probed.filter(at => /^[\\/]{2}|^[\\/]some-other-machine/.test(at));
ok(uncRead.every(r => /names no repository on github\.com, nor does the origin of the clone it was made from/.test(r.unread ?? "")) && far.length === 0,
  "an origin that names another machine, as a UNC or device path does, is not followed: nothing there is probed or read, and it names no repository, as any origin the reader cannot map", far.join(" "));

// ---- git reads the clone's own config, and is not run where its git folder lies on another machine ----
// (each points, through a path with two leading slashes, at a real clone whose origin names the repository: where the
// path is followed, git reads that origin there too, so each case bites on every system; a link, only where one can be
// made)
const elsewhere = `//${path.join(hosted, ".git").replace(/^[\\/]+/, "")}`;
const included = path.join(tmp, "included"), pointed = path.join(tmp, "pointed"), common = path.join(tmp, "common"), linked = path.join(tmp, "linked");
clone(included, path.join(tmp, "not-there"));
fs.writeFileSync(path.join(tmp, "origin.inc"), `[remote "origin"]\n\turl = https://github.com/${repo}.git\n`);
fs.writeFileSync(path.join(included, ".git", "config"), `[core]\n\trepositoryformatversion = 0\n[include]\n\tpath = ${path.join(tmp, "origin.inc").replaceAll("\\", "\\\\")}\n`);
fs.mkdirSync(pointed); fs.writeFileSync(path.join(pointed, ".git"), `gitdir: ${elsewhere}\n`);
const worktree = path.join(tmp, "worktree-git");
fs.mkdirSync(path.join(worktree), { recursive: true }); fs.writeFileSync(path.join(worktree, "HEAD"), "ref: refs/heads/main\n"); fs.writeFileSync(path.join(worktree, "commondir"), `${elsewhere}\n`);
fs.mkdirSync(common); fs.writeFileSync(path.join(common, ".git"), `gitdir: ${worktree}\n`);
let links = true;
const nearLinked = path.join(tmp, "near-linked");
try { fs.mkdirSync(linked); fs.symlinkSync(elsewhere, path.join(linked, ".git"), "dir"); fs.mkdirSync(nearLinked); fs.symlinkSync(path.join(hosted, ".git"), path.join(nearLinked, ".git"), "dir"); } catch { links = false; }
const gitDirs = [included, pointed, common, ...(links ? [linked] : [])];
ok(gitDirs.every(at => /names no repository on github\.com/.test(privateOf(at, { env: {}, ask: notAsked, bare: notAsked }).unread ?? "")),
  `git follows no include of the clone's config, and reads no origin where the clone's .git file, its common folder${links ? " or a link of .git" : ""} names a folder on another machine`,
  gitDirs.map(at => `${path.basename(at)}: ${JSON.stringify(privateOf(at, { env: {}, ask: () => "{}", bare: () => ({}) }))}`).join("; "));

// (a worktree git makes, its .git file naming a folder of a clone on this machine, and a link of .git to one, are read
// as before: sessions work in worktrees)
const main = path.join(tmp, "main"), tree = path.join(tmp, "tree"), run = (...args) => spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...args], { encoding: "utf8" });
run("init", "-q", main); run("-C", main, "commit", "-q", "--allow-empty", "-m", "start"); run("-C", main, "remote", "add", "origin", `https://github.com/${repo}.git`); run("-C", main, "worktree", "add", "-q", tree);
bareRoutes.length = 0;
const near = [tree, ...(links ? [nearLinked] : [])].map(at => privateOf(at, { env: {}, ask: noGh, bare: bare({ status: 200, private: false }) }).private);
ok(fs.statSync(path.join(tree, ".git")).isFile() && near.every(v => v === false) && bareRoutes.every(r => r === `repos/${repo}`),
  `a worktree whose .git file names a clone on this machine${links ? ", and a link of .git to one," : ""} is read as before`, JSON.stringify(near));

// ---- the read with no sign-in itself, its own process run, sent to a proxy that is not there ----
// (the environment the reader is given, never this process's: here a proxy that is not there, so nothing leaves)
const offline = { PATH: process.env.PATH, HTTPS_PROXY: "http://127.0.0.1:9", https_proxy: "http://127.0.0.1:9", NO_PROXY: "", no_proxy: "" };
const unsent = privateOf(hosted, { env: offline, ask: noGh });
ok(/nor a read with no sign-in \(HTTP none\)/.test(unsent.unread ?? "") && unsent.private === undefined, "the read with no sign-in runs in its own process, through the proxy its environment names, and with no answer reads nothing", JSON.stringify(unsent));

done("whether the repository is private");
