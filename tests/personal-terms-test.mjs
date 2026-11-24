// Checks the personal-terms check (floor rule 11; .github/workflows/personal-terms.yml): its own job, run as GitHub
// runs it (scripts/workflow-run.mjs), on scratch pull requests, each checked out as GitHub checks one out: its
// merge into its base. What fails: a term in a file, in a line a commit adds and a later one takes away, in a line a
// merge's own resolution adds (an octopus merge's too), in a file's name (an empty file, a rename, a binary file, a
// name outside plain ASCII; never printed, in whatever case, where the file's content holds one too), in a commit's
// message, author or committer (name or address), in a private repository too, its failure saying how to mend it, and
// in the title, description or branch name; a file of text a .gitattributes marks binary, main's own too; a term listed
// with blanks or a Windows line end around it; a commit dated before the rule too, since a date is whatever its maker
// writes; each failure saying how the session takes the term out; a term in a link like a Claude Code session's but of
// another shape or host, inside another address, or beside one (#261); a term in LICENSE or NOTICE out of their shape,
// in the name line of a NOTICE, in such a file elsewhere or under another name, or in a commit that edits one (#257).
// What passes: none of these; a term only in a file whose content is binary (not read); one only inside a Claude Code
// session link's random id, wherever the check reads text; a file on main named with
// a term before the rule, deleted or renamed away; only in the
// author of a commit GitHub itself made (floor rule 11's exception: a merge or an edit on github.com, under a profile
// GitHub wrote on a merge of main's, not one through its API under an author its caller named), committed as GitHub and
// signed by its key, while
// one written to look so (unsigned, signed by another key, or with a certificate made to look like GitHub's) fails, and so does every merge's author where the key
// cannot be fetched; only in a commit of the base's, though the event
// names an older base; a term only in the copyright lines of LICENSE and NOTICE of their shape, at the root and in the
// core's copy (#257); and a repository without the secret. The address in a commit's author and committer line (#460,
// point 2), with the secret or without: an address that is no no-reply one fails, one that only looks like one too; a
// no-reply one passes, as does one only in a commit main holds, and one of a merge GitHub made under a profile above. What Betterleaks, which matches the terms (#579), would read
// otherwise fails all the same: a file of text that begins as an archive or a PDF does, a line marked for it to pass
// over, a term beside its ignore and config files, a term holding a pattern's characters, matched as listed, a file
// whose name puts a binary type's mark where it reads one, a term on any line of a long run or across a long line's
// pieces, since it reads in chunks; a term in
// base64 passes, as before; and where Betterleaks was not fetched at its pin (no pin for the machine's system, a release
// that cannot be downloaded), the check fails saying the mend, a kept copy that differs from its sum never run. The terms
// are invented, built from pieces as the test runs, so no file holds them. On Linux and on Windows. Git, bash, curl and
// Node's own modules, and Betterleaks' release for the machine's system, which the check's own step fetches from github.com, or, where CORE_ARCHIVES names a folder holding the archive, from it (#772).
//
//   node tests/personal-terms-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runWorkflow } from "../scripts/workflow-run.mjs";
import { mended } from "../scripts/mend.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { ARCHIVE_SERVER, archivesMissing, root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
{ const missing = archivesMissing(); ok(missing === null, "with the network cut off, the archive of Betterleaks the run's set-up fetched stands in CORE_ARCHIVES", missing ?? ""); }
const workflow = fs.readFileSync(path.join(root, ".github/workflows/personal-terms.yml"), "utf8");
const tmp = scratchDir("personal-terms-test-");
const [term, other, wide] = [["qz", "vk", "wy"], ["xj", "qq", "zf"], ["zç", "qñ", "x"]].map(t => t.join(""));
const TERMS = `${term}\n${other}\n${wide}\n`;
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: "2026-11-13T12:00:00Z", GIT_COMMITTER_DATE: "2026-11-13T12:00:00Z" });
// (the host's no-reply domain, and an invented account's address in it, which the address step passes: #460, point 2;
// each address here is invented, by the id 0, which GitHub gives no account, or by a login with "--", which it refuses)
const NOREPLY = ["users", "noreply", "github", "com"].join(".");
const MINE = `${["0", "a-scratch-builder"].join("+")}@${NOREPLY}`;
const ME = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: MINE, GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: MINE };
const git = (dir, args, extra = {}) => execFileSync("git", args, { cwd: dir, env: { ...env, ...ME, ...extra }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const AS_GITHUB = { GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" };
// GitHub's own signing key, stood in for by one made here, which a stand-in for curl serves as the check fetches it;
// where gpg cannot run (a Windows runner without it), the cases that need a signature are left out, said below. The
// check itself runs only on GitHub's Linux runners.
const bash = (script, extra = {}) => spawnSync("bash", ["-c", script], { env: { ...env, ...extra }, encoding: "utf8" });
const signer = path.join(tmp, "signer"), stranger = path.join(tmp, "other-signer"), stubs = path.join(tmp, "stubs");
const keyFile = path.join(tmp, "web-flow.gpg");
fs.mkdirSync(stubs);
// (the stand-in serves GitHub's key, and Betterleaks' release from the folder CORE_ARCHIVES names where it holds the
// archive, and hands any other fetch to the machine's own curl, save where a case has it fail)
const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const realCurl = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean).flatMap(d => ["curl", "curl.exe"].map(c => path.join(d, c))).find(isFile);
fs.writeFileSync(path.join(stubs, "curl"), `#!/bin/sh\ncase "$*" in *web-flow.gpg*) [ -f "$STAND_IN_KEY" ] || exit 22; cat "$STAND_IN_KEY"; exit 0 ;; esac\n[ -z "$FETCH_FAILS" ] || { o=; for a; do [ "$o" = -o ] && o=$a && break; o=$a; done; echo "curl: (23) Failed writing to the file $o" >&2; exit 22; }\n${ARCHIVE_SERVER}exec '${(realCurl ?? "curl").replace(/\\/g, "/")}' "$@"\n`, { mode: 0o755 });
const makeKey = (home, who) => { fs.mkdirSync(home, { mode: 0o700 }); return bash(`gpg -q --batch --pinentry-mode loopback --passphrase '' --quick-gen-key '${who}' ed25519 sign never`, { GNUPGHOME: home }).status === 0; };
const signedBy = (home, key) => ({ GNUPGHOME: home, GIT_CONFIG_COUNT: "3", GIT_CONFIG_KEY_0: "commit.gpgSign", GIT_CONFIG_VALUE_0: "true", GIT_CONFIG_KEY_1: "gpg.program", GIT_CONFIG_VALUE_1: "gpg", GIT_CONFIG_KEY_2: "user.signingKey", GIT_CONFIG_VALUE_2: key });
process.on("exit", () => { for (const home of [signer, stranger]) bash("gpgconf --kill all", { GNUPGHOME: home }); });
// (gpg is tried whole first: both keys made, GitHub's exported, a commit signed with it and read back as good)
const gpg = (() => {
  try {
    if (!makeKey(signer, "GitHub <noreply@github.com>") || !makeKey(stranger, "Someone <someone@example.invalid>")) return false;
    fs.writeFileSync(keyFile, execFileSync("gpg", ["-q", "--batch", "--armor", "--export"], { env: { ...env, GNUPGHOME: signer } }));
    const probe = path.join(tmp, "gpg-probe"), keys = path.join(tmp, "gpg-probe-keys");
    fs.mkdirSync(probe);
    fs.mkdirSync(keys, { mode: 0o700 });
    git(probe, ["init", "-q"]);
    git(probe, ["commit", "-q", "--allow-empty", "-m", "signed"], { ...AS_GITHUB, ...signedBy(signer, "noreply@github.com") });
    execFileSync("gpg", ["-q", "--batch", "--import", keyFile], { env: { ...env, GNUPGHOME: keys }, stdio: "ignore" });
    return /^[GU]$/.test(git(probe, ["-c", "gpg.program=gpg", "log", "-1", "--format=%G?"], { GNUPGHOME: keys }));
  } catch {
    return false;
  } finally {
    bash("gpgconf --kill all", { GNUPGHOME: path.join(tmp, "gpg-probe-keys") });
  }
})();
// a commit as GitHub makes one: committed by GitHub and signed with its key
const GITHUB = gpg ? { ...AS_GITHUB, ...signedBy(signer, "noreply@github.com") } : AS_GITHUB;

let n = 0;
const put = (dir, files) => { for (const [name, text] of Object.entries(files)) { const at = path.join(dir, name); if (text === null) fs.rmSync(at); else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); } } };
const commitAll = (dir, [files, extra = {}, message = "a change"]) => { if (typeof files === "function") files(dir); else put(dir, files); git(dir, ["add", "-A"]); git(dir, ["commit", "-q", "--allow-empty", "-m", message], extra); };
// A repository whose main holds a first commit and then `onMain`, and a pull request's branch, `change`, from the first
// commit with its `commits` (each [files or a function of the folder, extra env, message]).
function pull(commits, onMain = []) {
  const dir = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  commitAll(dir, [{ "README.md": "# A project\n", "a.md": "one\ntwo\nthree\n" }, {}, "first"]);
  const first = git(dir, ["rev-parse", "HEAD"]);
  for (const c of onMain) commitAll(dir, c);
  git(dir, ["checkout", "-q", "-b", "change", first]);
  for (const c of commits) commitAll(dir, c);
  return { dir, first };
}
// The check's verdict, with the pull request checked out as GitHub merges it into the base's tip; the event names
// `eventBase`, the tip itself unless an older base is given.
function check({ dir, first }, { terms = TERMS, title = "A change", body = "Words.", branch = "change", stale = false, key = keyFile, isPrivate = false, opener = null, locale = null, store = null, fetchFails = false, more = null } = {}) {
  const tip = git(dir, ["rev-parse", "main"]);
  git(dir, ["checkout", "-q", "--detach", "main"]);
  git(dir, ["merge", "-q", "--no-ff", "--no-edit", "change"], { ...GITHUB, ...(opener ? { GIT_AUTHOR_NAME: opener } : {}) });
  const github = { event_name: "pull_request", repository: "someone/project", ref: "refs/pull/1/merge", event: { pull_request: { title, body, head: { ref: branch }, base: { sha: stale ? first : tip } }, repository: { private: isPrivate } } };
  const PATH = env.PATH ?? env.Path ?? "";
  const base = { ...env, ...ME, ...(locale ? { LC_ALL: locale } : {}), ...(store ? { TMPDIR: store } : {}), ...(fetchFails ? { FETCH_FAILS: "1" } : {}), STAND_IN_KEY: key, PATH: `${more ? `${more}${path.delimiter}` : ""}${stubs}${path.delimiter}${PATH}` };
  const [job] = runWorkflow(workflow, { github, secrets: { PERSONAL_TERMS: terms }, base, workspace: () => dir, uses: { "actions/checkout": () => {} }, temp: tmp });
  return { passed: job.passed, out: job.steps.map(s => s.out).join(""), outputs: job.outputs };
}
// (never printed in any case: GitHub's masking of the secret matches its case exactly)
const fails = (what, repo, opts) => { const r = check(repo, opts); ok(!r.passed && mended(r.out) && ![term, other, wide].some(t => r.out.toLowerCase().includes(t.toLowerCase())), `${what} fails, and the term is never printed`, r.out); };
const passes = (what, repo, opts) => { const r = check(repo, opts); ok(r.passed, `${what} passes`, r.out); };

