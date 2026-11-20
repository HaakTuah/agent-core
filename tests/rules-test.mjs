// Tests rulesAt (scripts/rules.mjs; #812): the rules of a commit are read from git once for each root, commit id and
// `agents`, since the staged cases set from one commit read it once for each case (staged.mjs, fingerprints); a name
// that moves (HEAD, a branch, one written like an id) is read again, as it names another commit; and what a caller does
// with the rules it was given changes none that is asked after. The git it reads is handed in, a fake that answers
// from a table of commits and counts what it was asked, so no repository is made; one case reads the core's own
// repository with the git it runs by itself. Node's own modules.
//
//   node tests/rules-test.mjs
import { ROOT, rulesAt } from "../scripts/rules.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const ID = n => String(n).repeat(40);
// (a repository: commits by id, each its files; names by what they point at; and a count of the file reads)
const repository = (commits, names = {}) => {
  const asked = { show: 0, list: 0 };
  const git = (...args) => {
    const [command, ...rest] = args;
    if (command === "rev-parse") {
      const name = rest.at(-1).replace(/\^\{commit\}$/u, "");
      const id = names[name] ?? (commits[name] ? name : null);
      if (!id) throw new Error(`unknown revision ${name}`);
      return `${id}\n`;
    }
    if (command === "ls-tree") {
      asked.list++;
      const files = Object.keys(commits[rest.find(a => commits[a])]);
      return rest.includes("AGENTS.md") ? files.filter(f => f === "AGENTS.md").join("\n") : files.filter(f => f !== "AGENTS.md").join("\n");
    }
    if (command === "show") { asked.show++; const [id, file] = rest[0].split(":"); return commits[id][file]; }
    throw new Error(`unexpected ${args.join(" ")}`);
  };
  return { git, asked };
};
const leads = rs => rs.map(r => r.lead).join();
const one = "tasks/a.md";
const A = ID("a"), B = ID("b"), C = ID("c");
const commits = {
  [A]: { [one]: "- **Rule one.** Its text.\n" },
  [B]: { [one]: "- **Rule one.** Its text.\n- **Rule two.** More.\n", "AGENTS.md": "- **Own rule.** Here.\n" },
  [C]: { [one]: "- **Rule three.** Last.\n" },
};

{
  const { git, asked } = repository(commits);
  ok(leads(rulesAt("/r1", A, { git })) === "Rule one" && leads(rulesAt("/r1", B, { git })) === "Rule one,Rule two" && leads(rulesAt("/r1", A, { git })) === "Rule one",
    "the rules of two commits of one repository are each its own, in either order they are asked");
  const reads = asked.show;
  rulesAt("/r1", A, { git }); rulesAt("/r1", B, { git });
  ok(asked.show === reads, "a commit asked again is not read again");
}
{
  const { git } = repository(commits);
  const first = rulesAt("/r2", A, { git });
  first[0].text = "changed by a caller"; first.pop();
  ok(rulesAt("/r2", A, { git }).length === 1 && rulesAt("/r2", A, { git })[0].text === "- **Rule one.** Its text.", "what a caller does with the first answer it was given changes none that is asked after");
  const later = rulesAt("/r2", A, { git });
  later[0].text = "changed again";
  ok(rulesAt("/r2", A, { git })[0].text === "- **Rule one.** Its text.", "nor what it does with a later one");
}
{
  const { git } = repository(commits);
  ok(leads(rulesAt("/r3", B, { git })) === "Rule one,Rule two" && leads(rulesAt("/r3", B, { git, agents: true })) === "Own rule,Rule one,Rule two" && leads(rulesAt("/r3", B, { git })) === "Rule one,Rule two",
    "a commit asked with its AGENTS.md and without are each their own");
}
{
  const other = repository({ [A]: { [one]: "- **Elsewhere.** Another repository, the same id.\n" } });
  const { git } = repository(commits);
  ok(leads(rulesAt("/r4", A, { git })) === "Rule one" && leads(rulesAt("/r5", A, { git: other.git })) === "Elsewhere" && leads(rulesAt("/r4", A, { git })) === "Rule one",
    "the same id in two repositories gives each its own rules");
}
{
  const names = { HEAD: A, ["f".repeat(64)]: A, "main": A };
  const { git, asked } = repository(commits, names);
  const before = leads(rulesAt("/r6", "HEAD", { git }));
  const lists = asked.list;
  Object.assign(names, { HEAD: C, ["f".repeat(64)]: B, main: B });
  ok(before === "Rule one" && leads(rulesAt("/r6", "HEAD", { git })) === "Rule three" && asked.list > lists, "a name that moves (HEAD) is read again, and gives the commit it names now");
  ok(leads(rulesAt("/r6", "f".repeat(64), { git })) === "Rule one,Rule two" && leads(rulesAt("/r6", "main", { git })) === "Rule one,Rule two" && leads(rulesAt("/r6", A, { git })) === "Rule one",
    "so does a name written like an id, and a name beside the id it once named is not mistaken for it");
  let thrown = null;
  try { rulesAt("/r6", "nothing-such", { git }); } catch (e) { thrown = e; }
  ok(thrown !== null, "a name that is no commit is no rules");
}
{
  // (the git it runs by itself, on the core's own commit: the floor's first rule, and AGENTS.md's rules only where asked)
  const floor = "floor/security.md: 1. Nothing secret in the repository";
  const without = rulesAt(ROOT, "HEAD"), within = rulesAt(ROOT, "HEAD", { agents: true });
  ok(without.some(r => r.key === floor) && !without.some(r => r.file === "AGENTS.md") && within.some(r => r.key === floor) && within.some(r => r.file === "AGENTS.md"),
    "its own git reads the core's commit: the floor's rules, and those of AGENTS.md where asked");
}
done("what rulesAt reads once and what it reads each time");
