// The fetchers the licence scan cannot read the packages of (licence-scan.mjs, beside this file, fails a file that
// holds one): other fetchers (curl, wget, pip, pnpm, yarn, bun, playwright install, git clone and the like) by
// OTHER_FETCHER, Windows' and .NET's by WINDOWS_FETCHER, found in a text by otherFetches; and, of those, the downloads
// by address (curl, wget and PowerShell's), by downloads. What npm's own commands fetch is read apart, in
// licence-npm.mjs, and where commands stand in a file, in licence-commands.mjs.
// Node's own modules only (none).

// Other fetchers, as a command (at a line's or command's start, or as a program named in quotes before its arguments),
// past any options before their subcommand (pip --isolated install, git -C "vendor dir" clone, cargo +nightly
// install; pip's download and wheel as its install, #1074), each word read with its quoted parts, eight at most: past
// eight, a fetcher with options counts as a fetch.
// A program's name may stand as a word, or as a quoted word of its own, by its path too ("pip" install,
// "$here/node_modules/.bin/playwright" install, or \"pip\" in a string of code), and so may its subcommand (pip "install").
// bunx counts only before what can start an argument, so code that names "bunx" in a comparison or a list passes.
const PART = String.raw`(?:[^\s"']|"[^"\n]*"|'[^'\n]*')`;
const OPTION = String.raw`(?:\s+[-+]${PART}+(?:\s+(?:[^\s"'+-]|"[^"\n]*"|'[^'\n]*')${PART}*)?)`;
const program = (name) => String.raw`(?:\b${name}|\\?"(?:[^"\n]*[/\\])?${name}\\?"|\\?'(?:[^'\n]*[/\\])?${name}\\?')`;
const fetcher = (name, then) => `${program(name)}(?:${OPTION}{0,8}\\s+\\\\?["']?${then}|${OPTION}{8})`;
export const OTHER_FETCHER = new RegExp(
  "(?:(?:^|[\\s;&|(`$\'\"/\\\\])(?:curl|wget)|\\\\?\"(?:[^\"\\n]*[/\\\\])?(?:curl|wget)\\\\?\"|\\\\?\'(?:[^\'\\n]*[/\\\\])?(?:curl|wget)\\\\?\')" +
    "\\s+(?:-[-a-zA-Z]|https?://|[\'\"$])|['\"`](?:[^'\"`\\s]*[/\\\\])?(?:curl|wget|pip3?|pipx|pnpm|yarn|bunx|bun|gem|cargo|deno)['\"`]\\s*,\\s*\\[|" +
    "['\"`](?:[^'\"`\\s]*[/\\\\])?git['\"`]\\s*,\\s*\\[\\s*['\"`]clone|" +
    `(?:${fetcher("pipx?3?", "(?:install|download|wheel)")}|${fetcher("pnpm", "(?:dlx|add|install|i)[\"']?\\s")}|${fetcher("yarn", "(?:dlx|add)[\"']?\\s")}|${program("bunx")}\\s+[\\w@./"'$~\`\\\\-]|` +
    `${fetcher("bun", "(?:add|x|install)[\"']?\\s")}|${fetcher("playwright", "install")}|${fetcher("git", "clone")}|${fetcher("gem", "install")}|` +
    `${fetcher("cargo", "install")}|${fetcher("go", "install")}|${fetcher("apt(?:-get)?", "install")}|${fetcher("brew", "install")}|` +
    `${fetcher("deno", "(?:install|run)")})`,
  "mu",
);
// Windows' and .NET's fetchers, in any case, as PowerShell reads its commands: dotnet's installs and updates of a tool,
// a workload, a template or a package (dotnet package add and update too, and dotnet new -i, the spelling before
// .NET 7) and its one-off runs of a tool (dotnet tool exec, dnx), but not dotnet restore or what else reads the
// project's own package list, which the project's own check holds; nuget, choco, winget and scoop installing or
// updating; PowerShell's installs and its downloads (Invoke-WebRequest and the like, iwr and irm, of an address with or
// without its scheme, or a variable), each before an argument: a name standing alone, as a label or a comparison holds
// it, fetches nothing. Written as a program and its array of arguments too, as OTHER_FETCHER reads its own.
export const WINDOWS_FETCHER = (() => {
  const Q = "['\"`]", FIRST = String.raw`\s*,\s*\[\s*(?:${Q}-[^'"` + "`" + String.raw`\n]*${Q}\s*,\s*){0,8}${Q}`; // (a program, then its array, past options)
  const named = (name) => String.raw`${Q}(?:[^'"` + "`" + String.raw`\s]*[/\\])?${name}(?:\.exe)?${Q}${FIRST}`;
  return new RegExp(
    `(?:${fetcher(String.raw`dotnet(?:\.exe)?`, String.raw`(?:(?:tool|workload|new)["']?\s+["']?(?:install|update)\b|tool["']?\s+["']?exec\b|new\s+(?:-i|--install)\b|package["']?\s+["']?(?:add|update)\b|add["']?\s+(?:${PART}+\s+)?["']?package["']?\s)`)}|` +
      `${fetcher(String.raw`(?:nuget|choco|winget|scoop)(?:\.exe)?`, String.raw`(?:install|upgrade|update)["']?\s`)}|${fetcher(String.raw`winget(?:\.exe)?`, String.raw`add["']?\s`)}|` +
      String.raw`${program("dnx")}\s+[\w@./"'$~` + "`" + String.raw`\\-]|${Q}(?:[^'"` + "`" + String.raw`\s]*[/\\])?dnx${Q}\s*,\s*\[|` +
      String.raw`${named("(?:nuget|choco|winget|scoop)")}(?:install|upgrade|update)${Q}|${named("winget")}add${Q}|` +
      String.raw`${named("dotnet")}(?:(?:tool|workload|new)${Q}\s*,\s*${Q}(?:install|update)|tool${Q}\s*,\s*${Q}exec|package${Q}\s*,\s*${Q}(?:add|update)|add${Q}\s*,\s*(?:${Q}[^'"` + "`" + String.raw`\n]*${Q}\s*,\s*)?${Q}package)${Q}|` +
      String.raw`(?:^|[\s;&|({` + "`" + String.raw`$'"/\\])(?:Install-(?:Module|Package|Script|PSResource)\s+(?:-[a-zA-Z]|['"$(@]|[\w.])|` +
      String.raw`(?:Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|iwr|irm)\s+(?:-[a-zA-Z]|https?://|['"$(@]|[\w-]+\.[a-z]{2,})))`,
    "imu",
  );
})();
// A git clone written as a program and its array of arguments whose source reads exactly as local, which opens no
// connection and downloads nothing (#1437): its arguments all strings, but an option's value and, after "--", the folder
// it clones to; its options among those below, none that reaches past the source (submodules, a config that rewrites an
// address); its source a file:// address, or a path with no ":" (no scheme, no host:path, no transport::), or one that
// starts with "/", "./" or "../" before a value held in a name; its program "git" by that name alone; and its call one of Node's that runs a program
// through no shell, by the name the file imports it by, closed after the array or after an object of options among a
// few, none a shell or an environment. Anything else the scan cannot read exactly, and stays a fetch.
const CLONE_FLAGS = new Set(["-q", "--quiet", "-v", "--verbose", "--progress", "-n", "--no-checkout", "--bare", "--mirror", "--single-branch", "--no-single-branch", "--no-tags", "-l", "--local", "--no-local", "--no-hardlinks", "-s", "--shared"]);
const CLONE_VALUED = new Set(["--depth", "--shallow-since", "--shallow-exclude", "-b", "--branch", "-o", "--origin"]);
// The place of the quote that closes the string or template opening at text[i] (its escapes and ${} read past), or -1.
function stringEnd(text, i) {
  const q = text[i];
  for (i++; text[i] !== q; i++) {
    if (i >= text.length || (q !== "`" && text[i] === "\n")) return -1;
    if (text[i] === "\\") i++;
    else if (q === "`" && text.startsWith("${", i)) { i = exprEnd(text, i + 2); if (i < 0 || text[i] !== "}") return -1; }
  }
  return i;
}
// The place where the expression at text[i] ends: the "," or closing bracket at its own depth (its strings and
// templates read past), or -1 where it cannot be read exactly (a comment or a "/" outside a string, no end).
function exprEnd(text, i) {
  const depth = [];
  for (; i >= 0 && i < text.length; i++) {
    const ch = text[i];
    if (!depth.length && ",)]}".includes(ch)) return i;
    if ("'\"`".includes(ch)) { i = stringEnd(text, i); if (i < 0) return -1; }
    else if (ch === "/") return -1;
    else if ("([{".includes(ch)) depth.push(")]}"["([{".indexOf(ch)]);
    else if (")]}".includes(ch) && depth.pop() !== ch) return -1;
  }
  return -1;
}
// A value whose reading changes nothing: a name, or names joined by ".", String() of a name, a number, true or false.
const NAME = "[A-Za-z_$][\\w$]*", SIMPLE = new RegExp(`^(?:${NAME}(?:\\.${NAME})*|String\\(${NAME}\\)|\\d[\\d_]*|true|false)$`, "u");
// What an argument written as `source` is: a string ("text", its value), a template ("template", its text before any
// ${}, each ${} a value above; "text" where it holds none), a spread, or anything else ("other", its text); a backslash
// leaves it unread, so "other".
function argument(source) {
  const string = /^(?:"([^"\\\n]*)"|'([^'\\\n]*)')$/u.exec(source), template = /^`([^`\\]*)`$/u.exec(source);
  if (string) return { kind: "text", value: string[1] ?? string[2] };
  const parts = template && [...template[1].matchAll(/\$\{([^}]*)\}/gu)];
  if (parts?.length && parts.every((p) => SIMPLE.test(p[1].trim())) && !template[1].replace(/\$\{[^}]*\}/gu, "").includes("${")) return { kind: "template", head: template[1].slice(0, template[1].indexOf("${")) };
  if (template && !template[1].includes("${")) return { kind: "text", value: template[1] };
  return { kind: source.startsWith("...") ? "spread" : "other", raw: source };
}
// Whether the argument a, an option's value or a folder, reads as a string, a template or a value above.
const readable = (a) => a.kind === "text" || a.kind === "template" || (a.kind === "other" && SIMPLE.test(a.raw));
// The arguments of an array that opens at text[i], and the place after its "]", or null where one cannot be read.
function arrayAt(text, i) {
  const out = [];
  for (i++; ; ) {
    while (/\s/u.test(text[i] ?? "")) i++;
    if (text[i] === "]") return { args: out, end: i + 1 };
    const end = exprEnd(text, i);
    if (end < 0 || !/^[,\]]$/u.test(text[end])) return null;
    out.push(argument(text.slice(i, end).trim()));
    i = text[end] === "," ? end + 1 : end;
  }
}
// A source read as local: a file:// address of no host ("file:///" or a drive's "file://C:/"), no second separator and no
// "%" after; a plain path of no ":", not "-", "//" or "\\\\" first; or a template that starts with one before its ${}.
const localSource = (a) => (a.kind === "text" && (/^file:\/\/(?:\/|[A-Za-z]:\/)(?![/\\])[^%\n]*$/u.test(a.value) || (a.value !== "" && !/[:\n]/u.test(a.value) && !/^(?:-|\/\/|\\\\)/u.test(a.value)))) ||
  (a.kind === "template" && (a.head.startsWith("file://") || /^(?:\/(?!\/)|\.\.?\/)/u.test(a.head)));