passes("a pull request with no term anywhere", pull([[{ "b.md": "plain words\n" }]]));
fails("a term in a file", pull([[{ "b.md": `a line with ${term.toUpperCase()} in it\n` }]]));
fails("a term added in one commit and taken out in the next", pull([[{ "b.md": `${term}\n` }], [{ "b.md": "gone\n" }]]));
fails("a term in an empty file's name, the file removed again", pull([[{ [`notes-${other}.md`]: "" }], [{ [`notes-${other}.md`]: null }]]));
fails("a term in a file's new name, renamed and nothing else", pull([[dir => { git(dir, ["mv", "a.md", `${term}.md`]); }]]));
fails("a term in a binary file's name, the file removed again", pull([[{ [`${other}.bin`]: "\u0000x\u0000" }], [{ [`${other}.bin`]: null }]]));
fails("a term outside plain ASCII in a file's name", pull([[{ [`a-${wide}.md`]: "x\n" }]]));
// a file named with a term before the rule, already on main: taking it out passes, by deletion or by renaming it away
const leaked = [[{ [`old-${term}.md`]: "kept\n" }, { GIT_AUTHOR_DATE: "2026-10-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-01T00:00:00Z" }, "before the rule"]];
const cleanup = change => { const repo = pull([], leaked); git(repo.dir, ["checkout", "-q", "-B", "change", "main"]); commitAll(repo.dir, [change]); return repo; };
passes("deleting a file named with a term before the rule", cleanup(dir => git(dir, ["rm", "-q", `old-${term}.md`])));
passes("renaming such a file to a clean name", cleanup(dir => git(dir, ["mv", `old-${term}.md`, "old.md"])));
fails("a term in a commit's message", pull([[{ "b.md": "x\n" }, {}, `fix for ${term}`]]));
fails("a term in a commit's author name", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: `A ${term}` }]]));
fails("a term in a commit's author address", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: `${other}@${NOREPLY}` }]]));
fails("a term in a commit's committer name", pull([[{ "b.md": "x\n" }, { GIT_COMMITTER_NAME: term }]]));
// a name the machine's git writes into every commit fails in a private repository too, and the failure says how the
// session mends the pull request itself (core archive 202), naming both commits
const named = check(pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: `A ${term}`, GIT_COMMITTER_EMAIL: `${other}@${NOREPLY}` }], [{ "c.md": "y\n" }, { GIT_AUTHOR_NAME: `A ${term}` }]]), { isPrivate: true });
ok(!named.passed && mended(named.out) && /Mend: on the machine that made them/.test(named.out) && /--reset-author/.test(named.out) && (named.out.split(/author or committer \(name or address\), below\.[^\n]*\n/u)[1]?.split("\n")[0].match(/\b[0-9a-f]{7,}\b/g) ?? []).length === 2 && ![term, other, wide].some(t => named.out.includes(t)),
  "a term in commits' author or committer fails in a private repository too, both commits named, the mend said and the term never printed", named.out);
