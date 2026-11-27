// Tests the writer of the step of an agent's own tools (step 360, #1361, point 2; steps.mjs --write) on a project the
// starter kit of this commit writes in a scratch folder, committed: a skill of the project's own, and a hook in the kit's
// form that fetches a committed script of its own, are listed as the project's; a plug-in, a hook of another kind or one
// that fetches the core's copy, a skill not committed or in a submodule, and a licence config that is no JSON object are
// left to the step's mend; and an entry that stands in a form the check refuses is not written twice. The other writers
// are steps-write-test.mjs's. Node's own modules and git.
//
//   node tests/steps-write-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { kitIn } from "../scripts/steps-kit.mjs";
import { STEPS, notDone } from "../scripts/steps.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";
import { listings, shown } from "../scripts/agent-tools-listing.mjs";

const { ok, done } = tally();
const dir = kitIn(scratchDir("steps-write-tools-"))("an-npm-project", { packages: "." });
const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
const commit = what => { git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", what); };
const write = (...args) => spawnSync(process.execPath, ["core/scripts/steps.mjs", "--write", ...args], { cwd: dir, encoding: "utf8" });
const read = f => fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/gu, "\n");
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
// (git's listings are kept a process by the name of the commit, so each reading here starts from none)
const missed = lead => { listings.clear(); shown.clear(); return notDone(dir).filter(m => m.lead === lead); };
const lead = n => STEPS.find(s => s.lead.startsWith(n)).lead;
commit("the starter kit");
const kit = git("rev-parse", "HEAD").trim();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const back = () => { git("reset", "-q", "--hard", kit); git("clean", "-qfd"); };
let r;

