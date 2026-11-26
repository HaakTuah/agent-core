// The fixtures the pruning's tests share (tests/pruning-test.mjs, tests/pruning-unheld-test.mjs; #895): rules, their numbers,
// what holds them, and three prunings, as tests/pruning-test.mjs held them before the split. Node's own modules only.

export const R = (f, lead) => ({ file: f, lead, key: `${f}: ${lead}` });
export const marked = R("tasks/b.md", "Marked"), agents = R("AGENTS.md", "A process rule");
export const still = R("tasks/a.md", "Still"), moved = R("tasks/a.md", "Moved"), quiet = R("tasks/b.md", "Quiet"), loud = R("tasks/b.md", "Loud"), floor = R("floor/security.md", "1. Floor"),
  passed = R("roles/shared/c.md", "Passed"), stand = R("tasks/d.md", "Stand-in"), young = R("tasks/a.md", "Young"), unknown = R("tasks/a.md", "Unknown"), own = R("tasks/d.md", "Own");
export const numbers = { [still.key]: "findings; outcome: robust", [moved.key]: "findings; outcome: robust", [stand.key]: "findings; outcome: asked", [own.key]: "correction: misread; outcome: asked",
  [young.key]: "findings; outcome: robust", [unknown.key]: "findings; outcome: robust", [marked.key]: "check fires; outcome: robust; rare harm", [agents.key]: "findings; outcome: robust" };
export const named = { [quiet.key]: "check: scripts/c.mjs", [loud.key]: "check: scripts/a.mjs, in part", [floor.key]: "check: scripts/c.mjs", [marked.key]: "check: scripts/c.mjs", [still.key]: "check: GitHub's ruleset" };
export const p = [
  { at: "2026-07-01", numbers: { [stand.key]: 1, [own.key]: 1 }, direct: { misread: 2, failed: 1, live: 3 } },
  { at: "2026-09-01", numbers: { [still.key]: 3, [moved.key]: 3, [stand.key]: 2, [own.key]: 2, [young.key]: 1, [unknown.key]: 1, [agents.key]: 2 }, direct: { misread: 2, failed: 1, live: 3 } },
  { at: "2026-11-01", from: "2026-09-01T00:00:00Z", numbers: { [still.key]: 3, [moved.key]: 4, [stand.key]: 3, [own.key]: 3, [young.key]: 1, [unknown.key]: 1, [agents.key]: 2 }, direct: { misread: 2, failed: 4, live: 3 },
    fired: { ".github/workflows/tests.yml#A and B": 2, ".github/workflows/own.yml#D": 1 }, cited: { [still.key]: 4, [loud.key]: 1 }, without: { "c-case": { verdict: "pass" }, "d-case": { verdict: "fail" } } },
];
export const cases = [{ name: "c-case", holds: [passed.key] }, { name: "d-case", holds: [still.key] }];
