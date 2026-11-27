// What Kiro configures (#407): each hook in a JSON file directly under `.kiro/hooks`, and its tool servers in
// `.kiro/settings/mcp.json`, each named with "Kiro" first.
import { addHook, addServers, SERVERS, NO_COMMAND, flagShape } from "./agent-tools-read.mjs";

// What Kiro configures in the project (tools/kiro.md; kiro.dev, its pages on hooks and on tool servers, read on 16
// November 2026): each JSON file directly under .kiro/hooks, { "version", "hooks": [ { "name", "trigger", "matcher",
// "action": { "type", "command" }, "timeout", "confirm" } ] }, a command hook named by its trigger, matcher and command,
// as "Kiro Stop: <command>"; and the tool servers of .kiro/settings/mcp.json's "mcpServers", as "Kiro <name>".
export function readKiro(state, json, files) {
  for (const name of files(".kiro/hooks").filter(n => n.endsWith(".json")).sort()) {
    const file = `.kiro/hooks/${name}`, hooks = json(file)?.hooks;
    // (and a "hooks" that is no list is refused as the wrong shape, as the readers of Claude Code's files refuse theirs)
    if (hooks !== undefined && hooks !== null && !Array.isArray(hooks)) state.flag(`${file}: "hooks" is not a JSON list. Mend: write it as one, of each hook's settings, as Kiro reads it`, file);
    for (const hook of Array.isArray(hooks) ? hooks : []) {
      const action = hook?.action, runs = action?.type === "command" && typeof action.command === "string";
      const commands = commandsOf(state, file, hook, runs);
      const matcher = typeof hook?.matcher === "string" && hook.matcher ? hook.matcher : "";
      addHook(state, file, { tool: "Kiro", event: String(hook?.trigger), matcher, hook, runs, text: runs ? action.command : JSON.stringify(hook), commands });
    }
  }
  addServers(state, ".kiro/settings/mcp.json", state.entries(".kiro/settings/mcp.json", "mcpServers", json(".kiro/settings/mcp.json")?.mcpServers, SERVERS), "Kiro ");
}
// Each command one Kiro hook may run: its action's, and each its confirmation may run, its "confirmCommand" and each
// option's "run"; a confirmation, its options or an option in another shape, or a command given that is no text, refused
// as the wrong shape with its own value, never passed over; an action of any other type, or none, runs no command the
// kit's form can be read in, weighed as such (NO_COMMAND).
function commandsOf(state, file, hook, runs) {
  const given = v => v !== undefined && v !== null, object = v => v && typeof v === "object" && !Array.isArray(v);
  const named = `the hook ${JSON.stringify(String(hook?.name))}`, wrong = (what, form, value) => flagShape(state, file, `the "${what}" of ${named}`, form, value, "write it as one, as Kiro reads it");
  const confirm = object(hook?.confirm) ? hook.confirm : {}, options = Array.isArray(confirm.options) ? confirm.options : [];
  if (given(hook?.confirm) && !object(hook.confirm)) wrong("confirm", "a JSON object", hook.confirm);
  if (given(confirm.options) && !Array.isArray(confirm.options)) wrong("confirm.options", "a JSON list, of each option's settings", confirm.options);
  options.forEach((o, i) => { if (!object(o)) wrong(`confirm.options[${i}]`, "a JSON object, of the option's settings", o); });
  const asked = [["confirm.confirmCommand", confirm.confirmCommand], ...options.map((o, i) => [`confirm.options[${i}].run`, o?.run])].filter(([, c]) => given(c));
  for (const [what, c] of asked) if (typeof c !== "string") wrong(what, "a text, the command it runs", c);
  return [...(runs ? [hook.action.command] : []), ...asked.map(([, c]) => c).filter(c => typeof c === "string"), ...(runs ? [] : [NO_COMMAND])];
}
