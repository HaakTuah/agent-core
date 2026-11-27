// Which downloads of a file fetch a program, and which read data alone (#1361, point 11), for the licence scan's check
// that a program a file downloads is pinned by version and checksum (licence-scan.mjs's pinFault). An allow-list: a
// download is a read of data only in the one form below, and every other download, in any language, is a program's,
// asked its checksum. Node's own modules alone, and the fetchers' reader.
import { downloads } from "./licence-fetchers.mjs";

// The one form a read of data takes, alone on its line: a variable of a lowercase name set to what curl prints of a
// file of data (JSON, XML, YAML, TOML or text, by the end of its address's path), curl given -q first, so that no
// config file of curl's applies, and else no option but -f, -s, -S and -L, its output piped at most into jq -r with a
// filter in single quotes, then always into grep -Ex '[0-9][0-9A-Za-z.+-]*', and nothing else:
// `v=$(curl -q -fsS https://… | jq -r '…' | grep -Ex '[0-9][0-9A-Za-z.+-]*')`. The grep holds what the read gives,
// as the file runs, to whole lines that are each a version: a digit, then letters, digits, dots, pluses and hyphens,
// none of which a shell reads as code. So wherever its value reaches, it carries no program. The form is matched
// whole, never read in parts: a line that differs from it in any way is a program's download.
const READ = /^([a-z_][a-z0-9_]*)=\$\(\s*curl[ \t]+-q(?:[ \t]+-[fsSL]+)*[ \t]+(["']?)https:\/\/[A-Za-z0-9._~/%-]+\.(?:json|xml|ya?ml|toml|txt)\2(?:[ \t]*\|[ \t]*jq[ \t]+-r[ \t]+'[^'$`\\!\n]*')?[ \t]*\|[ \t]*grep[ \t]+-Ex[ \t]+'\[0-9\]\[0-9A-Za-z\.\+-\]\*'[ \t]*\)$/u;
// The lowercase names a shell or a program reads by themselves, so that a value set to one acts with no later mention:
// a proxy's, and those zsh ties to its PATH, prompt and arguments, or bash reads for its history and jobs. The
// environment's and the shells' own other names are uppercase, which READ takes no part of.
const SHELL_OWN = /(?:proxy|^(?:path|fpath|cdpath|manpath|module_path|mailpath|prompt|psvar|histchars|auto_resume|fignore|watch|argv))$/u;
// The one form a line that uses the read's variable takes, alone on its line: curl given no option but -f, -s, -S and
// -L, and at most -o with a file's plain name, fetching a double-quoted https address in which the variable stands, as
// `$v` or `${v}`, and nothing else expands: `curl -fsSLo m.tgz "https://…-${v}.tgz"`. That download is a program's,
// asked its checksum.
const use = (name) => new RegExp(`^curl(?:[ \\t]+-[fsSL]+)*(?:[ \\t]+-[fsSL]*o[ \\t]*[A-Za-z0-9._-]+)?(?:[ \\t]+-[fsSL]+)*[ \\t]+"https://(?:[^"$\`\\\\\\s]|\\$(?:${name}|\\{${name}\\})(?!\\w))*"$`, "u");
// What could reach a variable by a name the file builds, hand every variable to what runs, or run a line as other than
// it reads: an indirect expansion, text run as code, the commands that export or print them all, a here-document (whose
// text the shell expands before it hands it on), the last word of the command before (`$_`), and curl, jq or grep
// defined anew, as a function or an alias, or found elsewhere: any name that ends in `path` (the search path, set or
// added to, by the shell or a workflow's `$GITHUB_PATH`), `hash` and `enable` (which point a command's name at another
// program), a file read in by `.` or `source` (whose functions the file does not show; any word `.` with a word after it, at the cost of a checksum where it is an argument, as `find .` is), and `BASH_ENV` or
// `$GITHUB_ENV` (which have bash read such a file at its start). It reads the file three times, each with its quotes
// and backslashes taken out: its lines as they stand; with every backslash at a line's end joining it to the next; and
// joined as bash joins them, where an odd count of backslashes ends a line. It refuses where any holds such a name: so
// a name quoted, escaped or continued in part reads as the name, and so does one on a line that only seems continued,
// or after one. The file is read alone, and as plainly written:
// what the environment the file runs in defines before it starts (a function exported to it, a search path its runner
// sets), and a command whose name the file builds as it runs, are trusted to the project's reviews, as by each check of
// the scan, which reads only the commands a file writes plainly.
const REACHES_ANY = /\$\{!|<<|(?<![\w-])(?:eval|export|declare|typeset|env|printenv|compgen|Invoke-Expression|iex)(?![\w-])|(?<![\w-])set[ \t]+(?:-[A-Za-z]*a|-o[ \t]+allexport)|(?<![\w-])set[ \t]*(?:$|[;|&)>])|\$_(?!\w)|\$\{_\}|(?<![\w-])(?:function[ \t]+(?:curl|jq|grep)|alias[ \t]+(?:curl|jq|grep)|(?:curl|jq|grep)[ \t]*\(\))(?![\w-])|(?<![\w-])\w*path(?![\w-])|(?<![\w-])(?:hash|enable|source|BASH_ENV|GITHUB_ENV)(?![\w-])|(?:^|[\s;&|(){}!])\.[ \t]+[^\s#]/imu;

/** The downloads of `code` that may fetch a program: all but its reads of data. A read of data is a download of the
 *  form READ, its output held to versions by its grep, once in the file, whose variable's name is none a shell or
 *  program reads by itself (SHELL_OWN), and which is used only on lines of the one form `use`, a download of a
 *  double-quoted address that holds no other expansion (that download, a program's, asked its checksum), each of these
 *  lines standing outside any quote and no continuation of the line before (`plain`), in a file where nothing could
 *  reach the variable otherwise (REACHES_ANY). */
export function programDownloads(code) {
  const all = downloads(code);
  const bare = (text) => text.replace(/["'\\]/gu, "");
  const text = String(code), joined = text.replace(/\\\r?\n/gu, ""), continued = text.replace(/(?<!\\)((?:\\\\)*)\\\r?\n/gu, "$1");
  if ([text, joined, continued].some((t) => REACHES_ANY.test(bare(t)))) return all;
  const raw = String(code).split(/\r?\n/u), lines = raw.map((l) => l.trim()), free = plain(raw);
  return all.filter((d) => !readsData(d, all, lines, free));
}

function readsData(d, all, lines, free) {
  const name = READ.exec(d)?.[1];
  if (!name || SHELL_OWN.test(name) || all.filter((x) => x === d).length !== 1 || lines.filter((l) => l === d).length !== 1) return false;
  const named = new RegExp(`(?<!\\w)${name}(?!\\w)`, "u"), used = use(name);
  return lines.every((line, i) => !named.test(line) || (free[i] && (line === d || (all.includes(line) && !READ.test(line) && used.test(line)))));
}

// For each line of a shell file, whether it starts outside any quote or backtick and does not continue the line before
// it by a backslash: a line inside a string spanning lines is text another command is handed, never a line of its own.
function plain(raw) {
  let quote = "";
  const out = raw.map((line) => { const before = quote, s = scan(line, quote); quote = s.quote; return { before, continues: s.continues }; });
  return out.map((s, i) => !s.before && !(i > 0 && out[i - 1].continues));
}

// The quote open at the end of a line that starts with `quote` open, and whether the line ends in a backslash that
// continues it, a comment's end aside.
function scan(line, quote) {
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (escaped) escaped = false;
    else if (c === "\\" && quote !== "'") escaped = true;
    else if (quote) { if (c === quote) quote = ""; }
    else if (c === "#" && (i === 0 || /\s/u.test(line[i - 1]))) return { quote, continues: false };
    else if (c === "'" || c === '"' || c === "`") quote = c;
  }
  return { quote, continues: escaped };
}
