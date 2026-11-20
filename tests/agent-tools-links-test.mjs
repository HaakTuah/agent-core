// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): links where a tool
// reads its files. Each case a made-up project in a temporary git repository, never a real one, run as licences.yml
// runs the check, and every failure read for its mend (mend.mjs). Git and Node's own modules; the projects and their
// runs stand in scripts/agent-tools-scratch.mjs, which the tests beside this one share.
//
//   node tests/agent-tools-links-test.mjs
import fs from "node:fs";
import path from "node:path";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { mended } from "../scripts/mend.mjs";
import { notDone, STEPS } from "../scripts/steps.mjs";
import { LINKS, withPlugins, run, pr, project, listing, link, git, KIT, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

// ---- links where a tool reads its files: none is followed (git's mode 120000 says what a link is) ----
// (each case one a past review found of the reading that followed links, #600 to #706: a new or changed link fails
// whatever it leads to; one the base held is noted, and fails only where the pull request changes what its text names)
if (LINKS) {
  const LINKED = "is a link where an agent tool reads its files, and this check follows no link";
  const away = scratchDir("agent-tools-");
  fs.writeFileSync(path.join(away, "settings.json"), withPlugins({ "helper@example-market": true }));
  const shared = { "shared/notes/SKILL.md": "# notes\n", "shared/settings.json": withPlugins({ "helper@example-market": true }) };
  // (a link added by a pull request, at each kind of place a tool reads, to each kind of place: it fails as a link)
  for (const [at, to, what] of [
    [".claude/skills/notes", "../../shared/notes", "a skill linked inside the checkout, listed or not"],
    [".claude/settings.json", path.join(away, "settings.json"), "a settings file linked out of the checkout"],
    [".claude/skills", away, "a skills folder linked out of the checkout"],
    [".mcp.json", "shared/settings.json", "a tool server's file linked inside the checkout"],
    [".claude/skills/sub", "../../vendor/sub", "a skill's folder linked to a submodule"],
    [".kiro/settings", "../Shared", "a link to a name the commit holds only in another case"],
    [".claude/skills/s", "..\\..\\shared\\notes", "a link whose text only Windows reads as a path"],
    [".claude/agents/x", "../../node_modules/pkg/agents", "a link below agents into an installed package"],
    [".claude/agents", "../shared", "a folder of agents that is a link"],
    [".claude", "shared", ".claude itself as a link"],
    [".Claude", "shared", "a .claude link in another case beside a plain .claude"],
    [".claude/commands/c.md", "../../shared/notes/SKILL.md", "a command's file that is a link"],
    [".kiro/hooks/lint.json", "../../shared/settings.json", "a Kiro hook file that is a link"],
    [".codex", "shared", "Codex's folder as a link"],
  ]) fails(run(pr(project({ ...shared, ...listing({ kind: "skill", name: "notes", publisher: "this project" }) }), { [at]: link(to) })), `${what} fails, whatever it leads to`, `"${at}" ${LINKED}`);
  // (a file the base held, made a link to a place of the same text, is a link added)
  fails(run(pr(project({ ".mcp.json": withPlugins({}) }), { ".mcp.json": link(path.join(away, "settings.json")) })), "a link where the base held a file of the same text fails", `".mcp.json" ${LINKED}`);
  // (a link elsewhere in the project is none of this check's)
  passes(run(pr(project({ ...shared, ...listing() }), { "docs/notes": link("../shared/notes") })), "a link where no tool reads its files is none of the agent tools'");

  // (what stood before turns nothing red: a link the base held, the same link to the same target, is noted)
  const heldLinks = project({ ...shared, ".claude/skills/notes": link("../../shared/notes"), ".mcp.json": link(path.join(away, "settings.json")), ".claude/agents/x": link("../../node_modules/pkg/agents") });
  const stood = run(pr(heldLinks, { "README.md": "a change of its own\n" }));
  ok(stood.status === 0 && stood.out.includes(`as the base held it, nothing fails here: ".mcp.json" ${LINKED}`) && stood.out.includes(`".claude/skills/notes" ${LINKED}`) && stood.out.includes(`".claude/agents/x" ${LINKED}`), "links the base held, inside the checkout, out of it and into an installed package, are noted and fail nothing", stood.out);
  passes(run(pr(heldLinks, { "shared/notes/README.md": "beside the skill\n" })), "nor once a file beside what one leads to, which no tool reads, changes");
  // (#709's security review of c5deb9a: one into what an install fills is reported as such, never failed, since no list
  // can name every file that steers an install, and failing each pull request would lock the project)
  const filled = run(pr(project({ ...shared, ".claude/agents/x": link("../../node_modules/pkg/agents") }), { "package-lock.json": "{}\n" }));
  ok(filled.status === 0 && filled.out.includes("one an install fills (node_modules, a virtual environment), so what an install puts there, which this check cannot read"), "one the base held into an installed package is reported as such, never failed, as its lock changes", filled.out);
  passes(run(pr(heldLinks, { "shared/settings.json": withPlugins({ "other@example-market": true }) })), "nor once the place a link out of the checkout's name names in the checkout changes, which is no tool's");
  fails(run(pr(heldLinks, { ".claude/skills/notes": link("../../shared/other") })), "but one the base held, moved, is new", `".claude/skills/notes" ${LINKED}`);
  fails(run(heldLinks, "--core"), "and in the core's own repository none may stand", `".mcp.json" ${LINKED}`);
  const pushed = project({ ".claude/skills/notes": link("../../shared/notes"), ...shared });
  const noBase = run(pushed);
  ok(noBase.status === 0 && noBase.out.includes(`with no base to read against, nothing fails here: ".claude/skills/notes" ${LINKED}`), "with no base, as on a push, one is noted", noBase.out);

  // (and fails where the pull request changes what its text names: a new skill, a hook, a submodule, a link further along)
  const behind = project({ ...shared, ".claude/skills": link("../shared/skills"), "shared/skills/notes/SKILL.md": "# notes\n", ".claude/settings.json": link("../shared/settings.json"), ".kiro/settings": link("../cfg") , "cfg/mcp.json": "{}\n" });
  const BEHIND = "which the base held, and this pull request changes";
  fails(run(pr(behind, { "shared/skills/evil/SKILL.md": "# evil\n" })), "a skill a pull request adds behind a link the base held fails", `".claude/skills" is a link`, BEHIND, '"shared/skills/evil/SKILL.md"');
  fails(run(pr(behind, { "shared/skills/notes/SKILL.md": "---\nname: notes\nallowed-tools: Bash\n---\n" })), "and so does a skill changed there", BEHIND);
  fails(run(pr(behind, { "shared/settings.json": withPlugins({ "other@example-market": true }) })), "and a settings file changed behind its link", `".claude/settings.json" is a link`, BEHIND);
  fails(run(pr(behind, { "shared/skills": null })), "and the folder it names taken out", BEHIND);
  fails(run(pr(behind, { cfg: link("elsewhere") , "cfg/mcp.json": null })), "and a link on its way, made further along", `".kiro/settings" is a link`, BEHIND, '"cfg"');
  passes(run(pr(behind, { "shared/skills/notes/run.sh": "echo a helper\n", "shared/skills/README.md": "x\n" })), "while a file there that no tool reads as a tool's changes nothing");
  fails(run(pr(project({ ...shared, ".claude/skills/s": link("..\\..\\shared\\notes") }), { "shared/notes/SKILL.md": "---\nname: s\nallowed-tools: Bash\n---\n" })), "and one whose text Windows reads by its backslashes, once what that names changes", BEHIND, '"shared/notes/SKILL.md"');
  {
    const sub = project({ ...shared, ".claude/skills": link("../shared/skills"), "shared/skills/notes/SKILL.md": "# notes\n" });
    git(sub, "checkout", "-q", "-B", "change");
    fs.mkdirSync(path.join(sub, "shared/skills/vendored"), { recursive: true });
    git(sub, "update-index", "--add", "--cacheinfo", `160000,${git(sub, "rev-parse", "HEAD")},shared/skills/vendored`);
    git(sub, "commit", "-q", "-m", "a submodule behind the link"); git(sub, "checkout", "-q", "main"); git(sub, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(sub), "and a submodule put behind it", BEHIND, '"shared/skills/vendored"');
  }
  const passing = project({ ...shared, "a/b": link("../shared"), ".claude/skills": link("../a/b/skills"), "shared/skills/notes/SKILL.md": "# notes\n" });
  const past = run(pr(passing, { "shared/skills/evil/SKILL.md": "# evil\n" }));
  ok(past.status === 0 && past.out.includes("the way to what its text names passes a link, which this check does not follow"), "one whose way passes another link is reported, never failed, what lies past it unread", past.out);

  // (#709's fallback security review of c5deb9a: what a link's text names is read as Linux reads it, a ".." after a link
  // on its way and Unicode's forms among it, a submodule's change is seen whatever .gitmodules says, and a link to the
  // checkout's root is held by all a tool reads below it)
  fails(run(pr(project({ ".claude/skills": link("../x/../y"), "x/k": "x\n", "a/b/y/.keep": "", "y/notes/SKILL.md": "# notes\n" }), { x: link("a/b"), "a/b/y/evil/SKILL.md": "# evil\n" })), "a link the base held whose way steps out of a folder the pull request makes a link fails", BEHIND, '"x"');
  fails(run(pr(project({ ".claude/skills": link("../caf\u00e9"), "caf\u00e9/notes/SKILL.md": "# notes\n" }), { "cafe\u0301/evil/SKILL.md": "# evil\n" })), "and one where a skill is added under the name in another of Unicode's forms", BEHIND);
  fails(run(pr(project({ ".claude/skills": link(".."), "README.md": "x\n" }), { "evil/SKILL.md": "# evil\n" })), "and one to the checkout's root, once a skill is added there", BEHIND, '"evil/SKILL.md"');
  {
    const ignored = project({ ".claude/skills": link("../stash"), "stash/notes/SKILL.md": "# notes\n", ".gitmodules": "" });
    fs.mkdirSync(path.join(ignored, "stash/evil"), { recursive: true });
    git(ignored, "update-index", "--add", "--cacheinfo", `160000,${git(ignored, "rev-parse", "HEAD")},stash/evil`); git(ignored, "commit", "-q", "-m", "a submodule");
    git(ignored, "checkout", "-q", "-B", "change"); fs.writeFileSync(path.join(ignored, ".gitmodules"), '[submodule "evil"]\n\tpath = stash/evil\n\turl = ./x\n\tignore = all\n');
    git(ignored, "update-index", "--add", "--cacheinfo", `160000,${git(ignored, "rev-parse", "HEAD")},stash/evil`); git(ignored, "add", ".gitmodules"); git(ignored, "commit", "-q", "-m", "moved, its change ignored");
    git(ignored, "checkout", "-q", "main"); git(ignored, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(ignored), "and one whose submodule behind it moves, though .gitmodules says to ignore its changes", BEHIND, '"stash/evil"');
  }
  const outsideHeld = run(pr(project({ ".claude/skills": link(away) }), { "README.md": "x\n" }));
  ok(outsideHeld.status === 0 && outsideHeld.out.includes("its text leaves the checkout or names a whole path, so what this pull request changes where it leads is not read"), "one that leaves the checkout is reported so, never failed", outsideHeld.out);
  // (a tool held as the base's where a link is replaced with its files is the same tool, read with all the base's files)
  const market = () => project({ ".claude/settings.json": link("../conf/settings.json"), "conf/settings.json": withPlugins({ "foo@m": true }) });
  fails(run(pr(market(), { ".claude/settings.json": withPlugins({ "foo@m": true }), ".claude/settings.local.json": { extraKnownMarketplaces: { m: { source: { source: "github", repo: "example/other" } } } } })), "a link replaced with its files, a plug-in there made another by a marketplace a file beside it declares, is new", 'the plug-in "foo@m", configured in .claude/settings.json, is new');
  passes(run(pr(market(), { ".claude/settings.json": withPlugins({ "foo@m": true }) })), "while the same plug-in, its files the link's alone, stands as the base's");
  // (#709's code review of c5deb9a: a hook that takes a file from the working tree, behind a link the base held, stands
  // as the base's once the link is replaced with its files; and a checkout with core.symlinks off, which writes a link as a
  // plain file of its text, reads it as a link still)
  {
    const hooked = JSON.parse(KIT);
    hooked.hooks.Stop = [{ hooks: [{ type: "command", command: "bash scripts/format.sh" }] }];
    const text = JSON.stringify(hooked, null, 2), hookBase = project({ ".claude/settings.json": link("../conf/settings.json"), "conf/settings.json": text, "scripts/format.sh": "echo\n" });
    const hookMend = run(pr(hookBase, { ".claude/settings.json": text }));
    ok(hookMend.status === 0 && hookMend.out.includes("as the base held it, nothing fails here"), "a hook from the working tree behind a link the base held, the link replaced with its files, is noted as the base's", hookMend.out);
    // (#709's code review of e2f2f28: and a pin breach a tool behind such a link held, the link replaced with its files)
    const unpinned = JSON.stringify({ mcpServers: { files: { command: "npx", args: ["-y", "@example/files-server"] } } }, null, 2);
    const pinBase = project({ ".mcp.json": link("conf/mcp.json"), "conf/mcp.json": unpinned, ...listing({ kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" }) });
    const pinMend = run(pr(pinBase, { ".mcp.json": unpinned }));
    ok(pinMend.status === 0 && pinMend.out.includes("as the base held it, nothing fails here: the tool server") && pinMend.out.includes("fetched at no fixed version"), "a pin breach of a tool server behind a link the base held, the link replaced with its files, is noted as the base's", pinMend.out);
    const plain = project({ ...shared, ".claude/skills/notes/SKILL.md": link("../../../shared/notes/SKILL.md") });
    git(plain, "config", "core.symlinks", "false");
    fs.rmSync(path.join(plain, ".claude/skills/notes/SKILL.md")); fs.writeFileSync(path.join(plain, ".claude/skills/notes/SKILL.md"), "../../../shared/notes/SKILL.md");
    const plainRun = run(pr(plain, { "README.md": "a change of its own\n" }));
    ok(plainRun.status === 0 && plainRun.out.includes(`".claude/skills/notes/SKILL.md" ${LINKED}`), "a link a checkout with core.symlinks off writes as a plain file is read as a link, never as a skill", plainRun.out);
  }
  // (the mend: a link the base held replaced with the very files it named stands as the base's, a pull request that
  // turns a link into files adds no link, and an entry the base listed behind its link stays a note until then)
  const mendable = project({ ...shared, ".claude/skills/notes": link("../../shared/notes") });
  passes(run(pr(mendable, { ".claude/skills/notes": null, ".claude/skills/notes/SKILL.md": "# notes\n" })), "a link the base held replaced with the files it led to passes, what they configure the base's");
  // (#709's fallback check of 99a04a7: only where each step a ".." steps out of is a plain folder of the base's)
  fails(run(pr(project({ ".claude/skills": link("nope/../stash"), ".claude/stash/evil/SKILL.md": "# evil\n" }), { ".claude/skills": null, ".claude/skills/evil/SKILL.md": "# evil\n" })), "one replaced with the files its words name, where a \"..\" steps out of no folder the base held, is new", 'the skill "evil"');
  const other = run(pr(project({ ...shared, ".claude/skills/notes": link("../../shared/notes") }), { ".claude/skills/notes": null, ".claude/skills/notes/SKILL.md": "# other\n" }));
  ok(other.status === 1 && !other.out.includes(LINKED) && other.out.includes('the skill "notes", configured in .claude/skills/notes/SKILL.md, is new in this pull request') && mended(other.out), "one replaced with other files adds no link, and fails only for what it configures anew, saying to list it", other.out);
  const listedBehind = project({ ...shared, ".claude/skills/notes": link("../../shared/notes"), ...listing({ kind: "skill", name: "notes", publisher: "this project" }) });
  const unseen = run(pr(listedBehind, { "README.md": "a change of its own\n" }));
  ok(unseen.status === 0 && unseen.out.includes('as the base held it, nothing fails here: checks/licences.json: "agentTools" lists the skill "notes", which nothing configures'), "an entry the base listed behind a link it held, which no reading here follows, is noted", unseen.out);
  fails(run(pr(project({ ...shared, ...listing({ kind: "skill", name: "notes", publisher: "this project" }), ".claude/skills/notes/SKILL.md": "# notes\n" }), { ".claude/skills/notes": null })), "while one the pull request leaves configured by nothing fails", "which nothing configures");
  ok(notDone(heldLinks, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(`".claude/skills/notes" ${LINKED}`), "the sync note's step reads not done while one stands, and names it");

  // (a thousand links below a folder of agents, each to one folder of thousands of files, are read in seconds, #696)
  const many = project({ ...Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`shared/big/${i}.md`, "x"])) });
  for (let i = 0; i < 1000; i++) { fs.mkdirSync(path.join(many, ".claude/agents"), { recursive: true }); fs.symlinkSync("../../shared/big", path.join(many, `.claude/agents/l${i}`)); }
  git(many, "add", "-A"); git(many, "commit", "-q", "-m", "many links");
  const at = Date.now(), manyRun = run(pr(many, { "shared/big/new.md": "y" }));
  ok(manyRun.status === 1 && Date.now() - at < 30000, "1,000 links the base held below agents, each to 3,000 files, are read in seconds", `${Date.now() - at} ms`);
}

done("links where a tool reads its files");
