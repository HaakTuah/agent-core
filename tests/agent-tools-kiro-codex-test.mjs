// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): what Kiro and Codex
// configure (#407), the environment a tool's settings set and the TOML reader. Each case a made-up project in a
// temporary git repository, never a real one, run as licences.yml runs the check, and every failure read for its mend
// (mend.mjs). Git and Node's own modules; the projects and their runs stand in scripts/agent-tools-scratch.mjs, which
// the tests beside this one share.
//
//   node tests/agent-tools-kiro-codex-test.mjs
import { notDone, STEPS } from "../scripts/steps.mjs";
import { parseToml } from "../scripts/toml.mjs";
import { KIRO, CODEX, run, project, listing, pr, KIT, C1, C2, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

// ---- what Kiro and Codex configure (#407) ----
{
  const kits = { ".kiro/hooks/work-saved.json": KIRO, ".codex/hooks.json": CODEX };
  passes(run(project({ ...kits, ...listing() })), "the starter kit's Kiro and Codex hooks need no entry");
  const kiroHook = (command, extra = {}) => ({ version: "v1", hooks: [{ name: "lint", trigger: "PostFileSave", matcher: "\\.ts$", action: { type: "command", command }, ...extra }] });
  const LINT = { kind: "hook", name: "Kiro PostFileSave \\.ts$: npx eslint@9.0.0 --fix", publisher: "this project" };
  fails(run(project({ ...kits, ".kiro/hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing() })), "a Kiro hook of the project's own, not listed, fails", 'the hook "Kiro PostFileSave \\\\.ts$: npx eslint@9.0.0 --fix", configured in .kiro/hooks/lint.json, is not listed');
  passes(run(project({ ...kits, ".kiro/hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing(LINT) })), "and passes once listed");
  passes(run(project({ ".kiro/hooks/notes.md": "# not a hook file\n", ...listing() })), "a file under .kiro/hooks that is no JSON is no hook Kiro reads");
  const kiroServer = { ".kiro/settings/mcp.json": { mcpServers: { docs: { command: "npx", args: ["-y", "docs-server"] } } } };
  fails(run(pr(project({ ...listing() }), { ...kiroServer, ...listing({ kind: "server", name: "Kiro docs", publisher: "Example Tools", version: "2.0.0" }) })), "a Kiro tool server is held to the pin its configuration gives", 'the tool server "Kiro docs" is fetched at no fixed version: .kiro/settings/mcp.json, in the arguments of "docs", names no version');
  fails(run(project({ ...kiroServer, ".mcp.json": { mcpServers: { "Kiro docs": { command: "x" } } }, ...listing() })), "one server name in two files is refused", 'the tool server "Kiro docs" is configured in .mcp.json too');
  const toml = `notify = ["notify-send", "done"]\n\n[mcp_servers.search]\ncommand = "npx"\nargs = ["-y", "search-server@1.2.3"]\n\n[[hooks.PreToolUse]]\nmatcher = "^Bash$"\n\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = 'echo checked'\ntimeout = 30\n`;
  const codexListed = listing({ kind: "server", name: "Codex search", publisher: "Example Tools", version: "1.2.3" }, { kind: "hook", name: "Codex notify: notify-send done", publisher: "this project" }, { kind: "hook", name: "Codex PreToolUse ^Bash$: echo checked", publisher: "this project" });
  passes(run(project({ ...kits, ".codex/config.toml": toml, ...codexListed })), "Codex's config.toml is read: its tool servers, its notify and its hooks, each listed");
  fails(run(project({ ".codex/config.toml": toml, ...listing() })), "each of them unlisted fails", 'the tool server "Codex search"', 'the hook "Codex notify: notify-send done"', 'the hook "Codex PreToolUse ^Bash$: echo checked"');
  // (the shapes main's readers refuse in Claude Code's files are refused in Kiro's and Codex's too, each with its mend)
  fails(run(project({ ".kiro/settings/mcp.json": { mcpServers: ["docs"] }, ...listing() })), "Kiro's tool servers given as a list are refused", '.kiro/settings/mcp.json: "mcpServers" is not a JSON object');
  fails(run(project({ ".codex/config.toml": "mcp_servers = \"docs\"\n", ...listing() })), "Codex's tool servers given as a text are refused", '.codex/config.toml: "mcp_servers" is not a TOML table');
  fails(run(project({ ".codex/config.toml": "hooks = 1\n", ...listing() })), "and so are Codex's hooks given as a number in config.toml", '.codex/config.toml: "hooks" is not a TOML table');
  fails(run(project({ ".codex/hooks.json": { hooks: ["Stop"] }, ...listing() })), "and Codex's hooks given as a list in hooks.json", '.codex/hooks.json: "hooks" is not a JSON object');
  fails(run(project({ ".kiro/hooks/x.json": { version: "v1", hooks: { name: "x" } }, ...listing() })), "and a Kiro hook file whose hooks are no list", '.kiro/hooks/x.json: "hooks" is not a JSON list');
  fails(run(project({ ".kiro/hooks/ask.json": { version: "v1", hooks: [{ name: "ask", trigger: "Stop", matcher: 5, action: { type: "agent", prompt: "review it" } }] }, ...listing() })),
    "a Kiro hook that asks the agent is named by the whole hook, and a matcher that is no text is no matcher", 'the hook "Kiro Stop: {\\"name\\":\\"ask\\",\\"trigger\\":\\"Stop\\",\\"matcher\\":5,\\"action\\":{\\"type\\":\\"agent\\"');
  fails(run(project({ ".kiro/hooks/odd.json": { version: "v1", hooks: [{ name: "odd", trigger: "Stop", action: { type: "command", command: ["echo"] } }] }, ...listing() })),
    "a command hook whose command is no text is named by the whole hook too", 'the hook "Kiro Stop: {\\"name\\":\\"odd\\",\\"trigger\\":\\"Stop\\",\\"action\\":{\\"type\\":\\"command\\",\\"command\\":[\\"echo\\"]}');
  fails(run(project({ ".codex/hooks.json": { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo done" }] }] } }, ...listing() })), "a hook of .codex/hooks.json beside the kit's, not listed, fails", 'the hook "Codex Stop: echo done", configured in .codex/hooks.json');
  // (a tool server or plug-in is its whole configuration: one the base held, changed, is no longer the one it held;
  // #476's fallback security review)
  const searchServer = command => `[mcp_servers.search]\ncommand = "${command}"\nargs = ["-y", "search@1.0.0"]\n`;
  const heldServer = project({ ".codex/config.toml": searchServer("npx"), ...listing() });
  passes(run(pr(heldServer, { "README.md": "a change of its own\n" })), "a tool server the base held unlisted, unchanged, is noted");
  fails(run(pr(heldServer, { ".codex/config.toml": searchServer("bash") })), "and one whose command the pull request changes fails", 'the tool server "Codex search"');
  fails(run(pr(project({ ".codex/config.toml": searchServer("npx") }), { ".codex/config.toml": searchServer("bash") })), "so too where no list is written yet", 'the tool server "Codex search", configured in .codex/config.toml, is new in this pull request');
  const market = ref => ({ ...JSON.parse(KIT), enabledPlugins: { "helper@example-market": true }, extraKnownMarketplaces: { "example-market": { source: { source: "github", repo: "example/market", ref } } } });
  fails(run(pr(project({ ".claude/settings.json": market("main") }), { ".claude/settings.json": market("other") })), "and a plug-in whose marketplace the pull request points elsewhere", 'the plug-in "helper@example-market"');
  const sharedMarket = ref => ({ ...JSON.parse(KIT), enabledPlugins: { "helper@m": true }, extraKnownMarketplaces: { m: { source: { source: "settings", plugins: [{ name: "helper", source: { source: "github", repo: "example/helper", sha: C1 } }, { name: "other", source: { source: "github", repo: "example/other", ref } }] } } } });
  const sharedRun = run(pr(project({ ".claude/settings.json": sharedMarket("main"), ...listing() }), { ".claude/settings.json": sharedMarket("next") }));
  const bare = sha => ({ ...JSON.parse(KIT), enabledPlugins: { helper: true }, extraKnownMarketplaces: { helper: { source: { source: "settings", plugins: [{ name: "helper", source: { source: "github", repo: "example/helper", sha } }] } } } });
  passes(run(pr(project({ ".claude/settings.json": bare(C1) }), { ".claude/settings.json": bare(C2) })), "a plug-in named with no marketplace is read as before: by its name");
  ok(sharedRun.status === 0 && /note as the base held it[^\n]*the plug-in "helper@m"/.test(sharedRun.out), "while a change to another plug-in's entry in the same marketplace leaves it as the base held it", sharedRun.out);
  // (a list written before the check read Kiro's and Codex's files: what they held stands, noted, and only a pull
  // request that adds one fails; #476's code review)
  const older = project({ ".codex/config.toml": "notify = [\"notify-send\", \"done\"]\n", ...listing() });
  const unchanged = run(pr(older, { "README.md": "a change of its own\n" }));
  ok(unchanged.status === 0 && /note as the base held it, nothing fails here: the hook "Codex notify: notify-send done"/.test(unchanged.out), "a tool the base held unlisted, beside a list written before the check read it, is noted, not failed", unchanged.out);
  fails(run(pr(older, { "README.md": "another change of its own\n" }), "--core"), "in the core's own repository none stands, base or none", 'the hook "Codex notify: notify-send done", configured in .codex/config.toml, is not listed');
  fails(run(pr(older, { ".codex/config.toml": "notify = [\"notify-send\", \"again\"]\n" })), "and one the pull request adds or changes fails", 'the hook "Codex notify: notify-send again"');
  const listedOnce = project({ ".codex/config.toml": "notify = [\"notify-send\", \"done\"]\n", ...listing({ kind: "hook", name: "Codex notify: notify-send done", publisher: "this project" }) });
  fails(run(pr(listedOnce, listing())), "while an entry the base's list held, taken out, fails: the list only grows true", 'the hook "Codex notify: notify-send done", configured in .codex/config.toml, is not listed');
  fails(run(project({ ".codex/config.toml": "[mcp_servers.x]\ncommand = \"npx\"\ncommand = \"node\"\n", ...listing() })), "a config.toml Codex would refuse is refused", ".codex/config.toml cannot be read as TOML (trying to redefine an already defined table or value at line 3, column 1)");
}
// ---- what the tools' settings set in the environment of the programs they start ----
{
  const withEnv = (env, file = ".claude/settings.json") => ({ [file]: JSON.stringify({ ...JSON.parse(KIT), env }, null, 2) });
  const SAYS = 'sets the variable "BASH_ENV"';
  passes(run(pr(project({ ...listing() }), withEnv({ ANTHROPIC_MODEL: "x", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "1", DISABLE_TELEMETRY: "1", MAX_THINKING_TOKENS: "1", CI: "1" }))), "a setting's \"env\" of the variables kept passes");
  fails(run(pr(project({ ...listing() }), withEnv({ BASH_ENV: "scripts/x.sh" }))), "one that sets a variable a shell reads as it starts fails", SAYS, '.claude/settings.json: "env"', "Mend: take it out");
  // (each name in one run, a project being costly to set up where git is slow, as on Windows)
  // (any variable but those kept, named whole, of plain letters: #603's fallback security reviews of f021c25, 66d3f04 and
  // 2cc401d found names a list left out, and a prefix kept let others in)
  const names = ["ENV", "PATH", "Path", "NODE_OPTIONS", "GIT_DIR", "GIT_CONFIG_COUNT", "LD_PRELOAD", "BASH_FUNC_x", "HOME", "XDG_CONFIG_HOME", "SSH_ASKPASS", "CLAUDE_CODE_SHELL_PREFIX", "CLAUDE_PROJECT_DIR", "ComSpec", "SHELL", "GCONV_PATH", "LOCPATH", "GCM_GITHUB_HELPER", "EDITOR", "DEBUG", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_GIT_BASH_PATH", "CLAUDE_CODE_AUTOMOUNT_ROOTS", "CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS", "CLAUDE_CODE_PLUGIN_DIRS", "CLAUDE_CODE_PROCESS_WRAPPER", "CLAUDE_CODE_SAFE_MODE", "ANTHROPIC_BASE_URL", "ANTHROPIC_CUSTOM_HEADERS", "DISABLE_X", "CLAUDE_CODE_MAX_OUTPUT_TOKENſ"];
  fails(run(pr(project({ ...listing() }), withEnv(Object.fromEntries(names.map(n => [n, "x"]))))), `and so does one that sets ${names.join(", ")}`, ...names.map(n => `sets the variable "${n}"`));
  fails(run(pr(project({ ...listing() }), withEnv({ BASH_ENV: "x" }, ".claude/settings.local.json"))), "in settings.local.json too", '.claude/settings.local.json: "env"');
  fails(run(pr(project({ ...listing() }), { ".codex/config.toml": "[profiles.fast.shell_environment_policy.set]\nHOME = \"cfg\"\n" })), "and in a Codex profile's, which replaces it where the profile is chosen", '.codex/config.toml: "profiles.fast.shell_environment_policy.set"', 'sets the variable "HOME"');
  fails(run(pr(project({ ...listing() }), { ".codex/config.toml": "[shell_environment_policy]\nset = { NODE_OPTIONS = \"x\" }\n" })), "and in Codex's config, the environment its commands are given", '.codex/config.toml: "shell_environment_policy.set"', 'sets the variable "NODE_OPTIONS"');
  fails(run(pr(project({ ...listing() }), withEnv(["BASH_ENV"]))), "an \"env\" that is no object is refused as the wrong shape", '"env" is not a JSON object');
  const held = project({ ...withEnv({ BASH_ENV: "scripts/x.sh" }), ...listing() });
  const heldRun = run(pr(held, { "README.md": "a change of its own\n" }));
  ok(heldRun.status === 0 && heldRun.out.includes(SAYS), "one the base held is noted, not failed", heldRun.out);
  const heldHook = run(pr(held, { ".claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), env: { BASH_ENV: "scripts/x.sh" }, model: "opus" }, null, 2) }));
  ok(heldHook.status === 0 && heldHook.out.includes(SAYS), "and stays noted while the file changes around it", heldHook.out);
  fails(run(pr(held, withEnv({ BASH_ENV: "scripts/y.sh" }))), "but not once the pull request changes its value", SAYS);
  fails(run(project(withEnv({ BASH_ENV: "x" })), "--core"), "in the core's own repository none may stand", SAYS);
  // (#603's code review of c08aa8e: with no base to read against, one that stands is noted, as a pin or a hook's source is)
  const noBase = run(project({ ...withEnv({ BASH_ENV: "scripts/x.sh" }), ".Codex/hooks.json": "{}\n", ...listing() }));
  ok(noBase.status === 0 && noBase.out.includes("with no base to read against") && noBase.out.includes(SAYS) && noBase.out.includes(".Codex is .codex in another case"), "with no base, one that stands is noted, and so is a tool's file in another case", noBase.out);
  ok(notDone(held, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(SAYS), "the sync note's step reads not done while one stands");
}
// ---- the TOML reader Codex's config is read with ----
{
  const t = parseToml("# c\n__proto__ = 'p'\na.b = 1 # n\ns = \"\\u00e9\\n\"\nm = \"\"\"\nx \\\n   y\"\"\"\nl = '''z'''\n[t]\nd = 1979-05-27T07:32:00Z\ni = { k = [1, 'two', [true]] }\n[[r]]\nn = 1\n[[r]]\nn = 2\n");
  const want = '{"__proto__":"p","a":{"b":1},"s":"é\\n","m":"x y","l":"z","t":{"d":"1979-05-27T07:32:00.000Z","i":{"k":[1,"two",[true]]}},"r":[{"n":1},{"n":2}]}';
  ok(JSON.stringify(t) === want && Object.getPrototypeOf(t) === Object.prototype, "TOML is read as JSON would hold it, a key \"__proto__\" a key like any other", JSON.stringify(t));
  const headers = Array.from({ length: 200 }, (_, i) => `[[${Array(i + 1).fill("a").join(".")}]]`).join("\n");
  for (const [bad, says] of [[`${headers}\n${Array(199).fill("b").join(".")} = 1\n`, "nests deeper than 200"], ["a = 1\na = 2", "trying to redefine an already defined table or value at line 2, column 1"], ["a = \"x", "unfinished string"], ["[a]\n[a]", "trying to redefine an already defined table or value at line 2, column 2"], ["a = [1", "expected comma"], ["a = 1 b", "end-of-line"], ["x = [{ a = 1 }]\n[[x]]", "trying to redefine an already defined table or value at line 2, column 3"], ["a = \"\\q\"", "escape sequence"], [`a = ${"[".repeat(300)}`, "nests deeper than 200"]]) {
    let message = "";
    try { parseToml(bad); } catch (e) { message = e.message; }
    ok(message.includes(says), `TOML that is no TOML is refused: ${says}`, message);
  }
  // (#634's search for differences: the package drops the quotes a string holds before its closing """ where a
  // line-ending backslash runs into them, so such a string is refused; a CRLF inside a string of several lines is LF)
  for (const lost of ["notify = [\"python3\", \"\"\"notify.py\\\n\"\"\"\"\"]\n", "command = \"\"\"x \\\r\n  \"\"\"\"\n", "a = \"\"\"x\\\\\\\n\"\"\"\"\n"]) {
    let message = "";
    try { parseToml(lost); } catch (e) { message = e.message; }
    ok(/^a string's line-ending backslash runs into its closing quotes, which the TOML package reads wrong at line 1, column \d+$/u.test(message), `a string whose quotes the package would drop is refused: ${JSON.stringify(lost)}`, message);
  }
  // (#634's code review: only a multi-line basic string; a literal string, a comment and a one-line string are read)
  const literal = parseToml("notify = ['''a\\\n'''', \"b\\\\\", '''c\\\n''''']\n# d\\\n");
  ok(JSON.stringify(literal.notify) === JSON.stringify(["a\\\n'", "b\\", "c\\\n''"]), "a backslash before the closing quotes of a literal string, or in a comment, is read as written", JSON.stringify(literal));
  ok(parseToml("a = \"\"\"x\\\\\n\"\"\"\"\"\nb = \"\"\"x\\\n\"\"\"\n").a === "x\\\n\"\"","a backslash escaped by another ends no line, and one with no quote of the string's own before the close is read", JSON.stringify(parseToml("a = \"\"\"x\\\\\n\"\"\"\"\"\n")));
  ok(parseToml("a = '''x\r\ny'''\r\nb = \"\"\"p\r\nq\"\"\"\r\n").a === "x\ny" && parseToml("b = \"\"\"p\r\nq\"\"\"\r\n").b === "p\nq", "a CRLF inside a string of several lines is read as LF");
  for (const bare of ["a = 1\r\r\nb = 2\r\n", "a = '''x\ry'''\n"]) {
    let refused = false;
    try { parseToml(bare); } catch { refused = true; }
    ok(refused, `a CR standing alone is refused, before a CRLF too: ${JSON.stringify(bare)}`);
  }
  // (#476's code review of fd9135b: each [[...]] header appends without reading the entries before it again)
  const began = Date.now(), many = parseToml("[[x]]\n".repeat(200000));
  ok(many.x.length === 200000 && Date.now() - began < 3000, "an array of 200,000 tables is read at once", `${Date.now() - began} ms`);
}

done("what Kiro and Codex configure");
