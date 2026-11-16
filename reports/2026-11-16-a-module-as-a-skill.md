# Can a module be packaged as a skill? (16 November 2026)

One of the two things `#304` asks to be looked into when it is built, each with a short report and no rule (its point
6). It changes no rule. Each tool's own documentation was read on 16 November 2026 by a helper session that changed
nothing; a fact the documentation does not give is marked so, and nothing here was tried in a tool.

## The answer

**It can, in every tool the core has a part for, and it would not do what `#304` asks.** All five have skills: a folder
with a `SKILL.md`, whose description the tool shows the model at each turn and whose body the model opens when the
description fits the task. So a module's opening line could be a skill's description, and its body a pointer to the
module. But in every tool the load is the model's own pick, guaranteed by none, which is the choice `#304` takes away
from the session: "left to a session, it reads everything or misses one". The reading script stays the mechanism. A
skill could be a second carrier beside it, as a hook is: it saves time where it fires and holds nothing.

## What each tool's documentation says

| Tool | Where a skill lies | What loads it | Limits it states |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills/<name>/SKILL.md` | the model, when the description fits; `paths` in its front matter narrows that to matching files; by hand, `/name` | the description is cut at 1,536 characters in the listing; after compaction a skill keeps 5,000 tokens, 25,000 in all |
| Codex | `.agents/skills/<name>/SKILL.md`, in each folder from the working one up to the root | the model, when the task fits the description; by hand | the list of skills takes at most 2% of the context window, descriptions shortened first, then skills left out with a warning |
| Kiro | `.kiro/skills/<name>/SKILL.md`; also steering files with `inclusion: fileMatch`, `manual` or `auto` | the model, on the description; a steering file with `fileMatch`, on a matching file | a custom agent loads neither skills nor steering unless they are among its resources |
| Antigravity | `.agents/skills/<name>/SKILL.md` (the older `.agent/skills` still read) | the model, which sees names and descriptions each turn | none stated |
| Copilot | `.github/skills`, `.claude/skills` or `.agents/skills`; also `.github/instructions/*.instructions.md` with `applyTo` paths | "when relevant", no more said; `applyTo`, on a matching path | none stated; code review reads them from the pull request's head branch |

The pages: `code.claude.com/docs/en/skills`; `developers.openai.com/codex/skills` (it redirects); `kiro.dev/docs/skills/`
and `kiro.dev/docs/steering/`; `antigravity.google/docs/skills`; `docs.github.com`, "About agent skills" and "Adding
repository custom instructions". Not found in them: whether Codex's cloud agent loads skills, the front matter Copilot
reads, and any limit for Kiro's steering files.

## What it would take, and what it would cost

- **Three folders for five tools.** `.agents/skills/` is read by Codex, Antigravity and Copilot, `.claude/skills/` by
  Claude Code and Copilot, `.kiro/skills/` by Kiro alone. One copy of the text cannot serve all: the starter kit would
  write the same skill two or three times, or a link, which only Codex's documentation says it follows.
- **Each skill is a protected file and a listed tool.** A tool's own folder is what runs by itself (floor rule 3), and
  floor topic 15 has every skill a project configures listed under "agentTools" in its licence check's config. A skill
  for each kind of task is some twenty entries in each project, each changed only with two security reviews.
- **A thin skill is enough.** Its description would be the module's opening line and its body one sentence: run the
  reading script for this kind and read what it prints. The rule's text then still stands once, in the module, and the
  three copies hold nothing that can drift but a line.
- **Where it would help.** The script finds a module by a path or by a label; a kind that neither shows (a session
  about to start helpers, or to make a choice that is hard to undo) is given by the session itself. There a
  description the model matches is one more chance, and the only one a tool offers.
- **Where it would not.** A module whose kind a path or a label gives is already named by the script, twice, and the
  description check fails a pull request that leaves it out. A skill adds nothing there.

## What is left open

Whether a model in fact opens such a skill when its task fits is what a staged case would show, tool by tool
(`modules/tools.md`, "Proven by the staged cases, tool by tool"); the documentation says only that it may. A trial
would write the thin skill for the few kinds no path or label gives, in one scratch project, and count how often a
fresh session opens the module with it and without. That is an idea for a line of its own, not part of `#304`.