// a merge of main into the branch, as "update branch" makes it (GitHub's) or as a person does
const onMain = [[{ "c.md": "y\n" }, {}, "on main"]];
// a merge GitHub made on main under the profile `name`, as each merge of a pull request is: the profiles the check takes
const profileOnMain = name => [[dir => { git(dir, ["checkout", "-q", "-b", "side"]); commitAll(dir, [{ "side.md": "s\n" }]); git(dir, ["checkout", "-q", "main"]); git(dir, ["merge", "-q", "--no-ff", "--no-edit", "side"], { GIT_AUTHOR_NAME: name, ...GITHUB }); }, {}, "after that merge"]];
const update = (committer, more = []) => pull([[{ "b.md": "x\n" }], [dir => { git(dir, ["merge", "-q", "--no-ff", "--no-edit", "main"], { GIT_AUTHOR_NAME: `A ${term}`, ...committer }); }]], [...onMain, ...more]);
if (gpg) {
  passes("a merge GitHub itself made into the branch, its author the merging account's profile, which GitHub wrote on a merge of main's (floor rule 11's exception)", update(GITHUB, profileOnMain(`A ${term}`)));
  fails("a merge GitHub signed into the branch, under an author no merge of GitHub's on main carries (as its API takes one), though it is a merge on the branch's own side", update(GITHUB));
  passes("a merge GitHub itself made into the branch, under a profile GitHub wrote on a squashed pull request of main's (one parent)", update(GITHUB, [[{ "sq.md": "s\n" }, { GIT_AUTHOR_NAME: `A ${term}`, ...GITHUB }, "a squashed pull request"]]));
  passes("the merge GitHub makes only to check the pull request, under the opener's profile, where main holds no commit of GitHub's under it", pull([[{ "b.md": "x\n" }]]), { opener: `A ${term}` });
  fails("a merge written to look like GitHub's, committed as GitHub but not signed", update(AS_GITHUB));
  fails("a merge committed as GitHub but signed by another key", update({ ...AS_GITHUB, ...signedBy(stranger, "someone@example.invalid") }));
  // a certificate made to look like GitHub's: an X.509 signature, which carries its own certificate and which gpgsm
  // reads as good where it is not told to trust none (made only where openssl and gpgsm can make one here)
  const forger = path.join(tmp, "x509");
  const x509 = (() => {
    try {
      fs.mkdirSync(forger, { mode: 0o700 });
      const run = (cmd, args, input) => execFileSync(cmd, args, { cwd: forger, env: { ...env, GNUPGHOME: forger }, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000 });
      run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "key.pem", "-out", "cert.pem", "-days", "30", "-subj", "/CN=GitHub/emailAddress=noreply@github.com"]);
      run("openssl", ["pkcs12", "-export", "-legacy", "-inkey", "key.pem", "-in", "cert.pem", "-out", "id.p12", "-passout", "pass:"]);
      run("gpgsm", ["--batch", "--pinentry-mode", "loopback", "--passphrase-fd", "0", "--import", "id.p12"], "\n");
      const fpr = run("gpgsm", ["--with-colons", "--list-secret-keys"]).split("\n").find(l => l.startsWith("fpr:"))?.split(":")[9];
      if (!fpr) return null;
      fs.writeFileSync(path.join(forger, "trustlist.txt"), `${fpr.match(/../g).join(":")} S relax\n`);
      fs.writeFileSync(path.join(forger, "gpgsm.conf"), "disable-crl-checks\ninclude-certs -1\n");
      const signing = { GNUPGHOME: forger, GIT_CONFIG_COUNT: "4", GIT_CONFIG_KEY_0: "commit.gpgSign", GIT_CONFIG_VALUE_0: "true", GIT_CONFIG_KEY_1: "gpg.format", GIT_CONFIG_VALUE_1: "x509", GIT_CONFIG_KEY_2: "user.signingKey", GIT_CONFIG_VALUE_2: fpr, GIT_CONFIG_KEY_3: "gpg.x509.program", GIT_CONFIG_VALUE_3: "gpgsm" };
      // (tried first: a commit it signs reads as good to a gpgsm that trusts nothing of its own, as the check's runner would)
      const probe = path.join(tmp, "x509-probe"), empty = path.join(tmp, "x509-empty");
      fs.mkdirSync(probe);
      fs.mkdirSync(empty, { mode: 0o700 });
      git(probe, ["init", "-q"]);
      git(probe, ["commit", "-q", "--allow-empty", "-m", "signed"], { ...AS_GITHUB, ...signing });
      return /^[GU]$/.test(git(probe, ["-c", "gpg.x509.program=gpgsm", "log", "-1", "--format=%G?"], { GNUPGHOME: empty })) ? signing : null;
    } catch {
      return null;
    }
  })();
  process.on("exit", () => { for (const home of [forger, path.join(tmp, "x509-empty")]) bash("gpgconf --kill all", { GNUPGHOME: home }); });
  if (x509) fails("a merge committed as GitHub but signed with a certificate made to look like GitHub's (X.509)", update({ ...AS_GITHUB, ...x509 }));
  else console.log("note openssl or gpgsm cannot make a certificate here, so a merge signed with one is not tried");
  const unfetched = check(update(GITHUB, profileOnMain(`A ${term}`)), { key: path.join(tmp, "no-such-key") });
  ok(!unfetched.passed && unfetched.out.includes("could not be fetched") && !unfetched.out.includes(term), "where GitHub's key cannot be fetched, no merge is taken for GitHub's, and the run says so", unfetched.out);
} else {
  console.log("note gpg cannot run here, so the merges GitHub signs are not tried (the check runs on GitHub's Linux runners alone)");
}
fails("a merge anyone else made, with a term in its author", update({}));
if (gpg) {
  // an edit on github.com: GitHub signs it, its author the acting account's profile, which GitHub also wrote as the
  // author of a merge it made on main; one made through GitHub's API, under an author its caller named, does not pass
  passes("a commit that is no merge GitHub itself made (an edit on github.com), under the profile GitHub wrote on a merge of main's", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: term, ...GITHUB }]], profileOnMain(term)));
  fails("a commit that is no merge GitHub signed, under an author no merge of GitHub's on main carries (as its API takes one)", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: term, ...GITHUB }]]));
}
fails("a commit that is no merge, with a term in its author, committed as GitHub but not signed", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_NAME: term, ...AS_GITHUB }]]));
// The address in each commit's author and committer line (#460, point 2), read with no secret too: a no-reply one
// passes, any other fails saying the mend, the commit and its line named and the address never printed; a commit main
// already holds is never read; a commit GitHub itself made under a profile it wrote on main is excepted, as for the
// terms, and one written to look so is not. Each address invented.
const personal = ["someone", "example.invalid"].join("@");
const addressFails = (what, repo, line, opts = {}) => {
  for (const terms of ["", TERMS]) {
    const r = check(repo, { terms, ...opts });
    ok(!r.passed && mended(r.out) && /is not a no-reply one/.test(r.out) && new RegExp(`\\b[0-9a-f]{7,} ${line}\\b`).test(r.out) && !r.out.includes(personal.split("@")[1]),
      `${what} fails${terms ? "" : " with no secret set"}, its commit and line named, the address never printed`, r.out);
  }
};
const addressPasses = (what, repo) => { for (const terms of ["", TERMS]) passes(`${what}${terms ? "" : ", with no secret set,"}`, repo, { terms }); };
addressPasses("commits under an account's no-reply address, with its id or without, a bot's, GitHub's own and Claude Code's, any letter case",
  pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: `a--scratch-builder@${NOREPLY}`, GIT_COMMITTER_EMAIL: `0+Scratch--Bot[bot]@${NOREPLY.toUpperCase()}` }],
    [{ "c.md": "y\n" }, { GIT_AUTHOR_EMAIL: ["noreply", "anthropic.com"].join("@"), GIT_COMMITTER_EMAIL: ["noreply", "github.com"].join("@") }]]));
