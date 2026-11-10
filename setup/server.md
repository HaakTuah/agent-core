# Setting up the machine where agents run side by side

Read only by whoever sets up the owner's machine for floor rule 18 (the owner, or a session he starts for it), once;
no other session reads it.

## The owner's checklist

1. **A Linux server of his own,** holding only the projects and what their agents need.
2. **Login by his SSH key only:** password and root login off, no other port open; the system's automatic security
   updates on.
3. **An account for the agents** (such as `agents`), not in `sudo`. Everything below is installed and signed in under
   it, never under his own.
4. **Its tools:** Git, Node, Claude Code, Codex's command line, and the tool that runs them side by side (such as
   Herdr).
5. **Its sign-ins, each with a spending limit:** Claude Code on his Claude plan; Codex on his ChatGPT plan, or on an API
   key in a project of its own with a monthly cap; and a fine-grained GitHub token for the project repositories only,
   with Contents, Pull requests and Issues set to read and write and nothing else, kept in Git's credential store or
   `gh`'s login.
6. **Codex's effort:** `model_reasoning_effort = "high"` in `~/.codex/config.toml` (checked against the documentation
   of the version installed).
7. **The projects cloned** under that account, one folder each.
8. **The agents' instructions** (below) copied to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`, which Claude Code
   and Codex read at the start of every session there.
9. **Each project's orchestrator** started by him, in the tool, from that project's folder: Claude Code on Sonnet.

## The agents' instructions

Everything else the agents need is in the rules they already read; this holds only what this machine adds:

```markdown
# Where you run

You run on the machine floor rule 18 describes: your sign-ins are on it.

- Start sessions through Herdr, with its own command line and socket API: each in a pane and a clone of its own.
- Starting Claude Code, pass its model (`--model`), and its effort where its command line takes one. Codex takes its
  model and effort from `~/.codex/config.toml`.
- GitHub works normally here (`git push`, `gh`); `modules/github-calls.md` is for cloud sessions only.
```
