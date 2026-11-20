// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): a tool's files in
// another letter case and what git stores where a tool reads its files. Each case a made-up project in a temporary
// git repository, never a real one, run as licences.yml runs the check, and every failure read for its mend
// (mend.mjs). Git and Node's own modules; the projects and their runs stand in scripts/agent-tools-scratch.mjs, which
// the tests beside this one share.
//
//   node tests/agent-tools-case-test.mjs
import fs from "node:fs";
import path from "node:path";
import { STEPS, notDone } from "../scripts/steps.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { kitHooks } from "../scripts/agent-tools.mjs";
import { kitForm } from "../scripts/hook-source.mjs";
import { run, pr, project, listing, codexHook, write, cli, LINKS, withHook, KIT_HOOK, entry, git, script, TREE_HOOK, NOT_KIT, fromWorkingTree, kitCommand, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

{
// (a tool's file in another case is what a file system that ignores case gives the tool)
fails(run(pr(project({ ...listing() }), { ".Codex/hooks.json": codexHook({ type: "command", command: "bash scripts/evil.sh" }) })), "a tool's file in another case fails", ".Codex is .codex in another case", "Mend: rename it to .codex");
fails(run(pr(project({ ...listing() }), { ".Kiro/hooks/x.JSON": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/evil.sh" } }] } })), "and so does a Kiro hook file in another case, its .json too", "Mend: rename it to .kiro");
fails(run(pr(project({ ...listing() }), { ".kiro/hooks/x.JSON": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/evil.sh" } }] } })), "and a Kiro hook file whose .json is in another case", "Mend: rename it to .kiro/hooks/x.json");
// (a folder the project's own helper writes none of, so a file system that ignores case keeps the name as written)
const oddStood = run(pr(project({ ".Codex/config.toml": "# none\n", ...listing() }), { "README.md": "a change of its own\n" }));
ok(oddStood.status === 0 && /\.Codex is \.codex in another case/.test(oddStood.out), "one the base held is noted, not failed", oddStood.out);
fails(run(pr(project({ ".Codex/config.toml": "# none\n", ...listing() }), { ".Codex/config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n" })), "but not once the pull request changes it", "Mend: rename it to .codex");
const caseStep = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
ok(notDone(project({ ".Codex/config.toml": "# none\n", ...listing() }), caseStep)[0]?.mend.includes("Mend: rename it to .codex"), "the sync note's step reads not done while a tool's file stands in another case");
// (what the tool reads under it is found through each folder's own names, in whatever case they stand, so one the base
  // held is noted only while each file the tool reads there stands)
const deep = (files, changed, says) => fails(run(pr(project({ ...files, ...listing() }), changed)), says, "in another case", "Mend: rename it to");
deep({ ".Codex/Config.toml": "# none\n" }, { ".Codex/Config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n" }, "and not once the pull request changes a file under it in another case too");
deep({ ".Kiro/Hooks/lint.json": "{}\n" }, { ".Kiro/Hooks/lint.json": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/new.sh" } }] } }, "nor a hook file in a folder under it in another case");
deep({ ".Claude/Skills/notes/skill.md": "# notes\n" }, { ".Claude/Skills/notes/skill.md": "# notes, changed\n" }, "nor a skill's file under it in another case");
deep({ ".Kiro/Hooks/lint.json": "{}\n" }, { ".Kiro/Hooks/new.json": "{}\n" }, "nor a hook file added under it");
fails(run(pr(project({ ...listing() }), { ".claude/skills/notes/Skill.md": "# notes\n" })), "and a skill whose SKILL.md is in another case", "Mend: rename it to .claude/skills/notes/SKILL.md");
// (a skill's folder in another case is left out where the file system ignores case, as Windows' and macOS's do: there
  // the working tree gives the tool's own name what git's tree holds under another, so the skill reads as new)
const caseless = (() => { const d = scratchDir("agent-tools-"); fs.writeFileSync(path.join(d, "a"), ""); return fs.existsSync(path.join(d, "A")); })();
const deepStood = run(pr(project({ ".Kiro/Hooks/lint.json": "{}\n", ...(caseless ? {} : { ".Claude/Skills/notes/skill.md": "# notes\n" }), ...listing() }), { "README.md": "a change of its own\n" }));
ok(deepStood.status === 0 && /\.Kiro is \.kiro in another case/.test(deepStood.out) && (caseless || /\.Claude is \.claude in another case/.test(deepStood.out)), "while what stands under it is noted, not failed", deepStood.out);
// (#600's code review of 038f301: what the tool does not read under it changes nothing of what it reads, and a folder
  // whose files are all ignored holds none of the project's)
const docStood = run(pr(project({ ".Kiro/hooks/lint.json": "{}\n", ".Kiro/hooks/README.md": "notes\n", ...listing() }), { ".Kiro/hooks/README.md": "notes, changed\n" }));
ok(docStood.status === 0 && /\.Kiro is \.kiro in another case/.test(docStood.out), "a file under it the tool does not read, changed, leaves it noted", docStood.out);
const ignoredBase = project({ ".gitignore": ".Codex/*\n", ...listing() });
write(ignoredBase, ".Codex/config.toml", "notify = [\"bash\", \"x.sh\"]\n");
passes(run(pr(ignoredBase, { "README.md": "a change of its own\n" })), "and a folder in another case whose files are all ignored is none of the project's");
// (#600's code review of e380041: and an ignored file beside a tracked one is none of what the tool's note is held to)
const besideBase = project({ ".gitignore": ".Codex/config.toml\n", ".Codex/hooks.json": "{}\n", ...listing() });
write(besideBase, ".Codex/config.toml", "notify = [\"bash\", \"x.sh\"]\n");
const besideRun = run(pr(besideBase, { "README.md": "a change of its own\n" }));
ok(besideRun.status === 0 && /\.Codex is \.codex in another case/.test(besideRun.out), "an ignored file beside a tracked one under it leaves it noted", besideRun.out);
// (#600's code review of b2502b6: a file in a tool folder that the tool does not read names no folder on its way)
const unread = pr(project({ ".gitignore": ".Kiro/hooks/*.json\n", ...listing() }), { "README.md": "a change of its own\n" });
write(unread, ".Kiro/hooks/lint.json", "{}\n");
write(unread, ".Kiro/hooks/README.md", "notes\n");
passes(run(unread), "a file there the tool does not read, beside its ignored hooks, is no tool's file");
// (#600's fallback security review of 8dfe536: a commit git cannot list is no commit with nothing in it)
process.env.AGENT_TOOLS_LISTING_MAX = "16";
const unlisted = cli(pr(project({ ...listing() }), { "README.md": "a change of its own\n" }));
delete process.env.AGENT_TOOLS_LISTING_MAX;
fails(unlisted, "a head git cannot list fails", "cannot be listed", "Mend: ");
// (#600's fallback security review of 72e6450: names are compared as a file system that folds case does)
fails(run(pr(project({ ...listing() }), { ".claude/\u017fkills/notes/SKILL.md": "# notes\n" })), "a name that differs only by a letter a full case fold matches fails too", "in another case");
// (#476's security review of a74309b: what the kit's form fetches from main must be a file, not a link, whose target's
  // name main would give in the script's place)
if (LINKS) {
    const linkFetch = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.symlinkSync("./tree.sh", path.join(linkFetch, "scripts/format.sh"));
    fails(run(pr(linkFetch, { ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "a hook in the kit's form that fetches a link from main fails", 'fetches "scripts/format.sh" from main, which the project holds as no plain file');
    // (#647's fallback security review: its mend is its own, the command being in the kit's form already)
    const linkFetchSays = run(linkFetch);
    ok(linkFetchSays.out.includes('Mend: make "scripts/format.sh" a plain file committed in the project') && !/no plain file[^\n]*Mend: write its command in the starter kit's form/u.test(linkFetchSays.out), "and its mend is to make the fetched file a plain one, not to write the command in the kit's form it is in", linkFetchSays.out);
    // (#476's code review of ac42a35: the starter kit's own hooks too, where what they fetch is a link)
    const kitLink = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.mkdirSync(path.join(kitLink, "core/scripts"), { recursive: true });
    fs.symlinkSync("../../scripts/tree.sh", path.join(kitLink, "core/scripts/work-saved.sh"));
    fails(run(pr(kitLink, { "README.md": "a change of its own\n" }), "--core"), "a hook of the starter kit's own, unchanged, whose fetched file is a link, fails", 'fetches "core/scripts/work-saved.sh" from main, which the project holds as no plain file');
    // (#476's code review of a76614d: and where main holds it as a link that the pull request makes a file, since the hook
    // fetches from main until the pull request merges)
    const mainLink = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.symlinkSync("./tree.sh", path.join(mainLink, "scripts/format.sh"));
    git(mainLink, "add", "-A"); git(mainLink, "commit", "-q", "-m", "a link on main");
    git(mainLink, "checkout", "-q", "-B", "change"); fs.unlinkSync(path.join(mainLink, "scripts/format.sh"));
    fails(run(pr(mainLink, { "scripts/format.sh": "echo a file\n", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "and so does one whose fetched link the pull request makes a file, main holding the link until it merges", 'fetches "scripts/format.sh" from main, which the project holds as no plain file');
  }
const step = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
ok(notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) }), step)[0]?.mend.includes(NOT_KIT), "the sync note's step reads not done while a hook not in the kit's form stands unmarked");
ok(!notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), step).length, "and done once it is marked, listed in the baseline");
// (the kit's forms, whole: its own hooks are each in one, and a command a megabyte long is told from them at once)
ok(kitHooks().map(id => JSON.parse(id)).flatMap(id => { const h = id[id.length - 1]; return [h.command, h.action?.command].filter(Boolean); }).every(kitForm), "the starter kit's own hooks are each in the kit's form");
const began = Date.now();
for (const command of [`${KIT_HOOK}${" x".repeat(1 << 18)}`, kitCommand(" x".repeat(1 << 18)), "'".repeat(1 << 20)]) kitForm(command);
ok(Date.now() - began < 5000, "and a command a megabyte long is told from the kit's form at once", `${Date.now() - began} ms`);
}
// ---- what git stores where a tool reads its files ----
{
  // (a submodule's entry, put in the index as git stores one, in a commit of its own on top of `dir`'s branch)
  // (its folder left empty on disk, as a checkout that brings in no submodule leaves it, so `git add -A` keeps it)
  const gitlink = (dir, at, id = git(dir, "rev-parse", "HEAD")) => { fs.mkdirSync(path.join(dir, at), { recursive: true }); git(dir, "update-index", "--add", "--cacheinfo", `160000,${id},${at}`); git(dir, "commit", "-q", "-m", `a submodule at ${at}`); };
  const prLink = (dir, at, id) => { git(dir, "checkout", "-q", "-B", "change"); gitlink(dir, at, id); git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change"); return dir; };
  const SAYS = "is a submodule where an agent tool reads its files";
  for (const at of [".codex", ".claude/skills/notes", ".Kiro/hooks", ".kiro"])
    fails(run(prLink(project({ ...listing() }), at)), `a submodule at ${at} fails`, `${at} ${SAYS}`, "Mend: ");
  passes(run(prLink(project({ ...listing() }), "vendor/lib")), "a submodule elsewhere is none of the agent tools'");
  const held = project({ ...listing() });
  gitlink(held, ".codex");
  const heldRun = run(pr(held, { "README.md": "a change of its own\n" }));
  ok(heldRun.status === 0 && heldRun.out.includes(`.codex ${SAYS}`), "one the base held is noted, not failed", heldRun.out);
  fails(run(prLink(held, ".codex", git(held, "rev-parse", "HEAD~1"))), "but not once the pull request moves it", `.codex ${SAYS}`);
  ok(notDone(held, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(`.codex ${SAYS}`), "the sync note's step reads not done while one stands");
  const core = project({ ...listing() });
  gitlink(core, ".codex");
  fails(run(core, "--core"), "in the core's own repository none may stand", `.codex ${SAYS}`);
}

done("a tool's files in another letter case and what git stores");
