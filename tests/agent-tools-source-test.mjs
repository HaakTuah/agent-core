// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): where each hook's
// command comes from (#407; floor rule 3). Each case a made-up project in a temporary git repository, never a real
// one, run as licences.yml runs the check, and every failure read for its mend (mend.mjs). Git and Node's own
// modules; the projects and their runs stand in scripts/agent-tools-scratch.mjs, which the tests beside this one
// share.
//
//   node tests/agent-tools-source-test.mjs
import { fetchesMain } from "../scripts/hook-source.mjs";
import { run, pr, project, script, listing, withHook, entry, TREE_HOOK, NOT_KIT, MAIN_HOOK, kitCommand, KIT_HOOK, withSetting, KIT, front, HOOKS, asserting, fromWorkingTree } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

{
const added = command => run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(command), ...listing(entry(command)) }));
fails(added(TREE_HOOK), "a new hook not in the kit's form fails, as one that runs the working tree's copy", NOT_KIT, "--no-replace-objects show refs/remotes/origin/main:");
fails(added(MAIN_HOOK), "and so does one that fetches from main in a form of its own: no command but the kit's is read", NOT_KIT);
fails(added("npx -y tool@1.0.0"), "and one that names no file of the project", NOT_KIT);
fails(added(kitCommand("'; bash scripts/format.sh; '")), "and one broken out of the kit's quote", NOT_KIT);
// (#476's code review of e76b2bb: the path fetched is written one way alone, so the file the check reads is the one fetched)
for (const spelt of ["./scripts/format.sh", "scripts/./format.sh", "x/../scripts/format.sh"])
    fails(added(KIT_HOOK.replace("main:scripts/format.sh", `main:${spelt}`)), `and one that fetches ${spelt}, another spelling of a file`, NOT_KIT);
passes(added(KIT_HOOK), "a new hook in the kit's form passes");
passes(added(kitCommand(" check now")), "and so does one with plain words after its script, which main's copy reads");
const named = (key, command) => ({ kind: "hook", name: `${key}: ${command}`, publisher: "this project" });
for (const [key, value] of [["apiKeyHelper", TREE_HOOK], ["awsAuthRefresh", TREE_HOOK], ["awsCredentialExport", TREE_HOOK], ["gcpAuthRefresh", TREE_HOOK], ["otelHeadersHelper", TREE_HOOK], ["statusLine", { type: "command", command: TREE_HOOK }], ["fileSuggestion", { type: "command", command: TREE_HOOK }]])
    fails(run(pr(project({ ...script, ...listing() }), { ...withSetting(key, value), ...listing(named(key, TREE_HOOK)) })), `Claude Code's "${key}" not in the kit's form fails as a hook does`, NOT_KIT);
passes(run(pr(project({ ...script, ...listing() }), { ...withSetting("statusLine", { type: "command", command: KIT_HOOK }), ...listing(named("statusLine", KIT_HOOK)) })), "one in the kit's form passes, listed");
// (and Codex's model providers' commands that print a token)
for (const key of ["auth", "gateway_oauth.credential_export"])
    fails(run(pr(project({ ...script, ...listing() }), { ".codex/config.toml": `[model_providers.p.${key}]\ncommand = "bash"\nargs = ["scripts/format.sh"]\n`, ...listing({ kind: "hook", name: `Codex model_providers.p.${key}: bash scripts/format.sh`, publisher: "this project" }) })), `Codex's "model_providers.p.${key}" fails as a setting of no kit's form does`, "is of a kind no starter kit writes");
fails(run(pr(project({ ...script, ...listing() }), withSetting("statusLine", { type: "command", command: KIT_HOOK }))), "and fails unlisted", 'the hook "statusLine: ');
fails(run(pr(project({ ...script, ...listing() }), withSetting("apiKeyHelper", ["bash", "x"]))), "a setting of another shape is refused", '"apiKeyHelper" is neither a command nor');
// (#633's fallback security review of b0f654f: a hook the base held under an event of a setting's name, which never ran,
  // moved into that setting, is new)