// How many arguments the option args[k] takes, itself and its value, or 0 where it is none of those above.
function optionAt(args, k) {
  const { value } = args[k];
  if (CLONE_FLAGS.has(value) || (value.startsWith("--") && value.includes("=") && CLONE_VALUED.has(value.split("=")[0]))) return 1;
  return CLONE_VALUED.has(value) && args[k + 1] && readable(args[k + 1]) ? 2 : 0;
}
// Whether a, the folder a clone writes to, cannot be read as an option: anything readable after "--"; before it, a string
// or a template that does not start with "-".
const notOption = (a, ended) => (ended && readable(a)) || (a.kind === "text" ? a.value !== "" : a.kind === "template" && /^[^-]/u.test(a.head));
// Whether the arguments of a clone, after "clone", read exactly as one of a local source (above).
function localArguments(args) {
  let source = null, folder = false, ended = false;
  for (let k = 1; k < args.length; k++) {
    const a = args[k], option = !ended && a.kind === "text" && a.value.startsWith("-");
    if (a.kind === "spread") return false;
    if (option && a.value === "--") ended = true;
    else if (option) { const n = optionAt(args, k); if (!n) return false; k += n - 1; }
    else if (source === null) { if (!localSource(a)) return false; source = a; }
    else if (folder || !notOption(a, ended)) return false;
    else folder = true;
  }
  return source !== null;
}
// The options a call may give a local clone: none of them runs it through a shell or sets its environment.
const CALL_OPTIONS = new Set(["cwd", "stdio", "encoding", "timeout", "maxBuffer", "windowsHide"]);
// Whether the value of a call's option reads as one above, or as an array of plain strings.
const optionValue = (raw) => readable(argument(raw)) || /^\[\s*(?:(?:"[\w-]*"|'[\w-]*')(?:\s*,\s*(?:"[\w-]*"|'[\w-]*'))*\s*(?:,\s*)?)?\]$/u.test(raw);
// The place where the value of a call's option at text[i] ends, or -1 where it does not read as one above.
function valueEnd(text, i) {
  const end = exprEnd(text, i);
  return end >= 0 && optionValue(text.slice(i, end).trim()) ? end : -1;
}
// The place after the "}" of an object of options that opens at text[i], each of its keys among those above, written
// plainly, alone or with a value that can be read, or -1.
function optionsEnd(text, i) {
  for (i++; ; ) {
    const key = /^\s*(?:\}|(?:([A-Za-z]\w*)|"(\w+)"|'(\w+)')\s*(:?))/u.exec(text.slice(i));
    if (!key) return -1;
    if (key[0].trim() === "}") return i + key[0].length;
    if (!CALL_OPTIONS.has(key[1] ?? key[2] ?? key[3]) || (!key[4] && !key[1])) return -1;
    i += key[0].length;
    if (key[4]) i = valueEnd(text, i);
    else while (/\s/u.test(text[i] ?? "")) i++;
    if (text[i] !== "," && text[i] !== "}") return -1;
    if (text[i] === ",") i++;
  }
}
// Whether the call whose array of arguments ends at text[end] closes there, or after an object of options (above).
function callCloses(text, end) {
  const after = /^\s*(?:\)|,\s*)/u.exec(text.slice(end));
  if (!after || after[0].trim() === ")") return Boolean(after);
  const at = end + after[0].length, close = text[at] === "{" ? optionsEnd(text, at) : -1;
  return close > 0 && /^\s*,?\s*\)/u.test(text.slice(close));
}
// The functions of Node's that run a program with its arguments as given, through no shell unless an option says so.
const DIRECT_CALLS = new Set(["execFileSync", "execFile", "spawnSync", "spawn"]);
const IMPORTS = /^import\s*\{([^}]*)\}\s*from\s*["'](?:node:)?child_process["'];?$/gmu;
const IDENT = "\\p{ID_Continue}$\\u200c\\u200d";
// The words after which a name stands alone, and the file's opening: its blank lines, comments of either kind and
// imports (none holding a comment), up to the first line that is none of them.
const AFTER = new RegExp(`(?:^|[^${IDENT}.#\\s])\\s*(?:return|else|await|void|yield|throw|case|do|in|of|typeof)$`, "u");
const OPENING = /^(?:\s|\/\/[^\n]*|\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/|#![^\n]*|import\s[^;'"`/]*["'][^"'\n]*["'];?)*/u;
// Whether a name at text[i] stands alone: before it, read back past spaces, the start of the text, a mark or one of the
// words above, after which no ".", "#", comment or longer name can stand, on a line that holds no "//".
function standsAlone(text, i) {
  const before = text.slice(0, i).trimEnd(), line = before.slice(before.lastIndexOf("\n") + 1);
  return before === "" || ((/[;{}()=,:?!&|[>]$/u.test(before) || AFTER.test(before)) && !line.includes("//"));
}
// Whether the call whose first argument opens at text[i] is of one of those functions by its own name, standing alone
// (above), which the file's opening imports by that name from node:child_process, and which it uses nowhere but in calls
// that stand alone.
function directCall(text, i) {
  const call = /([\w$]+)\s*\(\s*$/u.exec(text.slice(0, i)), name = call?.[1];
  if (!DIRECT_CALLS.has(name) || !standsAlone(text, call.index)) return false;
  const opening = OPENING.exec(text)[0];
  const rest = opening.replace(IMPORTS, (line, names) => (names.split(",").some((entry) => entry.trim() === name) ? "\0;" : line)) + text.slice(opening.length);
  return rest.includes("\0") && [...rest.matchAll(new RegExp(`(?<![${IDENT}#])${name}(?![${IDENT}])`, "gu"))]
    .every((m) => /^\s*\(/u.test(rest.slice(m.index + name.length)) && standsAlone(rest, m.index));
}
// Whether the match m of OTHER_FETCHER is a clone by git, written as an array, whose source reads exactly as local (above).
function localClone(text, m) {
  if (!/^['"`]git['"`]\s*,\s*\[\s*['"`]clone$/u.test(m[0])) return false;
  const array = arrayAt(text, m.index + m[0].lastIndexOf("["));
  return Boolean(array) && array.args[0]?.value === "clone" && localArguments(array.args) && callCloses(text, array.end) && directCall(text, m.index);
}
// Each fetch in text by a fetcher the scan cannot read, as the two readers above find them: their matches, each place
// once, in the order they stand, but a git clone of a local source (localClone).
const matches = (text) => [...new Map([OTHER_FETCHER, WINDOWS_FETCHER].flatMap((re) => [...text.matchAll(new RegExp(re.source, `${re.flags}g`))]).map((m) => [m.index, m])).values()].filter((m) => !localClone(text, m)).sort((a, b) => a.index - b.index);
// The line in text that holds the place i, with the lines that run on to it and those it runs on to (after a "\\" or
// PowerShell's "`" at a line's end).
function runOn(text, i) {
  const goesOn = (line) => /[\\`]\r?$/u.test(line);
  let start = text.lastIndexOf("\n", i - 1), end = text.indexOf("\n", i);
  while (start > 0 && goesOn(text.slice(text.lastIndexOf("\n", start - 1) + 1, start))) start = text.lastIndexOf("\n", start - 1);
  while (end !== -1 && goesOn(text.slice(text.lastIndexOf("\n", end - 1) + 1, end))) end = text.indexOf("\n", end + 1);
  return text.slice(start + 1, end === -1 ? text.length : end);
}
/** Each fetch in text by a fetcher the scan cannot read, in the order they stand: the line it stands in and the lines
 *  that run on to it or it runs on to, spaces run together, so that one fetch is told from another by its source and its words
 *  (licence-scan.mjs's `unaudited`). A source held in a variable set on another line is not part of it. */
export const otherFetches = (text) => matches(text).map((m) => runOn(text, m.index + Math.max(0, m[0].search(/\S/u))).replace(/\s+/gu, " ").trim());
// The fetchers among those that download a file by its address, a program among them: curl and wget, and PowerShell's.
const DOWNLOADER = /(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|(?<![\w-])(?:iwr|irm)(?![\w-]))/iu;
/** Each download by address in text, as the two readers above find their fetches: the line each stands in and the
 *  lines it runs on to (after a "\\" or PowerShell's "`" at a line's end), trimmed, once for each download, so that
 *  two alike count twice; for a report and a count, never compared word for word. */
export function downloads(text) {
  const at = matches(text).filter((m) => DOWNLOADER.test(m[0])).map((m) => m.index + m[0].search(/\S/u));
  return [...new Set(at)].sort((a, b) => a - b).map((i) => runOn(text, i).trim());
}