addressFails("an author's address that is no no-reply one", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: personal }]]), "author");
addressFails("a committer's address that is no no-reply one", pull([[{ "b.md": "x\n" }], [{ "c.md": "y\n" }, { GIT_COMMITTER_EMAIL: personal }]]), "committer");
addressFails("an address that only looks like the host's no-reply one", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: `someone@${NOREPLY}.example.invalid` }]]), "author");
addressFails("an account's no-reply address with more than its id before the login", pull([[{ "b.md": "x\n" }, { GIT_AUTHOR_EMAIL: `someone+1@${NOREPLY}` }]]), "author");
addressPasses("a personal address only in a commit main already holds", pull([[{ "b.md": "x\n" }]], [[{ "c.md": "y\n" }, { GIT_AUTHOR_EMAIL: personal, GIT_COMMITTER_EMAIL: personal }, "on main"]]));
{
  const both = check(pull([[{ "b.md": `${term}\n` }, { GIT_AUTHOR_EMAIL: personal }]]));
  ok(!both.passed && mended(both.out) && /is not a no-reply one/.test(both.out) && /in these files/.test(both.out), "a personal address and a term together each fail, the terms read though the address failed", both.out);
}
if (gpg) {
  // (a merge GitHub made into the branch under the profile it wrote on a merge of main's, its address that profile's)
  const profiled = committer => pull([[{ "b.md": "x\n" }], [dir => { git(dir, ["merge", "-q", "--no-ff", "--no-edit", "main"], { GIT_AUTHOR_NAME: "Someone", GIT_AUTHOR_EMAIL: personal, ...committer }); }]],
    [...onMain, [dir => { git(dir, ["checkout", "-q", "-b", "side"]); commitAll(dir, [{ "side.md": "s\n" }]); git(dir, ["checkout", "-q", "main"]); git(dir, ["merge", "-q", "--no-ff", "--no-edit", "side"], { GIT_AUTHOR_NAME: "Someone", GIT_AUTHOR_EMAIL: personal, ...GITHUB }); }, {}, "after that merge"]]);
  addressPasses("a merge GitHub itself made into the branch under the profile it wrote on a merge of main's, whatever its address (floor rule 11's exception)", profiled(GITHUB));
  addressFails("such a merge written to look like GitHub's, committed as GitHub but not signed", profiled(AS_GITHUB), "author");
}
// a merge resolved by hand: the lines its resolution adds are read
const resolved = pull([[{ "a.md": "one\nmine\nthree\n" }], [dir => {
  try { git(dir, ["merge", "-q", "--no-edit", "main"]); } catch { /* (the conflict, resolved below) */ }
  fs.writeFileSync(path.join(dir, "a.md"), `one\n${term}\nthree\n`);
  git(dir, ["add", "a.md"]);
  git(dir, ["commit", "-q", "--no-edit"]);
}], [{ "a.md": "one\nboth\nthree\n" }]], [[{ "a.md": "one\ntheirs\nthree\n" }, {}, "on main"]]);
fails("a term in a line a merge's own resolution adds, taken out again later", resolved);
fails("a term in the title", pull([[{ "b.md": "x\n" }]]), { title: `About ${other}` });
fails("a term in the description", pull([[{ "b.md": "x\n" }]]), { body: `Words.\n\n${term}` });
fails("a term in the branch's name", pull([[{ "b.md": "x\n" }]]), { branch: `claude/${other}-notes` });
// a Claude Code session's link, whose random id holds a term by chance: of its one shape (01 and 22 characters of
// base58), the id alone is left unread; any other shape, host, or a term beside it still fails (#261)
const id = (inside, size = 22) => `01${`A${inside}BCDEFGHJKMNPQRSTUVWXYZabc`.slice(0, size)}`;
const link = (inside, size, host = "claude.ai/code/session_") => `https://${host}${id(inside, size)}`;
const signed = text => `A change\n\nCo-Authored-By: t <t@example.invalid>\nClaude-Session: ${text}\n`;
passes("a term only inside a session link's id, in a commit's message, a line added and taken out, a file and the description", pull([[{ "b.md": `See ${link(term)}.\n`, "c.md": `x\n${link(other.toUpperCase())}\n` }, {}, signed(link(term))], [{ "c.md": "x\n" }]]), { body: `Words.\n\n${link(other)}` });
fails("a term in a session link's id one character longer", pull([[{ "b.md": "x\n" }, {}, signed(link(term, 23))]]));
fails("a term in a session link's id one character shorter", pull([[{ "b.md": `${link(term, 21)}\n` }]]));
fails("a term in a session link's id holding a character outside base58", pull([[{ "b.md": "x\n" }]]), { body: link(`0${term}`) });
fails("a term in such an id under another host", pull([[{ "b.md": `${link(term, 22, "example.invalid/code/session_")}\n` }]]));
fails("a term in such an id in another address's path", pull([[{ "b.md": `${link(term, 22, "example.invalid/claude.ai/code/session_")}\n` }]]));
fails("a term in such an id in another address's query", pull([[{ "b.md": "x\n" }]]), { body: `https://example.invalid/?u=${link(term)}` });
passes("a term inside the ids of two session links side by side, and of one in Markdown's brackets", pull([[{ "b.md": `${link(term)} ${link(other)}\n[here](${link(term)}) <${link(other)}>\n` }]]));
fails("a term right after a session link's id", pull([[{ "b.md": "x\n" }, {}, signed(`${link("")}${term}`)]]));
fails("a term right after a session link's id and a letter outside plain ASCII", pull([[{ "b.md": `${link(term)}\u00e9\n` }]]));
// a hit left out beside one kept: only the second file is named, and a name is never printed as a command
const kept = check(pull([[{ "b.md": `${link(term)}\n`, "c.md": `x ${term}\n` }]]));
ok(!kept.passed && /^c\.md:1$/m.test(kept.out) && !/^b\.md:/m.test(kept.out), "a file whose term is only in a session link's id is left out, one beside it still named", kept.out);
if (process.platform !== "win32") {
  const odd = check(pull([[{ "::notice::odd\nname.md": `x ${term}\n` }]]));
  const [, token, inside] = /^::stop-commands::([0-9a-f]{32})\n([^]*?)^::\1::$/m.exec(odd.out) ?? [];
  ok(!odd.passed && token && inside === "::notice::odd?name.md:1\n", "a file's name made like a command is printed only where GitHub reads no command", odd.out);
}
// (under a UTF-8 locale, as GitHub's runners have, where grep would take such a line for binary)
fails("a term in a line added in Latin-1, taken out again", pull([[{ "b.md": Buffer.from(`caf\u00e9 ${term}\n`, "latin1") }], [{ "b.md": "x\n" }]]), { locale: "C.UTF-8" });
passes("a term inside the ids of three session links side by side", pull([[{ "b.md": `${link(term)} ${link(other)} ${link(term)}\n` }]]));
fails("a term on the same line as a session link, in a file", pull([[{ "b.md": `${link(term)} and ${other}\n` }]]));
fails("a term on the same line as a session link, in the title", pull([[{ "b.md": "x\n" }]]), { title: `${link(term)} ${term}` });
passes("a term only in a file whose content is binary (not read: the check's header says so)", pull([[{ "a.bin": `\u0000${term}\u0000` }]]));
// a .gitattributes of the pull request's own that marks text binary hides nothing: the check reads no attributes
fails("a term in a file of text a .gitattributes marks -diff", pull([[{ ".gitattributes": "*.md -diff\n", "b.md": `x ${term} y\n` }]]));
fails("a term in a line added to a file of text a .gitattributes marks binary, taken out again", pull([[{ ".gitattributes": "*.svg binary\n", "p.svg": `<svg><title>${other}</title></svg>\n` }], [{ "p.svg": "<svg></svg>\n" }]]));
// the list as an owner may paste it: a Windows line end after each term, blanks around one
fails("a term listed with a Windows line end, in a message, an added line taken out again and the title", pull([[{ "b.md": `x ${term} y\n` }, {}, `msg ${term}`], [{ "b.md": "gone\n" }]]), { terms: `${term}\r\n${other}\r\n`, title: `About ${term}` });
fails("a term listed with blanks around it", pull([[{ "b.md": `${term} starts this line\n` }]]), { terms: ` ${term} \n` });
// a file whose name and content both hold a term: its line is said, never its name, in whatever case it is written
fails("a term in a file's content and in its name, in capitals", pull([[{ [`notes-${term.toUpperCase()}.md`]: `x ${term}\n` }]]));
if (process.platform !== "win32") fails("a term in a file's content and in its name, the name holding a colon", pull([[{ [`x:notes-${term}.md`]: `x ${term}\n` }]]));
// an octopus merge, which git's remerge-diff skips: the lines in none of its parents are read
const octopus = pull([[{ "b.md": "x\n" }], [dir => {
  for (const side of ["o1", "o2"]) { git(dir, ["checkout", "-q", "-b", side, "main"]); commitAll(dir, [{ [`${side}.md`]: "s\n" }]); }
  git(dir, ["checkout", "-q", "change"]);
  git(dir, ["merge", "-q", "--no-edit", "o1", "o2"]);
  fs.writeFileSync(path.join(dir, "a.md"), `one\n${term}\nthree\n`);
  git(dir, ["add", "a.md"]);
  git(dir, ["commit", "-q", "--amend", "--no-edit"]);
}], [{ "a.md": "one\ntwo\nthree\n" }]]);
fails("a term in a line an octopus merge adds of its own, taken out again later", octopus);
// what a project held before the check read more fails too, a listed term being the one exception to reporting it, and
// each failure says how the session takes the term out (core archive 207)
const mendedSays = (what, repo, opts, words) => { const r = check(repo, opts); ok(!r.passed && r.out.includes(words) && mended(r.out) && ![term, other, wide].some(t => r.out.toLowerCase().includes(t.toLowerCase())), `${what}: it fails, saying how to take the term out`, r.out); };
mendedSays("a term main already held, in a file of text a .gitattributes marks binary, which the check reads only now", pull([[{ "b.md": "x\n" }]], [[{ ".gitattributes": "*.svg binary\n", "logo.svg": `<svg><title>${term}</title></svg>\n` }]]), {}, "edit each of those lines");
mendedSays("a term added in one commit and taken out in the next", pull([[{ "b.md": `${term}\n` }], [{ "b.md": "gone\n" }]]), {}, "rewrite those commits without it");
mendedSays("a term in a commit's message", pull([[{ "b.md": "x\n" }, {}, `fix for ${term}`]]), {}, "git rebase -i origin/main");
mendedSays("a term in the title", pull([[{ "b.md": "x\n" }]]), { title: `About ${other}` }, "edit the title or the description");
mendedSays("a term in the branch's name", pull([[{ "b.md": "x\n" }]]), { branch: `claude/${other}` }, "pushing its work to a branch of another name");
// LICENSE and NOTICE, at the root and in a project's copy of the core, where a copyright holder's name may stand (floor
// rule 11; #257): the core's own two files, the holder replaced by a term, go unread while they keep their shape, and
// only their copyright lines do; any other text, file or place still fails
const LICENCE = fs.readFileSync(path.join(root, "LICENSE"), "utf8"), NOTICE = fs.readFileSync(path.join(root, "NOTICE"), "utf8");
// (each copyright line opened as the core's own NOTICE opens its own, so this file holds no licence notice of its own
// for the core's licence scan to audit)
const opening = /^Copyright \S+/m.exec(NOTICE)?.[0], held = holder => `${opening} ${holder}`;
const licence = holder => LICENCE.replace(/^( *)Copyright \[yyyy\] \[name of copyright owner\]$/m, `$1${held(holder)}`);
const notice = holder => NOTICE.replace(/^Copyright .*$/m, held(holder));
ok(opening && licence(term) !== LICENCE && notice(term) !== NOTICE, "the core's LICENSE holds Apache's line for the holder, and its NOTICE a copyright line");
passes("a term only in the holder's line of the core's LICENSE and NOTICE, at the root and in core/, one with Windows line ends", pull([[{ LICENSE: licence(`A ${term}`), NOTICE: notice(term), "core/LICENSE": licence(other).replace(/\n/g, "\r\n"), "core/NOTICE": notice(`${wide} AS`) }]]));
// (the copy at the path the manifest on the base names, #918: the files there are of the copy as any at core/ is, the
// manifest the pull request itself writes names none, and a project's own core/ folder is read where the copy is elsewhere)
const line = place => `# Core manifest\n\nCore: ${CORE} at ${"a".repeat(40)}, copied whole under ${place} (never edited here).\n`;
const copied = place => ({ [`${place}LICENSE`]: licence(`A ${term}`), [`${place}NOTICE`]: notice(term) });
const manifestOnMain = place => [[{ "core-manifest.md": line(place) }, {}, "the manifest"]];
passes("a term only in the holder's line of LICENSE and NOTICE in the copy where the base's manifest names it, at a path other than core/", pull([[copied("vendor/core/")]], manifestOnMain("vendor/core/")));
passes("  and one at a path of three folders, with the manifest's line ending there", pull([[copied("a/b/core/")]], manifestOnMain("a/b/core/")));
passes("  and the copy a library carries", pull([[copied("lib/core/")]], [[{ "core-manifest.md": `# Core manifest\n\nCore: ${CORE}, carried by lib/ under lib/core/ (never edited here).\n` }, {}, "the manifest"]]));
fails("  a copy's pair of files at another path than the manifest names", pull([[copied("vendor/core/")]], manifestOnMain("third_party/core/")));
passes("  the copy where the manifest of the merge's own base names it, though the event names an older base that held none", pull([[copied("vendor/core/")]], manifestOnMain("vendor/core/")), { stale: true });
fails("  the project's own core/ files where the manifest names the copy elsewhere", pull([[copied("core/")]], manifestOnMain("vendor/core/")));
fails("  a path the pull request's own manifest names, the base's naming none", pull([[{ "core-manifest.md": line("vendor/core/"), ...copied("vendor/core/") }]]));
fails("  a copy's files out of their shape, as at core/", pull([[{ "vendor/core/NOTICE": `A ${term} work\n${held(other)}\n` }]], manifestOnMain("vendor/core/")));
passes("  with the base's manifest naming a path inside node_modules, the files at core/ keep their exemption", pull([[copied("core/")]], manifestOnMain("node_modules/core/")));
passes("a NOTICE whose holder a later commit changes to a term (as the owner does by hand)", pull([[{ NOTICE: NOTICE }], [{ NOTICE: notice(term) }]]));
passes("a LICENSE of copyright lines alone, each holding a term", pull([[{ LICENSE: `${held(term)}. All rights reserved.\n${held(other)}\n` }]]));
mendedSays("a NOTICE with a line more than its name and copyright lines", pull([[{ NOTICE: `${notice(term)}Made by hand.\n` }]]), {}, "bring one named here back to that");
fails("a term in a NOTICE's name line", pull([[{ NOTICE: `A ${term} work\n${held(other)}\n` }]]));
fails("a LICENSE one word off Apache's text, a term in its holder's line", pull([[{ LICENSE: licence(term).replace("royalty-free", "royalty-bearing") }]]));
fails("a term in a LICENSE's holder's line that holds an address", pull([[{ LICENSE: licence(`${term}@example.invalid`) }]]));
fails("a term in a holder's line longer than a hundred characters", pull([[{ NOTICE: notice(`${term} ${"x".repeat(100)}`) }]]));
fails("a LICENSE of four copyright lines, a term in one", pull([[{ LICENSE: `${[term, "a", "b", "c"].map(held).join("\n")}\n` }]]));
fails("a NOTICE of its shape in another folder", pull([[{ "docs/NOTICE": notice(term) }]]));
fails("a NOTICE.md of a NOTICE's shape", pull([[{ "NOTICE.md": notice(term) }]]));
// (under a UTF-8 locale, as GitHub's runners have, where grep drops a line that is not UTF-8, and any after a late NUL)
fails("a term on a line in Latin-1 added to the core's NOTICE", pull([[{ NOTICE: Buffer.concat([Buffer.from(notice("x")), Buffer.from(`caf\u00e9 ${term}\n`, "latin1")]) }]]), { locale: "C.UTF-8" });
fails("a term on a line in Latin-1 added to the core's LICENSE, in core/", pull([[{ "core/LICENSE": Buffer.concat([Buffer.from(licence("x")), Buffer.from(`caf\u00e9 ${term}\n`, "latin1")]) }]]), { locale: "C.UTF-8" });
fails("a term after a NUL far into LICENSE", pull([[{ LICENSE: `${licence("x")}${"\n".repeat(200000)}\u0000\n${term} here\n` }]]), { locale: "C.UTF-8" });
fails("a term after a NUL far into LICENSE, in the C locale", pull([[{ LICENSE: `${licence("x")}${"\n".repeat(200000)}\u0000\n${term} here\n` }]]));
fails("a term on a line in Latin-1 in a NOTICE main already held", pull([[{ "b.md": "x\n" }]], [[{ NOTICE: Buffer.concat([Buffer.from(notice("x")), Buffer.from(`caf\u00e9 ${term}\n`, "latin1")]) }]]), { locale: "C.UTF-8" });
fails("a term in the message of a commit that edits NOTICE alone", pull([[{ NOTICE: notice("x") }, {}, `holder ${term}`]]));
fails("a term in a NOTICE out of its shape in one commit, brought to it in the next", pull([[{ NOTICE: `${notice(term)}more words\n` }], [{ NOTICE: notice(term) }]]));
fails("a term in a commit dated before the rule, added and taken out again, its author too (a date is its maker's to write)", pull([[{ "b.md": `${term}\n` }, { GIT_AUTHOR_NAME: term, GIT_AUTHOR_DATE: "2026-10-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-01T00:00:00Z" }], [{ "b.md": "gone\n" }]]));
passes("a term only in a commit of the base's, though the event names an older base", pull([[{ "b.md": "x\n" }]], [[{ "c.md": "y\n" }, { GIT_AUTHOR_NAME: term, ...GITHUB }, "squashed on main"]]), { stale: true });
// what Betterleaks, which matches the terms, would read otherwise than the check means (#579): a file of text that
// begins as an archive or a PDF does, a line marked for it to pass over, its ignore and config files in the pull
// request, a term in base64 (not decoded, as before), and a term holding what a pattern would read otherwise
fails("a term in a file of text that begins as a zip archive or a PDF does", pull([[{ "a.txt": `PK\u0003\u0004 ${term}\n`, "b.txt": `%PDF-1.4 ${other}\n` }]]));
fails("a term on a line marked for a scanner to pass over (gitleaks:allow, betterleaks:allow)", pull([[{ "b.md": `${term} # gitleaks:allow\n${other} # betterleaks:allow\n` }]]));
const ignored = Array.from({ length: 400 }, (_, i) => `:term-1:${i + 1}\n:term-2:${i + 1}`).join("\n");
const allowAll = "[allowlist]\nregexes = ['''.*''']\n";
// (the term in a file whose name comes before theirs, so that its line is among the first the scanner is given, and
// that file named, whatever the commit's own lines say)
const beside = check(pull([[{ ".betterleaksignore": `${ignored}\n`, ".gitleaksignore": `${ignored}\n`, ".gitleaks.toml": allowAll, ".betterleaks.toml": allowAll, "+notes.md": `x ${term}\n` }]]));
ok(!beside.passed && /^\+notes\.md:1$/m.test(beside.out) && !beside.out.includes(term), "a term in a file beside the pull request's own ignore and config files for the scanner fails, the file named", beside.out);
passes("a term only in base64, which the check does not decode", pull([[{ "b.md": `${Buffer.from(`a line with ${term} in it`).toString("base64")}\n` }]]));
const oddTerm = ["a.", "\\E", '"c'].join("");
fails("a term holding a dot, a backslash and E and a quote, written as listed", pull([[{ "b.md": `x ${oddTerm.toUpperCase()} y\n` }]]), { terms: `${oddTerm}\n` });
passes("a term holding a dot, where only a pattern's dot would match it", pull([[{ "b.md": `x ${oddTerm.replace(".", "z")} y\n` }]]), { terms: `${oddTerm}\n` });
// what Betterleaks reads in chunks never hides a term (the fallback security review of #656): a file's name that puts a
// type's mark where it reads one (DICOM's at byte 128, tar's at byte 257), a term on any line of a long run with no
// blank line, and one across any cut of a line longer than its chunks
// (each name the first the check reads, so that its mark stands where Betterleaks reads one, had the input no lines
// before it: DICOM's at byte 128, tar's at byte 257)
fails("a term beside a file whose name puts DICOM's mark where Betterleaks reads one", pull([[{ [`${"!".repeat(127)}DICM`]: "x\n", "b.md": `x ${term}\n` }]]));
fails("a term beside a file whose name puts tar's mark where Betterleaks reads one", pull([[{ [`${"!".repeat(200)}/${"!".repeat(55)}ustar`]: "x\n", "b.md": `x ${term}\n` }]]));
// (every line the term alone, so that a chunk cut anywhere inside a line would lose that line)
const lines40k = 40000, dense = check(pull([[{ "long.txt": `${term}\n`.repeat(lines40k) }]]));
const namedLines = new Set([...dense.out.matchAll(/^long\.txt:(\d+)$/gmu)].map(m => Number(m[1])));
ok(!dense.passed && namedLines.size === lines40k, "a term on every line of a run of 40,000 with no blank line is named on every line", `${namedLines.size} of ${lines40k} named`);
// (the longest term's bytes, by which the pieces of a long line overlap: a term starting on each side of the end of
// the first and the second piece of 20,000 bytes)
const step = 20000 - Math.max(...[term, other, wide].map(t => Buffer.byteLength(t)));
const starts = [20000 - term.length + 1, 20000 - 2, 20000, step + 20000 - term.length + 1, step + 20000 - 2, step + 20000];
const longLines = starts.map(st => `${"z".repeat(st - 1)}${term}${"z".repeat(60000 - st - term.length + 1)}`);
const widest = check(pull([[{ "wide.txt": `${longLines.join("\n")}\n` }]]));
ok(!widest.passed && starts.every((_, i) => new RegExp(`^wide\\.txt:${i + 1}$`, "mu").test(widest.out)), "a term across each edge of the pieces a line of 60,000 characters is cut in is named on its line", widest.out.split("\n").filter(l => l.startsWith("wide.")).join(" "));
// Betterleaks at its pin: where it was not fetched (no pin for the machine's system, a release that cannot be
// downloaded), the check fails, saying the mend, since it guards what may not leak (Codex's security finding on #656),
// and a kept copy that differs from its sum never runs (a uname of the test's own stands in for another system)
const unfetched = (what, opts, words, also = () => true) => { const r = check(pull([[{ "b.md": `${term}\n` }]]), opts); ok(!r.passed && mended(r.out) && r.out.includes(words) && r.out.includes("was not fetched at its pin") && r.out.includes("so nothing was read") && !r.out.includes(term) && also(), `${what}: it fails, saying the mend, never passing unread`, r.out); };
const otherSystem = path.join(tmp, "plan9");
fs.mkdirSync(otherSystem);
fs.writeFileSync(path.join(otherSystem, "uname"), `#!/bin/sh\ncase "$1" in -s) echo Plan9 ;; -m) echo 386 ;; *) echo Plan9 ;; esac\n`, { mode: 0o755 });
unfetched("where no pin stands for the machine's system", { more: otherSystem }, "no pin stands in this check for Plan9/386");
// (where the folder the address step works in cannot be made, as Git for Windows' mkdir could not make it with a mode,
// #1211, the step fails, saying the mend, and reads nothing; a mkdir of the test's own stands in for one that fails)
const noFolder = path.join(tmp, "no-folder");
fs.mkdirSync(noFolder);
fs.writeFileSync(path.join(noFolder, "mkdir"), `#!/bin/sh\ncase "$*" in *commit-addresses*) echo "mkdir: cannot create directory: Permission denied" >&2; exit 1 ;; esac\ncommand -p mkdir "$@"\n`, { mode: 0o755 });
const unmade = check(pull([[{ "b.md": "Words.\n" }]]), { more: noFolder });
ok(!unmade.passed && mended(unmade.out) && unmade.out.includes("could not be made, so no commit's address was read"), "where the address step's folder cannot be made, it fails, saying the mend", unmade.out);
ok(!unmade.out.includes(tmp) && !unmade.out.includes("cannot create directory"), "that failure names the runner's temporary folder, never writing out its path (#1223)", unmade.out);
// (and where the scan step's own folder cannot be made, that step fails, saying the mend, named the same way)
const noScanFolder = path.join(tmp, "no-scan-folder");
fs.mkdirSync(noScanFolder);
fs.writeFileSync(path.join(noScanFolder, "mkdir"), `#!/bin/sh\ncase "$*" in *personal-terms/none*) echo "mkdir: cannot create directory '$*': Permission denied" >&2; exit 1 ;; esac\ncommand -p mkdir "$@"\n`, { mode: 0o755 });
const unscanned = check(pull([[{ "b.md": "Words.\n" }]]), { more: noScanFolder });
ok(!unscanned.passed && mended(unscanned.out) && unscanned.out.includes("RUNNER_TEMP/personal-terms, could not be made, so nothing was read") && !unscanned.out.includes(tmp) && !unscanned.out.includes("cannot create directory"),
  "where the scan step's folder cannot be made, it fails, saying the mend, never writing out its path (#1223)", unscanned.out);