const asEvent = { ...JSON.parse(KIT), hooks: { ...JSON.parse(KIT).hooks, statusLine: [{ hooks: [{ type: "command", command: TREE_HOOK }] }] } };
fails(run(pr(project({ ...script, ".claude/settings.json": asEvent }), withSetting("statusLine", { type: "command", command: TREE_HOOK }))), "a hook the base held under a setting's name, moved into the setting, is new", NOT_KIT);
const SKILL = { kind: "skill", name: "rev", publisher: "this project" };
for (const [what, files] of [
    ["a subagent's frontmatter", { ".claude/agents/rev.md": front("hooks") }],
    ["a skill's frontmatter, its key in another case", { ".claude/skills/rev/SKILL.md": front("Hooks"), ...listing(SKILL) }],
    ["a frontmatter whose key is quoted with an escape", { ".claude/agents/rev.md": front('"ho\\u006fks"') }],
    ["a marketplace's headersHelper", withSetting("extraKnownMarketplaces", { m: { source: { source: "github", repo: "example/m" }, headersHelper: TREE_HOOK } })],
    ["a marketplace's command source", withSetting("extraKnownMarketplaces", { m: { source: { source: "settings", plugins: [{ name: "p", source: { source: "command", command: TREE_HOOK } }] } } })],
    ["a Codex model provider whose token command, in the kit's form, runs in another folder", { ".codex/config.toml": `[model_providers.p.auth]\ncommand = "bash"\nargs = ["-c", ${JSON.stringify(KIT_HOOK.slice("bash -c '".length, -1))}]\ncwd = "sub"\n`, ...listing(SKILL, { kind: "hook", name: `Codex model_providers.p.auth: bash -c ${KIT_HOOK.slice("bash -c '".length, -1)}`, publisher: "this project" }) }],
    ["a Codex model provider with no command, by where it sends a key", { ".codex/config.toml": "[model_providers.p]\nbase_url = \"https://example.invalid/v1\"\nenv_key = \"KEY\"\n" }],
  ]) fails(run(pr(project({ ...script, ...listing(SKILL) }), files)), `${what} fails as a hook of no kit's form does`, "is of a kind no starter kit writes, so nothing shows that it runs its copy on main", "Mend: take it out of the project's files");