// ---- an agent's own tools (#1361, point 2): a skill of the project's own listed, a plug-in left to a session ----
{
  const tools = lead("16 November 2026, an agent's own tools"), file = "checks/licences.json", before = JSON.parse(read(file));
  put(".claude/skills/release-notes/SKILL.md", "---\nname: release-notes\ndescription: Writes the release notes.\n---\nRead the merged pull requests and write the notes.\n");
  commit("a skill of the project's own, listed nowhere");
  ok(missed(tools).length === 1, "a skill listed nowhere leaves the step not done", JSON.stringify(missed(tools)));
  r = write();
  const after = JSON.parse(read(file)), added = (after.agentTools ?? []).filter(e => !(before.agentTools ?? []).some(b => same(b, e)));
  ok(r.status === 0 && r.stdout.includes(`- ${tools}: wrote \`${file}\`; the step is done`) && same(added, [{ kind: "skill", name: "release-notes", publisher: "this project" }])
    && same({ ...after, agentTools: undefined }, { ...before, agentTools: undefined }) && !missed(tools).length,
  "--write lists a skill of the project's own as the project's, its other keys kept, and the step reads done", `${r.stdout}${r.stderr}`);
  commit("the skill listed");
  const settings = JSON.parse(read(".claude/settings.json"));
  put(".claude/settings.json", `${JSON.stringify({ ...settings, enabledPlugins: { "notes@example-market": true } }, null, 2)}\n`);
  put(".claude/skills/triage/SKILL.md", "---\nname: triage\ndescription: Sorts new issues.\n---\nLabel each new issue.\n");
  commit("a plug-in and a second skill, listed nowhere");
  r = write();
  const left = missed(tools)[0]?.mend ?? "", listedNow = JSON.parse(read(file)).agentTools;
  ok(r.status === 0 && listedNow.some(e => e.kind === "skill" && e.name === "triage" && e.publisher === "this project") && !listedNow.some(e => e.kind === "plugin")
    && left.includes("notes@example-market") && !left.includes("triage"),
  "a plug-in, whose publisher and version no file gives, is left to the step's mend, and the skill beside it listed", `${r.stdout}${r.stderr}\n${left}`);
  back();
  put(file, "[]\n");
  put(".claude/skills/release-notes/SKILL.md", "---\nname: release-notes\ndescription: Writes the release notes.\n---\nWrite the notes.\n");
  commit("a skill listed nowhere, and a licence config that is no JSON object");
  r = write();
  ok(r.status === 0 && r.stdout.includes(`- ${tools}: wrote nothing, since`) && read(file) === "[]\n", "a licence config that is no JSON object is left, and the report says why", r.stdout);
  back();
  // (what is listed only where it is committed, outside a submodule and the copy, and a hook only in the kit's form, fetching the project's own file)
  const kitHook = at => `bash -c 'f=$(git -C "\${CLAUDE_PROJECT_DIR:-.}" --no-replace-objects show refs/remotes/origin/main:${at} 2>/dev/null) || exit 0; bash -c "$f"'`;
  const withHooks = (...hooks) => { const s = JSON.parse(read(".claude/settings.json")); s.hooks = { ...(s.hooks ?? {}), PostToolUse: [...(s.hooks?.PostToolUse ?? []), { matcher: "Edit", hooks }] }; put(".claude/settings.json", `${JSON.stringify(s, null, 2)}\n`); };
  const listed = () => JSON.parse(read(file)).agentTools ?? [], hookListed = () => listed().filter(e => e.kind === "hook" && !(before.agentTools ?? []).some(b => same(b, e)));
  put("scripts/format.sh", "#!/bin/sh\necho formatted\n");
  withHooks({ type: "command", command: kitHook("scripts/format.sh") });
  commit("a hook in the kit's form, fetching a script of the project's own");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  r = write();
  ok(r.status === 0 && hookListed().length === 1 && hookListed()[0].publisher === "this project" && !missed(tools).length,
    "a hook in the kit's form that fetches a committed script of the project's own is listed as the project's", `${r.stdout}${r.stderr}${JSON.stringify(listed())}`);
  git("update-ref", "-d", "refs/remotes/origin/main"); back();
  withHooks({ type: "command", command: kitHook("core/scripts/work-saved.sh") }, { type: "command", command: kitHook("core/scripts/helper-call.mjs") });
  commit("a hook in the kit's form, fetching a file of the core's copy");
  r = write();
  ok(r.status === 0 && !hookListed().length, "a hook that fetches a file of the core's copy is not listed as the project's", `${r.stdout}${JSON.stringify(listed())}`);
  back();
  withHooks({ type: "http", url: "https://example.invalid/hook" });
  commit("a hook of another kind");
  r = write();
  ok(r.status === 0 && !hookListed().length && missed(tools).length === 1, "a hook of another kind is left to the step's mend", `${r.stdout}${JSON.stringify(listed())}`);
  back();
  put(".claude/skills/drafts/SKILL.md", "---\nname: drafts\ndescription: Not committed.\n---\nWrite a draft.\n");
  r = write();
  ok(r.status === 0 && !listed().some(e => e.name === "drafts"), "a skill not yet committed is not listed", `${r.stdout}${JSON.stringify(listed())}`);
  back();
  const sub = path.join(dir, ".claude/skills/vendored");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, "SKILL.md"), "---\nname: vendored\ndescription: Another's.\n---\nDo another's work.\n");
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "init", "-q"], { cwd: sub });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "add", "-A"], { cwd: sub });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "another's skill"], { cwd: sub });
  git("-c", "advice.addEmbeddedRepo=false", "add", "-A"); git("commit", "-qm", "a skill in a submodule");
  r = write();
  ok(r.status === 0 && !listed().some(e => e.name === "vendored"), "a skill in a submodule is not listed as the project's", `${r.stdout}${JSON.stringify(listed())}`);
  back(); fs.rmSync(sub, { recursive: true, force: true });
  put(file, `${JSON.stringify({ ...before, agentTools: [...(before.agentTools ?? []), { kind: "skill", name: "release-notes" }] }, null, 2)}\n`);
  put(".claude/skills/release-notes/SKILL.md", "---\nname: release-notes\ndescription: Writes the release notes.\n---\nWrite the notes.\n");
  commit("a skill whose entry stands in a form the check refuses");
  r = write();
  ok(r.status === 0 && listed().filter(e => e.name === "release-notes").length === 1, "an entry that stands for a tool, in a form the check refuses, is not written twice", `${r.stdout}${JSON.stringify(listed())}`);
  back();
}

done("the writer of an agent's own tools");
