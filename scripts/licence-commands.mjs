// What the commands in a project's files fetch, for the licence scan (licence-scan.mjs, beside this file, which says what
// it needs of each). It reads each npx, npm exec (Windows' npx.cmd and npm.cmd too), npm install (and its other
// spellings), npm link and npm pack, past any redirection, in a file's text (commands: a line of its own for each,
// nested ones too, as in npx -c '...', and each command written as an array, execFileSync("npx", [...]), or by a path
// to the program), and in a JSON value (commandLines: package.json's "scripts", a hook's "command", a task's program
// with its arguments). For each it says what it fetches (fetched): the packages it names, or why that cannot be read.
// npx --no-install (or --no) never fetches. A word that is no command, straight after an option, is read as that
// option's value. What cannot be read: a variable, npx naming nothing to run here ("npx -y" in a variable), npm init or
// create, which fetch by another name, npm update or npm audit fix, which take the newest a range allows, another
// registry or npm config, npm install without its lockfile, a word that is no npm command where npm stands as one.
// Other fetchers (curl, wget, pip, pnpm, yarn, bun, playwright install, git clone and the like): OTHER_FETCHER. Node's
// own modules only (none).

// npm's commands that fetch a package, by every spelling npm takes; those that fetch nothing new (the lockfile's own,
// or none); and options known to take a value. A word that is no command, straight after an option, is read as that
// option's value, so an option it does not know cannot hide the command after it.
const INSTALL = new Set(["install", "i", "in", "ins", "inst", "insta", "instal", "isnt", "isnta", "isntal", "isntall", "add", "install-test", "it", "pack"]);
const RUN = new Set(["exec", "x"]);
const BY_OTHER_NAME = new Set(["create", "init", "innit"]);
const UPDATE = new Set(["update", "up", "upgrade", "udpate"]);
// Where a word stands as a command: at a line's start, after ; & | ( { [ = or !, in "$(", after "run:" or "- ", after a
// word that runs the next (sudo, exec, env, time, nohup, xargs, if, then, do, else and the like), or at the start of a
// string that opens a line or follows ( { [ = : , -c or run: (a message, echo "npm ...", is only words).
const AT_COMMAND = /(?:^|[;&|({[=!]|\$\(|\brun:|^\s*-|(?:^|[({[=:,]|\s-c|\s--command|\brun:)\s*['"`]|\b(?:sudo|exec|env(?:\s+\w+=\S*)*|time|nohup|xargs|if|elif|while|until|then|do|else))\s*$/u;
const LINK = new Set(["link", "ln"]);
const CONFIG = new Set(["config", "c", "set"]);
const NO_FETCH = new Set([
  "access", "adduser", "add-user", "audit", "author", "bugs", "issues", "cache", "ci", "clean-install", "ic", "install-clean", "isntall-clean", "install-ci-test",
  "cit", "clean-install-test", "completion", "config", "c", "get", "set", "dedupe", "ddp", "deprecate", "diff", "dist-tag", "dist-tags",
  "docs", "home", "doctor", "edit", "explain", "why", "explore", "find-dupes", "fund", "help", "hlp", "help-search", "hook",
  "ll", "la", "login", "logout", "ls", "list", "org", "outdated", "owner", "ping", "pkg", "prefix", "profile",
  "prune", "publish", "query", "rebuild", "rb", "repo", "restart", "root", "run", "run-script", "rum", "urn", "sbom",
  "search", "find", "s", "se", "shrinkwrap", "star", "stars", "start", "stop", "team", "test", "t", "tst", "token",
  "undeprecate", "uninstall", "unlink", "remove", "rm", "r", "un", "unpublish", "unstar", "version", "verison", "v",
  "view", "info", "show", "whoami",
]);
const VALUED = new Set([
  "-C", "-w", "-L", "--access", "--auth-type", "--before", "--browser", "--ca", "--cache", "--cafile", "--call", "-c",
  "--cert", "--cidr", "--cpu", "--depth", "--diff", "--diff-dst-prefix", "--diff-src-prefix", "--diff-unified",
  "--editor", "--expect-result-count", "--fetch-retries", "--fetch-retry-factor", "--fetch-retry-maxtimeout",
  "--fetch-retry-mintimeout", "--fetch-timeout", "--globalconfig", "--heading", "--https-proxy", "--include",
  "--init-author-email", "--init-author-name", "--init-author-url", "--init-license", "--init-module", "--init-version",
  "--install-strategy", "--key", "--libc", "--local-address", "--location", "--lockfile-version", "--loglevel",
  "--logs-dir", "--logs-max", "--maxsockets", "--message", "-m", "--node-options", "--noproxy", "--omit", "--os", "--otp",
  "--pack-destination", "--preid", "--prefix", "--provenance-file", "--proxy", "--registry", "--replace-registry-host",
  "--save-prefix", "--sbom-format", "--sbom-type", "--scope", "--script-shell", "--searchexclude", "--searchlimit",
  "--searchopts", "--searchstaleness", "--shell", "--tag", "--tag-version-prefix", "--umask", "--userconfig", "--viewer",
  "--which", "--workspace",
]);
// Other fetchers, as a command (at a line's or command's start, or as a program named in quotes before its arguments).
export const OTHER_FETCHER = new RegExp(
  "(?:^|[\\s;&|(`$\'\"/\\\\])(?:curl|wget)\\s+(?:-[-a-zA-Z]|https?://|[\'\"$])|['\"`](?:[^'\"`\\s]*[/\\\\])?(?:curl|wget|pip3?|pipx|pnpm|yarn|bunx|bun|gem|cargo|deno)['\"`]\\s*,\\s*\\[|" +
    "['\"`](?:[^'\"`\\s]*[/\\\\])?git['\"`]\\s*,\\s*\\[\\s*['\"`]clone|" +
    "\\b(?:pipx?3?\\s+install|pnpm\\s+(?:dlx|add|install|i)\\s|yarn\\s+(?:dlx|add)\\s|bunx\\s|bun\\s+(?:add|x|install)\\s|playwright\\s+install|" +
    "git\\s+clone|gem\\s+install|cargo\\s+install|go\\s+install|apt(?:-get)?\\s+install|brew\\s+install|deno\\s+(?:install|run))",
  "mu",
);

/**
 * What one command line fetches: { specs, unreadable, packs } where specs are the packages written for npx, npm exec,
 * npm install (and its other spellings) or npm pack, unreadable says why a fetch could not be read, and packs that it
 * is npm pack, which only fetches. Each word loses the quotes, brackets and commas of the string or call it sits in.
 * Others: { specs: [] }.
 */
export function fetched(line, atCommand = false) {
  // (a "+" between the pieces of a string built in code joins them: npm ' + 'install x)
  const all = line.trim().split(/\s+/u).map((w) => w.replace(/^['"`([]+|['"`),;\]]+$/gu, "")).filter((w) => w && w !== "+");
  if (/^(npx|npm)\.cmd$/iu.test(all[0] ?? "")) all[0] = all[0].slice(0, 3).toLowerCase(); // (Windows' spelling)
  const end = all.findIndex((w) => w.startsWith("#") || w.startsWith("//")); // (a comment after the command)
  const kept = end < 0 ? all : all.slice(0, end);
  // (a redirection, ">log", "2> log", "&>log", "<in", goes with its target, wherever it stands)
  const words = kept.filter((w, k) => !/^\d*[<>&]/u.test(w) && !/^\d*[<>&]+$/u.test(kept[k - 1] ?? ""));
  // (an audited name means the npm registry's package: a command that fetches from elsewhere cannot be audited by it)
  if (/^(npx|npm)$/u.test(words[0] ?? "") && words.some((w) => /^--?(@[^=]*:)?registry\b|^--replace-registry-host\b|^--(user|global)config\b|^npm_config_.*(registry|config)/iu.test(w)))
    return { specs: [], unreadable: "it fetches from another registry than npm's, or reads another npm config that may name one" };
  let i = 0;
  const options = () => { while (i < words.length && words[i].startsWith("-")) i += VALUED.has(words[i]) ? 2 : 1; };
  let runs = false, npx = false, local = false, packs = false, linking = false;
  if (words[0] === "npx") { runs = npx = true; i = 1; } else if (words[0] === "npm") {
    // (after npm, its options; a word that is no command, straight after an option, is taken as that option's value)
    const fetching = (w) => INSTALL.has(w) || RUN.has(w) || BY_OTHER_NAME.has(w) || UPDATE.has(w) || LINK.has(w);
    i = 1;
    let command;
    for (let afterOption = false; i < words.length; ) {
      const w = words[i++];
      if (w.startsWith("-")) { if (VALUED.has(w)) i++; afterOption = !VALUED.has(w) && !w.includes("="); continue; }
      if (fetching(w) || NO_FETCH.has(w) || !afterOption) { command = w; break; }
      afterOption = false;
    }
    // (npm config set registry, and the like, points every later fetch at another registry; npm audit fix installs
    // releases the lockfile does not hold)
    const sets = command === "set" || words.slice(i).some((w) => w === "set" || w === "edit");
    if (CONFIG.has(command) && sets && words.slice(i).some((w) => /(^|:)registry\b|^replace-registry-host\b|^(user|global)config\b/iu.test(w)))
      return { specs: [], unreadable: "it points npm at another registry or config, so no audited name can be trusted after it" };
    if (command === "audit" && words.slice(i).includes("fix")) return { specs: [], unreadable: "npm audit fix installs releases the lockfile does not hold" };
    // (where npm stands as a command, a word after it that is no npm command cannot be read: a variable, a string
    // built in code; elsewhere, in prose, it is only a word)
    if (atCommand && command !== undefined && !fetching(command) && !NO_FETCH.has(command))
      return { specs: [], unreadable: `npm ${command}: no npm command, so what it runs cannot be read` };
    if (INSTALL.has(command) && command !== "pack" && words.slice(i).some((w) => /^--no-(package-lock|shrinkwrap)$|^--(package-lock|shrinkwrap)=false$/iu.test(w)))
      return { specs: [], unreadable: "it installs without the lockfile, so what it installs is not what the lockfile's check read" };
    if (command === undefined || !fetching(command)) return { specs: [] };
    if (UPDATE.has(command)) return { specs: [], unreadable: `npm ${command} fetches the newest release a range allows, which cannot be audited` };
    if (RUN.has(command)) runs = true;
    if (LINK.has(command)) linking = true; // (npm link <package> installs it if missing; a folder is linked as it is)
    else if (BY_OTHER_NAME.has(command)) { options(); return words[i] ? { specs: [], unreadable: `npm ${command} fetches a package by another name` } : { specs: [] }; }
    else packs = command === "pack";
  } else return { specs: [] };
  // (npx reads its options up to the command it runs; npm exec reads them, --package among them, up to "--")
  const specs = [], from = i;
  let command, called = false;
  for (; i < words.length; i++) {
    const w = words[i];
    if (w === "--") { if (runs && !npx) { command ??= words[i + 1]; break; } continue; }
    if (w === "-p" || w === "--package") { specs.push(words[++i] ?? ""); continue; }
    if (w.startsWith("--package=") || w.startsWith("-p=")) { specs.push(w.slice(w.indexOf("=") + 1)); continue; }
    // (--no-install is --yes=false; --yes, -y or --yes=<anything but false> installs; the last one given counts)
    const yes = /^(?:--yes|-y)(?:=(.*))?$/u.exec(w), no = /^(?:--no-install|--no|--no-yes)(?:=(.*))?$/u.exec(w);
    if (runs && yes) { local = yes[1] === "false"; continue; }
    if (runs && no) { local = no[1] !== "false"; continue; }
    if (runs && /^(-c|--call)(=|$)/u.test(w)) { called = true; if (!w.includes("=")) i++; continue; } // (the shell line it runs: read as a line of its own)
    if (VALUED.has(w)) { i++; continue; }
    if (w.startsWith("-")) continue;
    if (!runs) { if (!(linking && /^(\.|\/|~|file:)/u.test(w))) specs.push(w); continue; }
    command ??= w;
    if (npx) break;
  }
  if (runs && !specs.length && command !== undefined && !local && !called) specs.push(command);
  // (npx with no package and nothing to run here takes them from elsewhere: a variable, "npx -y" + a package later)
  const asks = from < words.length && words.slice(from).every((w) => /^(--version|-v|--help|-h)$/u.test(w)); // (npx --version)
  if (runs && !specs.length && command === undefined && !called && !asks) return { specs: [], unreadable: "it names nothing to run here, so what it runs comes from elsewhere" };
  return { specs, packs };
}

/**
 * A YAML folded block ("key: >") as the one line it reads as: the lines after it indented deeper than its key, up to a
 * blank line or one indented no deeper, joined with spaces (as YAML folds them).
 */
function folded(text) {
  const lines = text.split(/\r?\n/u), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*(?:-\s+)?)[\w'"$.-]+\s*:\s*>[-+]?\d?\s*$/u.exec(lines[i]);
    if (!m) { out.push(lines[i]); continue; }
    // (blank lines inside the block, before a line still deeper, break it into the lines YAML folds it to)
    const key = m[1].length, start = i, block = [""];
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) { if (block.at(-1)) block.push(""); continue; }
      if (lines[j].search(/\S/u) <= key) break;
      block[block.length - 1] += ` ${lines[j].trim()}`;
      i = j;
    }
    out.push(`${lines[start]}${block[0]}`, ...block.slice(1).filter(Boolean));
  }
  return out.join("\n");
}

/** The strings of an array written only of string literals ("[", literals and commas, "]"), or null: read by hand. */
function literalArray(src) {
  if (src[0] !== "[") return null;
  const out = [], space = () => { while (/\s/u.test(src[i] ?? "")) i++; };
  let i = 1;
  for (;;) {
    space();
    if (src[i] === "]") return i === src.length - 1 ? out : null;
    const quote = src[i];
    if (quote !== "'" && quote !== '"' && quote !== "`") return null;
    const end = src.indexOf(quote, i + 1);
    if (end < 0 || (quote === "`" && src.slice(i, end).includes("${"))) return null;
    out.push(src.slice(i + 1, end));
    i = end + 1;
    space();
    if (src[i] === ",") i++;
    else if (src[i] !== "]") return null;
  }
}

/**
 * The command lines in a text: each npx or npm and what follows it on its line, and each written as an array. A line
 * continued on the next (a shell's "\\" at its end, or a YAML folded block, "key: >") is read as one.
 */
export function commands(text, code = false) {
  const out = [];
  const joined = folded(text.replace(/\\\r?\n/gu, " "));
  // (each npx or npm, nested ones too, as in npx -c 'npm install ...', starts a line of its own; an array, below)
  // (a command runs to the next ; | && || or & that is no redirection; a redirection is read past in fetched())
  for (const m of joined.matchAll(/\b(?=(npx|npm)(\.cmd)?\b(?!['"`]\s*,))/giu)) {
    const before = joined.slice(joined.lastIndexOf("\n", m.index) + 1, m.index);
    // (a shell's check that it is there, as a statement of its own, never one whose answer is kept: $(command -v npx))
    if (!code && /(?:^|[;&|!]|\b(?:if|elif|while|until|then|do|else))\s*(?:command\s+-v|which|type|hash)\s+$/u.test(before)) continue;
    out.push(Object.assign(new String(/^(?:[^\n;|&]|&(?=>)|(?<=[<>])&)*/u.exec(joined.slice(m.index))[0]), { atCommand: AT_COMMAND.test(before) }));
  }
  // (an array of literal strings is read as its words; any other arguments, a variable or a spread, cannot be)
  // (in code, a string that is only npx or npm, not called with its arguments right there, is a program held in a
  // variable, which cannot be followed; in a workflow or a config, "npm" names npm, as an ecosystem or a cache)
  // (in a shell script, a variable set to only npx or npm, "$NPX -y x", is a program held in a variable too)
  if (!code) for (const m of joined.matchAll(/^\s*(?:(?:export|local|readonly|declare|typeset)(?:\s+-\w+)*\s+)?\w+=["']?(?:\S*\/)?(npx|npm)(?:\.cmd)?["']?\s*$/gimu)) out.push(`${m[1].toLowerCase()} ${m[1].toLowerCase() === "npm" ? "install " : ""}a-program-held-in-a-variable`);
  if (code) for (const m of joined.matchAll(/['"`](?:[^'"`\s]*[/\\])?(npx|npm)(?:\.cmd)?['"`](?!\s*,)/giu)) out.push(`${m[1]} ${m[1] === "npm" ? "install " : ""}a-program-held-in-a-variable`);
  for (const m of joined.matchAll(/['"`](?:[^'"`\s]*[/\\])?(npx|npm)(?:\.cmd)?['"`]\s*,\s*(\[[^\]]*\]?|[^\s)]*)/giu)) {
    const literal = literalArray(m[2]);
    const first = /^\[\s*(?:'([^']*)'|"([^"]*)"|`([^`$]*)`)/u.exec(m[2]), command = first && (first[1] ?? first[2] ?? first[3]);
    if (literal) out.push([m[1], ...literal].join(" "));
    else if (!(m[1] === "npm" && NO_FETCH.has(command) && !CONFIG.has(command) && command !== "audit")) out.push(`${m[1]} ${m[1] === "npm" ? "install " : ""}its-arguments-not-written-out`); // (npm view with a variable: no fetch)
  }
  return out;
}

/**
 * The commands in a JSON value, one line each: every string in it (package.json's "scripts" and tools' hooks, a hook's
 * "command", a task's, a container's set-up) but those under a key of prose (an "about", a "description", a "how"),
 * which may name a command without running it. In each object, the strings and lists under keys that hold a command
 * (a task's "command" and "args", a launch's "runtimeExecutable" and "runtimeArgs") are read as one line, so a program
 * meets its arguments.
 */
const COMMAND = /command|cmd|script|exec|args|^run$/iu;
const PROSE = /^(\$?comment|about|description|summary|how|used|why|notes?|help|message|text|title|label|keywords|author|contributors|maintainers|homepage|repository|bugs|funding|licen[cs]e|url)$/iu;
const strings = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
export function commandLines(v) {
  if (!v || typeof v !== "object") return typeof v === "string" ? [v] : [];
  const programs = [], args = [], out = [];
  for (const [k, x] of Object.entries(v)) {
    if (!Array.isArray(v) && PROSE.test(k)) continue;
    const listed = Array.isArray(x) && x.every((y) => typeof y === "string");
    if (!Array.isArray(v) && COMMAND.test(k) && typeof x === "string") programs.push(x);
    else if (!Array.isArray(v) && COMMAND.test(k) && listed) args.push(...x);
    else if (!Array.isArray(v) && COMMAND.test(k)) out.push(...strings(x)); // (package.json's "scripts": every one, a "help" too)
    else out.push(...commandLines(x));
  }
  // (one program with its arguments, as a task or a launch writes them; several, each its own line, as scripts are,
  // each with any arguments beside them)
  if (programs.length === 1) return [[programs[0], ...args].join(" "), ...out];
  return [...programs.map((p) => [p, ...args].join(" ")), ...(args.length ? [args.join(" ")] : []), ...out];
}