// (Codex's code review of ccb1705: and one marked as the baseline's, new, fails with that same mend, never the kit's form)
const providerMarked = run(pr(project({ ...script, ...listing(SKILL) }), { ".codex/config.toml": "[model_providers.p]\nbase_url = \"https://example.invalid/v1\"\nenv_key = \"KEY\"\n", ...listing(SKILL, { kind: "hook", name: "Codex model_providers.p: its settings", publisher: "this project", from: "the working tree" }) }));
fails(providerMarked, "a setting of no kit's form, new and marked as the baseline's, fails with the mend that can be taken", "the base held no such hook", "Mend: take it out of the project's files");
ok(!providerMarked.out.includes("Mend: write its command in the starter kit's form"), "and its mend is not to rewrite a command it may not have", providerMarked.out);
fails(run(pr(project({ ...script, ...listing() }), { ".mcp.json": { mcpServers: { api: { type: "http", url: "https://example.invalid/mcp", headersHelper: TREE_HOOK } } } })), "a remote server's headersHelper not in the kit's form fails as a hook does", NOT_KIT);
for (const [what, file, text] of [
    ["one closed mid-line", ".claude/agents/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS} # ---\n# rev\n`],
    ["one opened by another space", ".claude/agents/rev.md", `---\u000b\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one written as JSON", ".claude/agents/rev.md", '---\n{"name":"rev","hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash x.sh"}]}]}}\n---\n'],
    ["one keyed by an alias", ".claude/agents/rev.md", `---\ndescription: &k hooks\n*k :\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one indented whole", ".claude/agents/rev.md", `---\n  name: rev\n  hooks: {}\n---\n`],
    ["one in a subfolder", ".claude/agents/sub/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["a command's", ".claude/commands/rev.md", `---\ndescription: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one with tool servers", ".claude/agents/rev.md", "---\nname: rev\nmcp_servers:\n  x:\n    type: stdio\n    command: bash\n---\n"],
    // (#647's fallback security review of 304f1e9: a lone carriage return, which YAML reads as a line's end, and a
    // subagent at any depth)
    ["one with a key after a lone carriage return", ".claude/agents/rev.md", `---\nname: rev\ndescription: d\n\rhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one nine folders deep", ".claude/agents/1/2/3/4/5/6/7/8/9/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one too long to read", ".claude/agents/rev.md", `---\nname: rev\ndescription: ${"x".repeat(70000)}\n---\n`],
  ]) fails(run(pr(project({ ...script, ...listing() }), { [file]: text })), `a frontmatter, ${what}, fails as a setting of no kit's form does`, "is of a kind no starter kit writes", "Mend: take it out of the project's files");
passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/sub/rev.md": "---\nname: rev\ndescription: \"reviews: hooks and all\"\ntools: [Read, Grep]\nmodel: opus\n---\n# rev\n" })), "a plain frontmatter of simple keys passes, at any depth");
// (a skill's or command's body that runs a command where it is invoked, and a subagent's permission mode but the
  // default, each held as a setting no starter kit writes)
const NOKIT = "is of a kind no starter kit writes";
const SK = { kind: "skill", name: "s", publisher: "this project" };
fails(run(pr(project({ ...script, ...listing(SK), ".claude/skills/s/SKILL.md": "# s\n" }), { ".claude/skills/s/SKILL.md": "# s\nThe branch: !`git branch --show-current`\n" })), "a skill's body that runs a command inline fails", NOKIT, "shell: the commands its text runs");
fails(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": "# c\n```!\nbash x.sh\n```\n" })), "and so does a command's block that runs one", NOKIT);
passes(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": "# c\nSay `hello`, and nothing more!\n" })), "a command whose text runs nothing passes");
const shellStood = project({ ...script, ".claude/commands/c.md": "# c\n!`date`\n", ...listing() });
const shellKept = run(pr(shellStood, { "README.md": "x\n" }));
ok(shellKept.status === 0 && shellKept.out.includes("as the base held it"), "one the base held is noted while its text stands", shellKept.out);
for (const mode of ["bypassPermissions", "'acceptEdits' # quoted"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": `---\nname: rev\npermissionMode: ${mode}\n---\n` })), `a subagent's permission mode ${mode} fails`, NOKIT, "permissionMode");
passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": "---\nname: rev\npermissionMode: default\n---\n" })), "and its default passes");
fails(run(pr(project({ ...script, ...listing() }), withSetting("permissions", { defaultMode: "bypassPermissions" }))), "settings whose permission mode runs all without asking fail", NOKIT, "permissions.defaultMode");
passes(run(pr(project({ ...script, ...listing() }), withSetting("permissions", { defaultMode: "acceptEdits" }))), "and settings of another mode pass");
// (#693's fallback security review of fdd2d96: every key that folds to the permission mode, whichever a reader keeps;
  // a block that runs a command wherever it stands; and the tools a skill lets run without asking)
for (const front of ["PermissionMode: default\npermissionMode: bypassPermissions", "permissionMode: default\npermissionMode: bypassPermissions"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": `---\nname: rev\n${front}\n---\n` })), `a permission mode written twice, ${front.split("\n")[0]} first, fails`, NOKIT, "permissionMode");
for (const body of ["# c\n> ```!\nbash x.sh\n```\n", "# c\n````!\nbash x.sh\n````\n", "# c\nRun this: ```!\nbash x.sh\n```\n"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": body })), `a command's block that runs a command, ${JSON.stringify(body.split("\n")[1])}, fails`, NOKIT);
fails(run(pr(project({ ...script, ...listing(SK), ".claude/skills/s/SKILL.md": "# s\n" }), { ".claude/skills/s/SKILL.md": "---\nname: s\nallowed-tools: Bash(*)\n---\n# s\n" })), "a skill's tools it lets run without asking fail as a setting", NOKIT);
// (every hook a tool configures is weighed, whatever its type: a web hook's address or a prompt is no command the kit's
  // form can be read in, so each is of a kind no starter kit writes; listed and new, it is refused, and one the base held
  // is noted while it stands, or listed in the baseline)
const other = [
  ["a web hook of .claude/settings.json", ".claude/settings.json", hook => ({ hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [hook] }] } }), { type: "http", url: "https://hooks.example.invalid/x" }, h => `PostToolUse: ${JSON.stringify(h)}`],
  ["a prompt hook of .claude/settings.json", ".claude/settings.json", hook => ({ hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [hook] }] } }), { type: "prompt", prompt: "Is the work done?" }, h => `PostToolUse: ${JSON.stringify(h)}`],
  ["an agent hook of .codex/hooks.json", ".codex/hooks.json", hook => ({ hooks: { Stop: [{ hooks: [hook] }] } }), { type: "agent", prompt: "Check the tests" }, h => `Codex Stop: ${JSON.stringify(h)}`],
  ["a Kiro hook with no command", ".kiro/hooks/ask.json", hook => ({ version: "v1", hooks: [hook] }), { name: "ask", trigger: "Stop", action: { type: "askAgent", prompt: "Review it" } }, h => `Kiro Stop: ${JSON.stringify(h)}`],
];
for (const [what, file, write, hook, name] of other) {
  const listed = (extra = {}) => listing({ kind: "hook", name: name(hook), publisher: "this project", ...extra });
  fails(run(pr(project({ ...script, ...listing() }), { [file]: write(hook), ...listed() })), `${what}, listed and new, is weighed and refused`, NOKIT, "Mend: take it out of the project's files");
  fails(run(pr(project({ ...script, ...listing() }), { [file]: write(hook), ...listed(fromWorkingTree) })), `and marked as the baseline's while the base held none, it is refused`, NOKIT, "the base held no such hook");
  const stood = run(pr(project({ ...script, [file]: write(hook), ...listed() }), { "README.md": "x\n" }));
  ok(stood.status === 0 && stood.out.includes("as the base held it") && stood.out.includes(NOKIT), `${what} the base held is noted while it stands`, stood.out);
  const kept = run(pr(project({ ...script, [file]: write(hook), ...listed(fromWorkingTree) }), { "README.md": "x\n" }));
  ok(kept.status === 0 && kept.out.includes("its entry lists it in the baseline"), `and listed in the baseline, it is noted there`, kept.out);
}
}

// (whether a command fetches a file from main, in any form, read from its words: what its entry's mark follows; #1273)
ok([MAIN_HOOK, KIT_HOOK, `bash -c 'git -C "$CLAUDE_PROJECT_DIR" show "refs/remotes/origin/main:scripts/a.sh" | bash'`, "f=$(git --no-pager show refs/remotes/origin/main:a.sh) && bash -c \"$f\"",
  "git show refs/remotes/origin/main:.claude/hooks/format.sh | bash"].every(fetchesMain)
  && ![TREE_HOOK, "git show HEAD:scripts/a.sh | bash", "git show refs/remotes/origin/main | bash", "echo show refs/remotes/origin/main:a.sh; bash a.sh", "git log; show refs/remotes/origin/main:a.sh",
    // (the fallback reviewer's: git's words in an echo or a comment, a path git reads from the folder it runs in, and
    // the file fetched only to be thrown away while the working tree's copy runs)
    "echo git show refs/remotes/origin/main:a.sh; bash a.sh", "bash a.sh # git show refs/remotes/origin/main:a.sh",
    "echo do git show refs/remotes/origin/main:a.sh; bash a.sh", "echo then git show refs/remotes/origin/main:a.sh; bash a.sh",
    "git show refs/remotes/origin/main:./a.sh | bash", "git show refs/remotes/origin/main:../a.sh | bash",
    "bash -c 'git show refs/remotes/origin/main:scripts/format.sh >/dev/null; bash scripts/format.sh'",
    'git show "refs/remotes/origin/main:a.sh" >/dev/null; bash a.sh', "git show refs/remotes/origin/main:a.sh &>/dev/null; bash a.sh",
    "git show refs/remotes/origin/main:a.sh 1>/dev/null; bash a.sh",
    // (past the length a hook's command takes, read as fetching nothing, the safe mark, and at once; and variables
    // set in a run with no git after them, which this suite would never finish where they split more than one way)
    `git show refs/remotes/origin/main:a.sh | bash # ${"x".repeat(5000)}`, `${"a=b".repeat(40)}!`,
    `bash -c 'X=${"a=b".repeat(40)}'`].some(fetchesMain),
  "a command that has git show a file of the remote's main is read as fetching from main, whatever its form, a path under a dot folder too; one that shows another ref, no file, no git's, git's words after an echo's then or do, a path from the folder it runs in, output sent to a file right after the path, a command past the length a hook's takes, or variables set with no git after them, is not");
// (the forms a hook written by hand takes: git on a line of its own, in a group, after then or exec, or after variables)
ok(["cd x\ngit show refs/remotes/origin/main:a.sh | bash", "{ git show refs/remotes/origin/main:a.sh; } | bash",
  "if true; then git show refs/remotes/origin/main:a.sh | bash; fi", "exec git show refs/remotes/origin/main:a.sh | bash",
  "GIT_PAGER=cat git show refs/remotes/origin/main:a.sh | bash"].every(fetchesMain),
  "git where a command starts, on a later line, in a group, after then or exec or variables set before it, is read as fetching from main");
done("where each hook's command comes from");
