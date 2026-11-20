// The step of setup/sync-notes/580-what-the-project-would-be-built-on-today.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { parse as parseChoices, where as choicesAt, wholeOf } from "../choices.mjs";
import { Unread } from "../check-configs.mjs";
import { COST } from "../step-checks.mjs";

export default { lead: "17 November 2026, what the project would be built on today", cost: COST.record,
  // (the record of core/tasks/choices.md, "What the project would be built on today", in the *choice records*: its
  // heading's end, and the issue its line "The suggestion:" names; or no record that lacks the lines that module's
  // process writes, a new project's, and one with no record yet, among them: a done that holds only until a first audit
  // records the choices the project already made, on lines "Stood before:", and the step reads not done again)
  check: p => {
    const file = choicesAt(p.manifest);
    if (!file) throw new Unread("the *choice records* the manifest names is no plain path inside the project");
    // (the records of a folder a line of the file names, as choices.mjs reads them: a file each, in the order of their names)
    const inFolder = folder => p.files.filter(f => f.startsWith(`${folder}/`) && f.endsWith(".md") && !f.slice(folder.length + 1).includes("/")).sort().map(f => (p.read(f) ?? "").replace(/\r?\n$/u, ""));
    const found = parseChoices(wholeOf(p.read(file) ?? "", inFolder));
    if (found.records.some(r => r.today && r.suggestion)) return null;
    if (found.records.every(r => !r.lacks.length)) return null;
    return `Run once the process of \`core/tasks/choices.md\`, "What the project would be built on today", in a pull request of its own: write in \`${file}\` a record headed \`## Choice: \` and what the project is built on, ending "judged again as if written today", argued on its lines \`Looked for:\`, \`The blind pick:\` and \`The judgment:\`, with the second judgment, what a move would take and gain here, apart; file one issue to the project's owner, labelled \`enhancement\`, saying what the pick would have been and, apart, what a move would cost and gain; and write that issue's number on the record's line \`The suggestion: #<its number>\`.`;
  } };