const sum = /Linux\/x86_64\) file=\S+ archive=[0-9a-f]{64} sum=([0-9a-f]{64})/.exec(workflow)?.[1], version = /version=(\S+)/.exec(workflow)?.[1];
const keptTool = path.join(tmp, "kept"), keptDir = path.join(keptTool, "agent-core-tools", `betterleaks-${version}`), ran = path.join(tmp, "kept-ran");
fs.mkdirSync(keptDir, { recursive: true });
for (const name of ["betterleaks", "betterleaks.exe"]) fs.writeFileSync(path.join(keptDir, name), `#!/bin/sh\ntouch '${ran}'\n`, { mode: 0o755 });
unfetched("where its release cannot be downloaded, a kept copy that differs from its sum beside it", { store: keptTool, fetchFails: true }, "could not be downloaded", () => sum && !fs.existsSync(ran));
// (a store whose folder is a link, as another account could make at that name: nothing is written through it, and the
// check fails, never running what stands there; the fallback security review of 20 November on #656)
const linked = path.join(tmp, "linked"), elsewhere = path.join(tmp, "elsewhere");
fs.mkdirSync(linked);
fs.mkdirSync(elsewhere);
if (process.platform !== "win32") {
  fs.symlinkSync(elsewhere, path.join(linked, "agent-core-tools"));
  unfetched("where the store's folder is a link", { store: linked }, "is not a folder of this user's own", () => fs.readdirSync(elsewhere).length === 0);
  const linkedOut = check(pull([[{ "b.md": "Words.\n" }]]), { store: linked }).out;
  ok(linkedOut.includes("../agent-core-tools is not a folder of this user's own") && !linkedOut.includes(linked), "the store's log names its folders from the fetch's own, never writing out the temporary folder (#1223)", linkedOut);
}
{
  const fresh = path.join(tmp, "fresh-store");
  fs.mkdirSync(fresh);
  const fetched = check(pull([[{ "b.md": "Words.\n" }]]), { store: fresh });
  ok(fetched.passed && fetched.out.includes("TMPDIR/agent-core-tools/betterleaks-") && !fetched.out.includes(fresh), "the program fetched is named under TMPDIR, never by its full path (#1223)", fetched.out);
  const given = fetched.outputs.betterleaks?.outputs?.path ?? "";
  ok(/^agent-core-tools\/betterleaks-[^/]+\/betterleaks(\.exe)?$/.test(given), "the scan step is given the program's path from the temporary folder, which the runner prints in its log, never the full path (#1223)", given);
  const unfetchedStore = path.join(tmp, "unfetched-store");
  fs.mkdirSync(unfetchedStore);
  const failedFetch = check(pull([[{ "b.md": "Words.\n" }]]), { store: unfetchedStore, fetchFails: true });
  ok(!failedFetch.passed && failedFetch.out.includes("Failed writing to the file archive.") && !failedFetch.out.includes(unfetchedStore), "a failed download's log names the archive as curl was given it, from the fetch's own folder, never writing out the temporary folder (#1223)", failedFetch.out);
}
const tooLong = check(pull([[{ "b.md": "x\n" }]]), { terms: `${term}\n${"q".repeat(2001)}\n` });
ok(!tooLong.passed && mended(tooLong.out) && tooLong.out.includes("longer than 2,000 bytes") && !tooLong.out.includes(term), "a term longer than the check can read whole fails, saying the mend, never hanging", tooLong.out);
const none = check(pull([[{ "b.md": `${term}\n` }]]), { terms: "" });
ok(none.passed && none.out.includes("PERSONAL_TERMS is not set"), "without the secret it passes with a note: the check stays optional", none.out);

done("the personal-terms check");
