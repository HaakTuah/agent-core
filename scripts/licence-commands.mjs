// What the commands in a project's files fetch, for the licence scan (licence-scan.mjs, beside this file, which says
// what it needs of each). It reads each npx, npm exec (Windows' npx.cmd and npm.cmd too), npm install (and its other
// spellings), npm link, npm pack, npm diff, npm cache add and npm publish, past any redirection, in a file's text
// (commands: a line of its own for each, nested ones too, as in npx -c '...', and each command written as an array,
// execFileSync("npx", [...]), or by a path to the program), and in a JSON value (commandLines: package.json's
// "scripts", a hook's "command", a task's program with its arguments). For each it says what it fetches (fetched): the
// packages it names, or why that cannot be read. npx --no-install (or --no) never fetches. A word that is no command,
// straight after an option, is read as that option's value. What cannot be read: a variable, npx naming nothing to run
// here ("npx -y" in a variable), npm init or create, which fetch by another name, npm update or npm audit fix, which
// take the newest a range allows, another registry or npm config, npm install without its lockfile, a word that is no
// npm command where npm stands as one (atCommand), a command running on past 16 KB. Other fetchers (curl, wget, pip,
// pnpm, yarn, bun, playwright install, git clone and the like): OTHER_FETCHER, and Windows' and .NET's: WINDOWS_FETCHER;
// of those, the downloads by address (curl, wget and PowerShell's): downloads.
// Node's own modules only (none).

// npm's commands that fetch a package, by every spelling npm takes; those that fetch nothing new (the lockfile's own,
// or none); and options known to take a value. A word that is no command, straight after an option, is read as that
// option's value, so an option it does not know cannot hide the command after it.
const INSTALL = new Set(["install", "i", "in", "ins", "inst", "insta", "instal", "isnt", "isnta", "isntal", "isntall", "add", "install-test", "it", "pack"]);
const RUN = new Set(["exec", "x"]);
const BY_OTHER_NAME = new Set(["create", "init", "innit"]);
const UPDATE = new Set(["update", "up", "upgrade", "udpate"]);
// The words that run another program, given among their arguments (sudo -Hu root npm, timeout --signal KILL 60 npm,
// flock /tmp/lock npm, npx cross-env A=1 npm); those that run a string as a command line (eval "npm ...", sh -c,
// concurrently "npm run a" "npm run b", nodemon --exec "..."); and the words after which a command starts.
const RUNNERS = new Set([
  "sudo", "doas", "su", "runuser", "pkexec", "env", "cross-env", "cross-env-shell", "env-cmd", "dotenv", "time",
  "nohup", "nice", "ionice", "timeout", "xargs", "parallel", "stdbuf", "unbuffer", "chronic", "flock", "watch",
  "setsid", "taskset", "chrt", "strace", "ltrace", "valgrind", "systemd-run", "caffeinate", "script", "xvfb-run",
  "faketime", "fakeroot", "chroot", "unshare", "nsenter", "firejail", "bwrap", "proxychains", "torsocks",
  "dbus-run-session", "concurrently", "nodemon", "eval", "exec", "command", "builtin", "npx",
]);
const STRING_RUNNERS = /^(?:-c|--command|--exec|run:|eval|concurrently|watch|cross-env-shell|parallel|su)$/u;
const KEYWORDS = new Set(["if", "elif", "while", "until", "then", "do", "else"]);
const SPACE = new Set([" ", "\t", "\r", "\v", "\f"]);
// (an argument of a list keeps its own spaces as this mark when the list is written as one line, so it stays one word)
const KEPT = "\u0000";
const whole = (argument) => argument.replace(/\s/gu, KEPT);
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
// Other fetchers, as a command (at a line's or command's start, or as a program named in quotes before its arguments),
// past any options before their subcommand (pip --isolated install, git -C "vendor dir" clone, cargo +nightly
// install), each word read with its quoted parts, eight at most: past eight, a fetcher with options counts as a fetch.
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
    `(?:${fetcher("pipx?3?", "install")}|${fetcher("pnpm", "(?:dlx|add|install|i)[\"']?\\s")}|${fetcher("yarn", "(?:dlx|add)[\"']?\\s")}|${program("bunx")}\\s+[\\w@./"'$~\`\\\\-]|` +
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
/** The first fetch in text by a fetcher the scan cannot read, or undefined. */
export const otherFetch = (text) => (OTHER_FETCHER.exec(text) ?? WINDOWS_FETCHER.exec(text))?.[0];
// The fetchers among those that download a file by its address, a program among them: curl and wget, and PowerShell's.
const DOWNLOADER = /(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|(?<![\w-])(?:iwr|irm)(?![\w-]))/iu;
/** Each download by address in text, as the two readers above find their fetches: the line each stands in and the
 *  lines it runs on to (after a "\\" or PowerShell's "`" at a line's end), trimmed, once for each download, so that
 *  two alike count twice; for a report and a count, never compared word for word. */
