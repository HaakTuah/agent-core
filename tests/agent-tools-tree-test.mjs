// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): what git shows at the
// path a hook fetches and where Claude Code reads below the root. Each case a made-up project in a temporary git
// repository, never a real one, run as licences.yml runs the check, and every failure read for its mend (mend.mjs).
// Git and Node's own modules; the projects and their runs stand in scripts/agent-tools-scratch.mjs, which the tests
// beside this one share.
//
//   node tests/agent-tools-tree-test.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CORE } from "../scripts/core-address.mjs";
import { run, pr, project, script, listing, KIT, HOOKS, LINKS, git, front, withSetting, TREE_HOOK, withHook, entry, fromWorkingTree, fromMain, MAIN_HOOK, NOT_KIT, KIT_HOOK, withPlugins, PLUGIN, codexHook, change, env, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

{
// (a folder of Claude Code's below the project's root, which it reads where it works there)
const NESTED = "is a folder of Claude Code's below the project's root";
// (the core's own copy is none of the project's: its .claude is the core's, held to the core's commit by core.yml)
const manifest = at => ({ "core-manifest.md": `Core: ${CORE} at ${"a".repeat(40)}, copied whole under ${at} (never edited here).\n` });
passes(run(pr(project({ ...script, ...manifest("core/"), ...listing() }), { "core/.claude/settings.json": KIT, "core/README.md": "# core\n" })), "the core's own copy, where the manifest names it, with its .claude, is no folder of the project's below its root");
fails(run(pr(project({ ...script, ...listing() }), { "core/.claude/settings.json": KIT })), "but with no manifest, as in the core's own repository, a core/.claude fails as any other does", NESTED);
const elsewhere = run(pr(project({ ...script, ...manifest("vendor/core/"), ...listing() }), { "vendor/core/.claude/settings.json": KIT, "core/.claude/settings.json": KIT }));
ok(elsewhere.status === 1 && elsewhere.out.includes("core/.claude is a folder") && !elsewhere.out.includes("vendor/core/.claude is a folder"), "and where the manifest names another path, that one alone is left out", elsewhere.out);
fails(run(pr(project({ ...script, ...listing() }), { "app/.claude/skills/x/SKILL.md": "# x\n" })), "a folder of skills below the project's root fails", NESTED, "Mend: move what it holds into the root's .claude folder");
const nested = () => project({ ...script, "app/.Claude/agents/rev.md": "---\nname: rev\n---\n", ...listing() });
const nestedKept = run(pr(nested(), { "README.md": "x\n" }));
ok(nestedKept.status === 0 && nestedKept.out.includes(NESTED), "one the base held, in whatever case, is noted", nestedKept.out);
fails(run(pr(nested(), { "app/.Claude/agents/rev.md": `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n` })), "but not once what it holds changes", NESTED);
fails(run(pr(project({ ...script, ...listing() }), { "app/.claude/settings.json": KIT })), "and so do a nested folder's settings", NESTED);
const nfd = () => project({ ...script, ["e\u0301/.claude/agents/rev.md"]: "---\nname: rev\n---\n", ...listing() });
fails(run(pr(nfd(), { ["e\u0301/.claude/agents/rev.md"]: "---\nname: rev\npermissionMode: bypassPermissions\n---\n" })), "and one below a name in another normal form, changed", NESTED);
if (LINKS) {
    const nestedLink = project({ ...script, "shared/skills/x/SKILL.md": "# x\n", ...listing() });
    fs.mkdirSync(path.join(nestedLink, "app"), { recursive: true }); fs.symlinkSync("../shared", path.join(nestedLink, "app/.claude"));
    git(nestedLink, "add", "-A"); git(nestedLink, "commit", "-q", "-m", "a nested .claude as a link");
    fails(run(nestedLink, "--core"), "and a nested .claude that is a link", NESTED);
  }
for (const at of [".claude/Agents/rev.md", ".claude/agents/rev.MD", ".claude/Commands/rev.md"]) fails(run(pr(project({ ...script, ...listing() }), { [at]: "---\nname: rev\n---\n" })), `a subagent's file in another letter case, ${at}, fails`, "in another case");
passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": "---\nname: rev\ndescription: reviews hooks\n---\n# rev\n" })), "a subagent with no hooks in its frontmatter passes");
const frontStood = project({ ...script, ".claude/agents/rev.md": front("hooks") });
const frontKept = run(pr(frontStood, { ".claude/agents/rev.md": `${front("hooks")}more of its prompt\n` }));
ok(frontKept.status === 0 && frontKept.out.includes("as the base held it"), "one the base held is noted while its frontmatter stands", frontKept.out);
const helperStood = project({ ...script, ...withSetting("apiKeyHelper", TREE_HOOK) });
const helperKept = run(pr(helperStood, { "README.md": "a change of its own\n" }));
ok(helperKept.status === 0 && helperKept.out.includes(`the hook "apiKeyHelper: ${TREE_HOOK}"`), "one the base held is noted, not failed", helperKept.out);
fails(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) })), "a new one marked as the baseline's fails all the same: the baseline lists only what stood", "the base held no such hook");
const stood = project({ ...script, ".claude/settings.json": withHook(TREE_HOOK) });
const kept = run(pr(stood, { "README.md": "a change of its own\n" }));
ok(kept.status === 0 && /note as the base held it, nothing fails here: the hook "PostToolUse: bash scripts\/format.sh"/.test(kept.out), "one the base held, with no list, is noted, not failed", kept.out);
const firstList = run(pr(stood, listing(entry(TREE_HOOK))));
ok(firstList.status === 0 && /note as the base held it[\s\S]*"from": "the working tree"/.test(firstList.out), "a pull request that writes the list notes it, saying how to list it in the baseline", firstList.out);
const marked = pr(stood, listing(entry(TREE_HOOK, fromWorkingTree)));
const listedIn = run(marked);
ok(listedIn.status === 0 && /note .*lists it in the baseline/.test(listedIn.out), "and passes with it marked, listed in the baseline", listedIn.out);
fails(run(pr(marked, listing(entry(TREE_HOOK)))), "a pull request that takes the mark out while the hook stands fails: the baseline only shrinks", NOT_KIT);
fails(run(pr(project({ ...script, ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) })), "a hook the base held in the kit's form that the pull request writes otherwise fails", NOT_KIT);
fails(run(project({ ...script, ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK, fromWorkingTree)) })), "a mark on a hook in the kit's form fails", 'but its command is the starter kit\'s form, which runs its copy on main. Mend: take "from" out');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, ...fromWorkingTree }) })), "a mark on what is no hook fails", 'only a hook\'s entry may say "from"');
fails(run(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), "--core"), "in the core's own repository none may stand, marked or not", "none may stand");
// (a hook that fetches its file from main in a form of its own is listed by "from": "main", read from its command; one
// that fetches nothing from main is listed by "the working tree" alone; #1273, point 2)
const mainStood = project({ ...script, ".claude/settings.json": withHook(MAIN_HOOK) });
const mainFirst = run(pr(mainStood, listing(entry(MAIN_HOOK))));
ok(mainFirst.status === 0 && /note as the base held it[\s\S]*give its entry in checks\/licences\.json "from": "main"/.test(mainFirst.out), "a hook the base held that fetches its file from main is noted, saying to list it with \"from\": \"main\"", mainFirst.out);
const mainMarked = run(pr(mainStood, listing(entry(MAIN_HOOK, fromMain))));
ok(mainMarked.status === 0 && /note .*lists it in the baseline \("from": "main"\)/.test(mainMarked.out), "and passes once marked so, listed in the baseline", mainMarked.out);
fails(run(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromMain)) })), "\"from\": \"main\" on a hook whose command fetches nothing from main fails", 'fetches no file from main', '"from": "the working tree"');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, ...fromMain }) })), "and on what is no hook", 'only a hook\'s entry may say "from"');
const kiroTree = { version: "v1", hooks: [{ name: "fmt", trigger: "Stop", action: { type: "command", command: "node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"" } }] };
fails(run(pr(project({ ...listing() }), { "scripts/fmt.mjs": "", ".kiro/hooks/fmt.json": kiroTree, ".codex/config.toml": "notify = [\"python3\", \"scripts/notify.py\"]\n", "scripts/notify.py": "", ...listing({ kind: "hook", name: "Kiro Stop: node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"", publisher: "this project" }, { kind: "hook", name: "Codex notify: python3 scripts/notify.py", publisher: "this project" }) })),
    "Kiro's and Codex's hooks are held to it too", `the hook "Kiro Stop: node`, `the hook "Codex notify: python3 scripts/notify.py", configured in .codex/config.toml, ${NOT_KIT}`);
// (#476's code review of 2a76778: notify's words are read as the one command they make, so the kit's form passes)
const kitNotify = ["bash", "-c", "f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/notify.sh 2>/dev/null) || exit 0; bash -c \"$f\""];
const notifyRun = words => run(pr(project({ ...listing() }), { "scripts/notify.sh": "", ".codex/config.toml": `notify = ${JSON.stringify(words)}\n`, ...listing({ kind: "hook", name: `Codex notify: ${words.join(" ")}`, publisher: "this project" }) }));
passes(notifyRun(kitNotify), "Codex's notify given as the kit's form, bash, -c and its script, passes");
fails(notifyRun(["git", "show", "refs/remotes/origin/main:scripts/notify.sh"]), "while a fetch of its own form fails", NOT_KIT);
const evil = "powershell -File scripts/evil.ps1";
const windowsRun = (files, name) => run(pr(project({ ...listing() }), { "scripts/evil.ps1": "", ...files, ...listing({ kind: "hook", name, publisher: "this project" }) }));
fails(windowsRun({ ".codex/hooks.json": codexHook({ type: "command", command: KIT_HOOK, commandWindows: evil }) }, `Codex Stop: ${KIT_HOOK} (Windows: ${evil})`), "a Codex hook in the kit's form whose commandWindows is not fails", NOT_KIT, "(Windows: powershell");
fails(windowsRun({ ".codex/config.toml": `[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(KIT_HOOK)}\ncommand_windows = ${JSON.stringify(evil)}\n` }, `Codex Stop: ${KIT_HOOK} (Windows: ${evil})`), "and so does one in config.toml whose command_windows is not", NOT_KIT);
const only = { type: "command", command_windows: evil };
fails(windowsRun({ ".codex/hooks.json": codexHook(only) }, `Codex Stop: ${JSON.stringify(only)}`), "and one with a Windows command alone", NOT_KIT);
// (#476's fallback security review of 490c9d9: a folder or a submodule's entry at the fetched path is no script either,
  // since git prints what it holds, a name a line, for bash to run)
const NOT_FILE = 'fetches "scripts/format.sh" from main, which the project holds as no plain file';
fails(run(pr(project({ ...listing() }), { "scripts/format.sh/bash evil.sh": "", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "a hook in the kit's form that fetches a folder fails", NOT_FILE);
const mainDir = project({ "scripts/format.sh/x": "", ...listing() });
fs.rmSync(path.join(mainDir, "scripts/format.sh"), { recursive: true });
fails(run(pr(mainDir, { "scripts/format.sh": "echo a file\n", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "and one whose fetched path main holds as a folder", NOT_FILE);
const sub = project({ ...listing() });
git(sub, "checkout", "-q", "-B", "change");
change(sub, { ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) });
git(sub, "add", "-A");
git(sub, "update-index", "--add", "--cacheinfo", `160000,${git(sub, "rev-parse", "HEAD")},scripts/format.sh`);
git(sub, "commit", "-q", "-m", "a submodule's entry");
git(sub, "checkout", "-q", "main");
git(sub, "merge", "-q", "--no-ff", "-m", "merge", "change");
fails(run(sub), "and one whose fetched path is a submodule's entry", NOT_FILE);
// (#476's fallback security review of bf7b3b2: what git shows at the path is asked of git, whatever the listing says,
  // as of an empty folder, which the listing leaves out)
const emptyMain = () => {
  const base = project({ ...listing() }), inEmpty = { cwd: base, env, encoding: "utf8" };
  const emptyTree = execFileSync("git", ["mktree"], { ...inEmpty, input: "" }).trim();
  const withEmpty = execFileSync("git", ["mktree"], { ...inEmpty, input: `${git(base, "ls-tree", "HEAD")}\n040000 tree ${emptyTree}\tformat.sh\n` }).trim();
  git(base, "update-ref", "refs/heads/main", git(base, "commit-tree", withEmpty, "-p", "HEAD", "-m", "an empty folder at the path"));
  git(base, "reset", "-q", "--hard");
  return base;
};
const rootKit = KIT_HOOK.replace("main:scripts/format.sh", "main:format.sh");
fails(run(pr(emptyMain(), { ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) })), "and one whose fetched path main holds as an empty folder", 'fetches "format.sh" from main, which the project holds as no plain file');
// (#1277's fallback review of 253908e: such a hook marked "from": "main", whose command does fetch from main, is told
// what is wrong with its file, never that it fetches nothing from main)
const notFileMarked = run(pr(emptyMain(), { ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit, fromMain)) }));
ok(!/fetches no file from main/.test(notFileMarked.out), "and, marked \"from\": \"main\", is not told its command fetches nothing from main", notFileMarked.out);
// (#476's fallback security review of de6baf6: and where the merge itself holds an empty folder there, main a file)
const emptyHead = project({ "format.sh": "echo a file\n", ...listing() }), inHead = { cwd: emptyHead, env, encoding: "utf8" };
pr(emptyHead, { ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) });
const headEmpty = execFileSync("git", ["mktree"], { ...inHead, input: "" }).trim();
const lines = git(emptyHead, "ls-tree", "HEAD").split("\n").filter(l => !l.endsWith("\tformat.sh"));
const headTree = execFileSync("git", ["mktree"], { ...inHead, input: `${lines.join("\n")}\n040000 tree ${headEmpty}\tformat.sh\n` }).trim();
git(emptyHead, "update-ref", "refs/heads/main", git(emptyHead, "commit-tree", headTree, "-p", "HEAD^1", "-p", "HEAD^2", "-m", "merge"));
git(emptyHead, "reset", "-q", "--hard");
fails(run(emptyHead), "and one whose merge holds an empty folder at the fetched path, main a file", 'fetches "format.sh" from main, which the project holds as no plain file');
// (#476's fallback security review of 32e028f: where a tree git would refuse names one entry to a path lookup and
  // another to git show, as one out of order with a broken entry that empties the whole listing, the object git show
  // resolves is what is asked)
const oddBase = project({ ...listing() }), inOdd = { cwd: oddBase, env };
const oid = text => execFileSync("git", ["hash-object", "-w", "--stdin"], { ...inOdd, encoding: "utf8", input: text }).trim();
const entries = git(oddBase, "ls-tree", "HEAD").split("\n").map(l => { const [meta, name] = l.split("\t"); const [mode, , id] = meta.split(" "); return [mode === "040000" ? "40000" : mode, name, id]; });
const raw = [["40000", "aaa", oid("y\n")], ...entries, ["100644", "zzzzzzzzzzzzzzzz", oid("x\n")], ["120000", "format.sh", oid("tree.sh")]].map(([m, n, o]) => Buffer.concat([Buffer.from(`${m} ${n}\0`), Buffer.from(o, "hex")]));
const oddTree = execFileSync("git", ["hash-object", "-t", "tree", "--literally", "-w", "--stdin"], { ...inOdd, encoding: "utf8", input: Buffer.concat(raw) }).trim();
const oddMain = git(oddBase, "commit-tree", oddTree, "-p", "HEAD", "-m", "a tree out of order");
// (the pull request's own tree written from the clean checkout, its commits made by hand over that main)
change(oddBase, { "format.sh": "echo a file\n", ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) });
git(oddBase, "add", "-A");
const prTree = git(oddBase, "write-tree"), prCommit = git(oddBase, "commit-tree", prTree, "-p", oddMain, "-m", "change");
git(oddBase, "update-ref", "refs/heads/main", git(oddBase, "commit-tree", prTree, "-p", oddMain, "-p", prCommit, "-m", "merge"));
fails(run(oddBase), "and one whose fetched path main holds as a link in a tree out of order", 'fetches "format.sh" from main, which the project holds as no plain file');
// (a link whose target is longer than any file system follows leads nowhere, read at the base as in the tree)
const longBase = project({ ...listing() }), inLong = { cwd: longBase, env, encoding: "utf8" };
const longLink = execFileSync("git", ["hash-object", "-w", "--stdin"], { ...inLong, input: "a/".repeat(300000) }).trim();
const kiro = execFileSync("git", ["mktree"], { ...inLong, input: `120000 blob ${longLink}\thooks\n` }).trim();
const longTree = execFileSync("git", ["mktree"], { ...inLong, input: `${git(longBase, "ls-tree", "HEAD")}\n040000 tree ${kiro}\t.kiro\n` }).trim();
const longMain = git(longBase, "commit-tree", longTree, "-p", "HEAD", "-m", "a link too long to follow");
// (the pull request's own tree, which holds no such link, its commits made by hand over that main and checked out)
change(longBase, { "README.md": "a change of its own\n" });
git(longBase, "add", "-A");
const longPrTree = git(longBase, "write-tree"), longPr = git(longBase, "commit-tree", longPrTree, "-p", longMain, "-m", "change");
git(longBase, "update-ref", "refs/heads/main", git(longBase, "commit-tree", longPrTree, "-p", longMain, "-p", longPr, "-m", "merge"));
git(longBase, "reset", "-q", "--hard");
passes(run(longBase), "a link at the base too long to follow leads nowhere, and the check goes on");
}

done("what git shows at the path a hook fetches");
