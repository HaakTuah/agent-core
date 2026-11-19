# Claude's part: models, effort and usage

Read by the tool `claude` at the start of every task.

Its map (`tasks/roles.md`, "The rules name tiers, never a model"; Anthropic's models, read on 18 November 2026):
strongest, Opus; middle, Sonnet; light, Haiku; scarce top, Fable, at xhigh for escalation's last step
if you run at high.

- **Pass both model and effort** whenever you start a session or helper, save a helper whose
  definition gives them: one of a type the project defines, or a plug-in's own (`codex:codex-rescue`). Never above high,
  but for escalation and the adviser, Opus at xhigh as advice to whoever starts it; never max.
- **Name models by family alone.**
- **Fable's usage runs out first:** it takes only what needs judgement; where it is unavailable, its call goes to Opus
  at high.
- **Who to call:**
  - a helper for judgement only when it ranks above you (by tier, then effort; yours: your system prompt and
    `$CLAUDE_EFFORT`, unset meaning medium), else do it yourself;
  - a fresh eye (reviewer, design check, stand-in) and a helper for cost (search, routine parts) whatever your level;
  - a Sonnet builder hands what needs judgement to Opus at high, and its PR's first line says Sonnet built it.
- **Who builds** is picked as `roles/orchestrator.md`, "The builders", says: Claude's usage is also the owner's own, and is
  saved for the orchestrator where Claude runs it.
