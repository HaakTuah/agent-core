// What Kiro configures (#407): each hook in a JSON file directly under `.kiro/hooks`, and its tool servers in
// `.kiro/settings/mcp.json`, each named with "Kiro" first.
import { addHook, addServers, SERVERS, NO_COMMAND } from "./agent-tools-read.mjs";

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
// option's "run"; a value given that is no text, or options that are no list, refused as the wrong shape, never passed
// over; an action of any other type, or none, runs no command the kit's form can be read in, weighed as such (NO_COMMAND).
function commandsOf(state, file, hook, runs) {
  const confirm = hook?.confirm, given = v => v !== undefined && v !== null, options = confirm?.options, named = JSON.stringify(String(hook?.name));
  if (given(options) && !Array.isArray(options)) state.flag(`${file}: the "confirm.options" of the hook ${named} is not a JSON list. Mend: write it as one, of each option's settings, as Kiro reads it`, file);
  const asked = [confirm?.confirmCommand, ...(Array.isArray(options) ? options.map(o => o?.run) : [])].filter(given);
  if (asked.some(c => typeof c !== "string")) state.flag(`${file}: the hook ${named} holds a "confirmCommand" or an option's "run" that is no text. Mend: write each as one text, the command it runs, as Kiro reads it`, file);
  return [...(runs ? [hook.action.command] : []), ...asked.filter(c => typeof c === "string"), ...(runs ? [] : [NO_COMMAND])];
}