export function downloads(text) {
  const at = [OTHER_FETCHER, WINDOWS_FETCHER].flatMap((re) => [...text.matchAll(new RegExp(re.source, `${re.flags}g`))].filter((m) => DOWNLOADER.test(m[0])).map((m) => m.index + m[0].search(/\S/u)));
  return [...new Set(at)].sort((a, b) => a - b).map((i) => {
    let end = text.indexOf("\n", i);
    while (end !== -1 && /[\\`]\r?$/u.test(text.slice(text.lastIndexOf("\n", end - 1) + 1, end))) end = text.indexOf("\n", end + 1);
    return text.slice(text.lastIndexOf("\n", i - 1) + 1, end === -1 ? text.length : end).trim();
  });
}

/**
 * What one command line fetches: { specs, unreadable, packs } where specs are the packages written for npx, npm exec,
 * npm install (and its other spellings) or npm pack, unreadable says why a fetch could not be read, and packs that it
 * is npm pack, which only fetches.
 * Others: { specs: [] }.
 */
export function fetched(line, atCommand = false, literal = false) {
  const words = wordsOf(line, literal);
  // (an audited name means the npm registry's package: a command that fetches from elsewhere cannot be audited by it)
  if (/^(npx|npm)$/u.test(words[0] ?? "") && words.some((w) => /^--?(@[^=]*:)?registry\b|^--replace-registry-host\b|^--(user|global)config\b|^npm_config_.*(registry|config)/iu.test(w)))
    return { specs: [], unreadable: "it fetches from another registry than npm's, or reads another npm config that may name one" };
  if (words[0] === "npx") return argSpecs(words.slice(1), { runs: true, npx: true });
  if (words[0] !== "npm") return { specs: [] };
  const plan = npmPlan(words, atCommand);
  return plan.done ?? argSpecs(plan.args, plan);
}

/** The words of a command line, as the shell reads them (a comment, a redirection and the quotes of what it sits in gone). */
function wordsOf(line, literal) {
  const raw = line.trim().split(/\s+/u), quoted = quotedWords(raw);
  const end = literal ? -1 : raw.findIndex((w, k) => !quoted[k] && (w.startsWith("#") || w.startsWith("//")));
  // (then each word loses the quotes, brackets and commas of the string or call it sits in; a "+" between the pieces of
  // a string built in code joins them: npm ' + 'install x)
  const words = unredirected(end < 0 ? raw : raw.slice(0, end), (k) => !literal && !quoted[k] && /^\d*[<>&]/u.test(raw[k] ?? ""), raw)
    .map((w) => w.replace(/^['"`([{]+|['"`),;\]}]+$/gu, "").replaceAll(KEPT, " ")).filter((w) => w && w !== "+");
  if (/^(npx|npm)\.cmd$/iu.test(words[0] ?? "")) words[0] = words[0].slice(0, 3).toLowerCase(); // (Windows' spelling)
  return words;
}

/**
 * Which words stand inside quotes: a comment after the command, and a redirection, ">log", "2> log", "&>log", "<in",
 * with its target wherever it stands, are known by the word as written and only outside quotes: a quoted '#x',
 * "release #1" or '>' is an argument. Quotes are followed twice, a backslash escaping the next character and not,
 * since it may belong to a string around the command ("npm i --cache \"a #c\" x" in code); a word counts as outside
 * only where both readings say so.
 */
function quotedWords(raw) {
  const inside = (escapes) => {
    let quote = "";
    return raw.map((w) => {
      const was = quote !== "";
      for (let k = 0; k < w.length; k++) {
        if (escapes && w[k] === "\\" && quote !== "'") k++;
        else if (quote) { if (w[k] === quote) quote = ""; } else if ("'\"`".includes(w[k])) quote = w[k];
      }
      return was;
    });
  };
  const escaped = inside(true), plain = inside(false);
  return raw.map((w, k) => escaped[k] || plain[k]);
}

/** `words` without each redirection (`operator` says which of `raw` begins one) and the target it stands before. */
function unredirected(words, operator, raw) {
  return words.filter((w, k) => !operator(k) && !(operator(k - 1) && /^\d*[<>&]+$/u.test(raw[k - 1])));
}

/**
 * What npm does with its command: the line's result where that is final ({ done }), else the words it takes as
 * arguments, and whether the command runs a program (npm exec), links or packs.
 */
function npmPlan(words, atCommand) {
  const { command, i, early } = npmCommand(words);
  const rest = words.slice(i);
  const refused = npmRefusal(command, rest);
  if (refused) return { done: refused };
  // (npm diff --diff=<spec>, npm cache add <spec> and npm publish <spec> fetch what they name, and prepare a git
  // package, running its scripts: each but a local folder or tarball is a package to audit)
  if (command === "diff" || command === "cache" || command === "publish") return { done: { specs: pathSpecs(command, command === "diff" ? [...early, ...rest] : rest) } };
  const unread = npmUnreadable(command, atCommand, [...early, ...rest]);
  if (unread) return { done: unread };
  if (command === undefined || !fetching(command)) return { done: { specs: [] } };
  if (UPDATE.has(command)) return { done: { specs: [], unreadable: `npm ${command} fetches the newest release a range allows, which cannot be audited` } };
  if (BY_OTHER_NAME.has(command)) return { done: skipOptions(words, i) < words.length ? { specs: [], unreadable: `npm ${command} fetches a package by another name` } : { specs: [] } };
  const runs = RUN.has(command);
  return { args: runs ? [...early, ...rest] : rest, runs, npx: false, linking: LINK.has(command), packs: command === "pack" };
}

const fetching = (w) => INSTALL.has(w) || RUN.has(w) || BY_OTHER_NAME.has(w) || UPDATE.has(w) || LINK.has(w);

/** The index past the options that start `words` at `i`. */
function skipOptions(words, i) {
  while (i < words.length && words[i].startsWith("-")) i += VALUED.has(words[i]) ? 2 : 1;
  return i;
}

/** The npm command in `words`, with the index past it and the options before it. */
function npmCommand(words) {
  // (after npm, its options; a word that is no command, straight after an option, is taken as that option's value)
  let i = 1, command;
  for (let afterOption = false; i < words.length; ) {
    const w = words[i++];
    if (w.startsWith("-")) { if (VALUED.has(w)) i++; afterOption = !VALUED.has(w) && !w.includes("="); continue; }
    if (fetching(w) || NO_FETCH.has(w) || !afterOption) { command = w; break; }
    afterOption = false;
  }
  // (npm reads the options before its command as its config, as it reads those after: npm --diff=x diff)
  return { command, i, early: command === undefined ? [] : words.slice(1, i - 1) };
}

/** Why a command cannot be audited at all, whatever it names, or undefined. */
function npmRefusal(command, rest) {
  // (npm config set registry, and the like, points every later fetch at another registry; npm audit fix installs
  // releases the lockfile does not hold)
  const sets = command === "set" || rest.some((w) => w === "set" || w === "edit");
  if (CONFIG.has(command) && sets && rest.some((w) => /(^|:)registry\b|^replace-registry-host\b|^(user|global)config\b/iu.test(w)))
    return { specs: [], unreadable: "it points npm at another registry or config, so no audited name can be trusted after it" };
  if (command === "audit" && rest.includes("fix")) return { specs: [], unreadable: "npm audit fix installs releases the lockfile does not hold" };
  return undefined;
}

/** Why what npm is asked to fetch cannot be read, or undefined. `all` is the options and words after "npm". */
function npmUnreadable(command, atCommand, all) {
  // (where npm stands as a command, a word after it that is no npm command cannot be read: a variable, a string
  // built in code; elsewhere, in prose, it is only a word)
  if (atCommand && command !== undefined && !fetching(command) && !NO_FETCH.has(command))
    return { specs: [], unreadable: `npm ${command}: no npm command, so what it runs cannot be read` };
  if (INSTALL.has(command) && command !== "pack" && all.some((w, k, rest) => /^--no-(package-lock|shrinkwrap)$|^--(package-lock|shrinkwrap)=false$/iu.test(w) || (/^--(package-lock|shrinkwrap)$/iu.test(w) && /^false$/iu.test(rest[k + 1] ?? ""))))
    return { specs: [], unreadable: "it installs without the lockfile, so what it installs is not what the lockfile's check read" };
  return undefined;
}

/** The packages npm diff, npm cache add and npm publish name in `rest`: not a local folder or tarball. */
function pathSpecs(command, rest) {
  // (a local folder or tarball: a path, never an address, https://x/y.tgz, or a git remote)
  const localSpec = (w) => (w.includes(":") ? w.startsWith("file:") : /^(\.|\/|~)/u.test(w) || /\.(tgz|tar\.gz)$/iu.test(w));
  const specs = [];
  let adding = command !== "cache";
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k], diff = /^--diff(?:=(.*))?$/u.exec(w);
    if (diff) { const v = diff[1] ?? rest[++k]; if (command === "diff" && v !== undefined && !localSpec(v)) specs.push(v); continue; }
    if (w.startsWith("-")) { if (VALUED.has(w)) k++; continue; }
    if (!adding) { if (w !== "add") break; adding = true; continue; }
    if (command !== "diff" && !localSpec(w)) specs.push(w);
  }
  return specs;
}

/**
 * The packages npx, npm exec, npm install (and the like) name in `args`: npx reads its options up to the command it
 * runs; npm exec reads them, --package among them, up to "--", and those before "exec" too. `mode`: whether it runs
 * a program (npx, npm exec) and which, and whether it links or packs.
 */
function argSpecs(args, mode) {
  const found = { specs: [], command: undefined, called: false, local: false };
  for (let i = 0; i < args.length; i++) {
    i = argStep(args, i, mode, found);
    if (i < 0) break;
  }
  const { specs, command, called, local } = found, { runs, packs = false } = mode;
  if (runs && !specs.length && command !== undefined && !local && !called) specs.push(command);
  // (npx with no package and nothing to run here takes them from elsewhere: a variable, "npx -y" + a package later)
  const asks = args.length > 0 && args.every((w) => /^(--version|-v|--help|-h)$/u.test(w)); // (npx --version)
  if (runs && !specs.length && command === undefined && !called && !asks) return { specs: [], unreadable: "it names nothing to run here, so what it runs comes from elsewhere" };
  return { specs, packs };
}

/** Reads the word at `args[i]` into `found`; the index of the last word it took, or -1 where the reading ends. */
function argStep(args, i, { runs, npx, linking }, found) {
  const w = args[i];
  if (w === "--") {
    if (!runs || npx) return i;
    found.command ??= args[i + 1];
    return -1;
  }
  const flagged = packageFlag(args, i, found.specs) ?? (runs ? execFlag(args, i, found) : undefined);
  if (flagged !== undefined) return flagged;
  if (VALUED.has(w)) return i + 1;
  if (w.startsWith("-")) return i;
  if (!runs) {
    if (!(linking && /^(\.|\/|~|file:)/u.test(w))) found.specs.push(w);
    return i;
  }
  found.command ??= w;
  return npx ? -1 : i;
}

/** The index past a --package or -p option at `args[i]`, its package taken into `specs`; undefined if it is none. */
function packageFlag(args, i, specs) {
  const w = args[i];
  if (w === "-p" || w === "--package") { specs.push(args[i + 1] ?? ""); return i + 1; }
  if (w.startsWith("--package=") || w.startsWith("-p=")) { specs.push(w.slice(w.indexOf("=") + 1)); return i; }
  return undefined;
}

/**
 * The index past an option of what runs a program (--yes, --no-install, -c) at `args[i]`, what it says taken into
 * `found`; undefined if it is none. --no-install is --yes=false; --yes, -y or --yes=<anything but false> installs; the
 * last one given counts; -c and --call name the shell line it runs, read as a line of its own.
 */
function execFlag(args, i, found) {
  const w = args[i], yes = /^(?:--yes|-y)(?:=(.*))?$/u.exec(w), no = /^(?:--no-install|--no|--no-yes)(?:=(.*))?$/u.exec(w);
  if (yes) { found.local = yes[1] === "false"; return i; }
  if (no) { found.local = no[1] !== "false"; return i; }
  if (!/^(-c|--call)(=|$)/u.test(w)) return undefined;
  found.called = true;
  return w.includes("=") ? i : i + 1;
}

/** Whether the word at `words[k]` runs another program: a runner (by any path), npm exec, or a variable ($SUDO). */
function runnerAt(words, k) {
  const name = words[k].replace(/^.*[\/\\]/u, "");
  return RUNNERS.has(name) || (name === "npm" && RUN.has(words[k + 1])) || /^\$(\w+|\{\w+\})$/u.test(name);
}

/**
 * Whether the words before a command are what may run it: variables set for it (A=1), and then, if any, a runner,
 * whose options and arguments, whatever their form, are all taken as its own (sudo -Hu root, timeout --signal KILL 60).
 */
function prefixes(words) {
  let k = 0;
  while (k < words.length && /^\w+=/u.test(words[k])) k++;
  return k === words.length || runnerAt(words, k);
}

/**
 * Whether a string whose quote stands just after `k` opens a command line: at a line's start, after ( { [ = : or ,, or
 * after a word that runs a string (-c, --exec, eval, concurrently and the like), past other quoted strings and options
 * between (concurrently -k "npm run a" "npm run b"). It reads at most 4096 characters back, and past those, counts.
 */
function opensCommand(text, k, lineStart) {
  const reach = { left: 4096 };
  while (reach.left > 0) {
    if (lineStart(k) || "({[=:,".includes(text[k - 1])) return true;
    const before = "'\"`".includes(text[k - 1]) ? quotedBefore(text, k, reach) : wordBefore(text, k, lineStart, reach);
    if ("opens" in before) return before.opens;
    k = before.from;
    while (!lineStart(k) && SPACE.has(text[k - 1]) && reach.left-- > 0) k--;
  }
  return true;
}

// (what stands before `k` for opensCommand: either its answer, { opens }, or where the walk goes on, { from }; `reach`
// counts the characters it may still read)
function quotedBefore(text, k, reach) {
  const q = text[k - 1];
  let start = k - 1;
  while (start > 0 && text[start - 1] !== q && text[start - 1] !== "\n" && reach.left-- > 0) start--;
  if (reach.left <= 0) return { opens: true }; // (read no further: it counts)
  return start === 0 || text[start - 1] !== q ? { opens: false } : { from: start - 1 };
}

function wordBefore(text, k, lineStart, reach) {
  let start = k;
  while (!lineStart(start) && !SPACE.has(text[start - 1]) && reach.left-- > 0) start--;
  if (reach.left <= 0) return { opens: true };
  const w = text.slice(start, k).replace(/^.*[\/\\]/u, "");
  if (STRING_RUNNERS.test(w)) return { opens: true };
  return w.startsWith("-") ? { from: start } : { opens: false };
}

/**
 * Whether the npm or npx at `at` in `text` stands as a command, read by walking back over its line: past a path
 * (/usr/bin/), variables set for it (A=1) and runners with their options (sudo -E, timeout 60, npx --no-install
 * cross-env), to a line's start, ; & | ( ) { [ or !, "=", "run:", a list's "- ", if, then, do, else and the like, or a
 * quote: one that opens the string npm stands in, a command if the string opens a line or follows ( { [ = : , -c or
 * run:, or one that closes a quoted word before it ("$SUDO" npm), read as that word; either reading counts. A message,
 * echo "npm ...", is only words. The walk stops at its first word that can be no part of what runs it, and reads at
 * most 64 words or 4096 characters: past those, a line whose words could all be such parts counts as a command.
 */
function atCommand(text, at) {
  const lineStart = (k) => k === 0 || text[k - 1] === "\n";
  const words = [];
  let end = at, walked = 0;
  // (past what it reads: a command if a runner stands among the words read, or each could be a runner's option or
  // value)
  const cut = () => words.some((w, k) => runnerAt(words, k)) || words.every((w, k) => k === 0 || /^\w+=|^-/u.test(w) || /^-/u.test(words[k - 1]));
  if (end && "/\\".includes(text[end - 1])) while (end && !lineStart(end) && /[\w.~${}\/\\-]/u.test(text[end - 1]) && walked++ < 4096) end--;
  for (;;) {
    if (words.length > 64 || walked > 4096) return cut();
    while (!lineStart(end) && SPACE.has(text[end - 1])) end--;
    if (lineStart(end)) return prefixes(words);
    const c = text[end - 1];
    if (";&|(){[!".includes(c)) return prefixes(words);
    if ("],".includes(c)) return false;
    if ("'\"`".includes(c)) {
      let k = end - 1;
      while (!lineStart(k) && SPACE.has(text[k - 1])) k--;
      if (opensCommand(text, k, lineStart) && prefixes(words)) return true;
      if (end === at || !SPACE.has(text[end])) return false; // (a quote right before npm opens its string)
      let open = end - 2;
      while (open >= 0 && text[open] !== c && text[open] !== "\n" && walked++ < 4096) open--;
      if (walked > 4096) return cut(); // (read no further: past what it reads, it counts)
      if (open < 0 || text[open] !== c) return false;
      // (the word the quoted part ends, with what stands before it: PAD="x y" npm, "$SUDO" npm)
      let start = open;
      while (!lineStart(start) && !SPACE.has(text[start - 1]) && walked++ < 4096
        && !(";&|()[]!,'\"`".includes(text[start - 1]) || (text[start - 1] === "{" && text[start - 2] !== "$"))) start--;
      words.unshift(text.slice(start, end).replace(/['"`]/gu, ""));
      end = start;
      continue;
    }
    let start = end;
    while (!lineStart(start) && !SPACE.has(text[start - 1]) && walked++ < 4096
      && !(";&|()[]!,'\"`".includes(text[start - 1]) || (text[start - 1] === "{" && text[start - 2] !== "$"))) start--;
    const w = text.slice(start, end);
    end = start;
    let k = start;
    while (!lineStart(k) && SPACE.has(text[k - 1])) k--;
    if (w === "=" || w === "run:" || KEYWORDS.has(w) || (w === "-" && lineStart(k))) return prefixes(words);
    words.unshift(w);
  }
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
export function commands(text, code = false, literal = false) {
  const out = [];
  const joined = folded(text.replace(/\\\r?\n/gu, " "));
  // (each npx or npm, nested ones too, as in npx -c 'npm install ...', starts a line of its own; an array, below)
  // (a command runs to the next ; | && || or & that is no redirection; a redirection is read past in fetched())
  for (const m of joined.matchAll(/\b(?=(npx|npm)(\.cmd)?\b(?!['"`]\s*,))/giu)) {
    // (what stands just before it on its line, at most 64 characters: a "\0" marks a line that starts further back)
    const cut = joined.slice(Math.max(0, m.index - 64), m.index), nl = cut.lastIndexOf("\n");
    const before = nl >= 0 || m.index <= 64 ? cut.slice(nl + 1) : `\0${cut}`;
    // (a shell's check that it is there, as a statement of its own, never one whose answer is kept: $(command -v npx))
    if (!code && /(?:^|[;&|!]|\b(?:if|elif|while|until|then|do|else))\s*(?:command\s+-v|which|type|hash)\s+$/u.test(before)) continue;
    // (where it stands as a command, it is read at most 16384 characters on, and one longer, with no end, cannot be
    // read, so it fails as such; elsewhere, as in a message, 1024 characters on are read, for a fetch it names)
    const at = atCommand(joined, m.index), size = at ? 16384 : 1024;
    const rest = joined.slice(m.index, m.index + size), command = (literal ? /^[^\n]*/u : /^(?:[^\n;|&]|&(?=>)|(?<=[<>])&)*/u).exec(rest)[0];
    const whole = command.length < rest.length || m.index + rest.length === joined.length;
    // (the quote that opens a string it stands in goes with it, so its quotes are read in pairs: '...') // note)
    const prev = joined[m.index - 1] ?? "", opener = prev && "'\"`".includes(prev) ? prev : "";
    out.push(Object.assign(new String(whole || !at ? opener + command : `${m[1].toLowerCase()} install a-command-too-long-to-read`), { atCommand: at }));
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
    if (literal) out.push(Object.assign(new String([m[1], ...literal.map(whole)].join(" ")), { literal: true }));
    else if (!(m[1] === "npm" && NO_FETCH.has(command) && !CONFIG.has(command) && !/^(audit|cache|diff|publish)$/u.test(command))) out.push(`${m[1]} ${m[1] === "npm" ? "install " : ""}its-arguments-not-written-out`); // (npm view with a variable: no fetch)
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
// (each list joined a value at a time, never spread into one call, which a long list would overflow; the caller bounds
// how deep a value nests, as the scan does with tooDeep, in guards.mjs)
const add = (to, list) => { for (const x of list) to.push(x); };
const strings = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
export function commandLines(v) {
  if (!v || typeof v !== "object") return typeof v === "string" ? [v] : [];
  const programs = [], args = [], out = [], keyed = !Array.isArray(v);
  for (const [k, x] of Object.entries(v)) {
    if (keyed && PROSE.test(k)) continue;
    const command = keyed && COMMAND.test(k);
    if (command && typeof x === "string") programs.push(x);
    else if (command && Array.isArray(x) && x.every((y) => typeof y === "string")) add(args, x);
    else if (command) add(out, strings(x)); // (package.json's "scripts": every one, a "help" too)
    else add(out, commandLines(x));
  }
  return withArguments(programs, args, out);
}

// (one program with its arguments, as a task or a launch writes them; several, each its own line, as scripts are,
// each with any arguments beside them)
function withArguments(programs, args, out) {
  // (a line built from an argument list is literal: no shell reads it, so "#" or ">" there is an argument)
  const line = (words) => (args.length ? Object.assign(new String(words.join(" ")), { literal: true }) : words.join(" "));
  // (an argument holding spaces is kept whole for the list's program, and also read as a command line of its own,
  // since a list may hand a shell one: ["bash", "-c", "npx -y x"])
  const listed = args.map(whole), lines = args.filter((a) => /\s/u.test(a));
  if (programs.length === 1) return [line([programs[0], ...listed]), ...lines, ...out];
  return [...programs.map((p) => line([p, ...listed])), ...(args.length ? [line(listed)] : []), ...lines, ...out];
}
