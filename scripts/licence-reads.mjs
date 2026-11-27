// Which downloads of a file fetch a program, and which read data alone (#1361, point 11), for the licence scan's check
// that a program a file downloads is pinned by version and checksum (licence-scan.mjs's pinFault). An allow-list: a
// download is a read of data only in the one form below, and every other download, in any language, is a program's,
// asked its checksum. Node's own modules alone, and the fetchers' reader.
import { downloads } from "./licence-fetchers.mjs";

// The one form a read of data takes, alone on its line: a shell variable set to what curl prints of a file of data
// (JSON, XML, YAML, TOML or text, by the end of its address's path), curl given no option but -f, -s, -S and -L, and
// its output piped into jq -r with a filter in single quotes, and nothing else: `V=$(curl -fsS https://… | jq -r '…')`.
// No redirection, other pipe, file or option stands in it, so it keeps nothing and runs nothing. The form is matched
// whole, never read in parts: a line that differs from it in any way is a program's download.
const READ = /^([A-Za-z_][A-Za-z0-9_]*)=\$\(\s*curl(?:[ \t]+-[fsSL]+)*[ \t]+(["']?)https:\/\/[A-Za-z0-9._~/%-]+\.(?:json|xml|ya?ml|toml|txt)\2(?:[ \t]*\|[ \t]*jq[ \t]+-r[ \t]+'[^'$`\\!\n]*')?[ \t]*\)$/u;
// What could reach a variable by a name the file builds, or hand every variable to what runs, so that a variable's use
// cannot be read from its name: an indirect expansion, text run as code, and the commands that export or print them all.
const REACHES_ANY = /\$\{!|(?<![\w-])(?:eval|export|declare|typeset|env|printenv|compgen|Invoke-Expression|iex)(?![\w-])|(?<![\w-])set[ \t]+(?:-[A-Za-z]*a|-o[ \t]+allexport)|(?<![\w-])set[ \t]*(?:$|[;|&)>])/imu;

/** The downloads of `code` that may fetch a program: all but its reads of data. A read of data is a download of the
 *  form READ, once in the file, whose variable is used only as `$V` or `${V}` inside a double-quoted address of
 *  another download that holds no other expansion, so that what the read printed is only ever part of an address
 *  (that download, a program's, asked its checksum), in a file where nothing could reach the variable otherwise
 *  (REACHES_ANY). */
export function programDownloads(code) {
  const all = downloads(code);
  if (REACHES_ANY.test(code)) return all;
  const lines = String(code).split(/\r?\n/u).map((l) => l.trim());
  return all.filter((d) => !readsData(d, all, lines));
}

function readsData(d, all, lines) {
  const name = READ.exec(d)?.[1];
  if (!name || all.filter((x) => x === d).length !== 1 || lines.filter((l) => l === d).length !== 1) return false;
  const named = new RegExp(`(?<!\\w)${name}(?!\\w)`, "u");
  return lines.every((line) => line === d || !named.test(line) || (all.includes(line) && !READ.test(line) && onlyInAddresses(line, name, named)));
}

// Whether every mention of `name` on `line` is `$name` or `${name}` inside a double-quoted https address that holds no
// other expansion, quote, backtick, backslash or space.
function onlyInAddresses(line, name, named) {
  const use = `\\$(?:${name}|\\{${name}\\})(?!\\w)`;
  const address = new RegExp(`"https://(?:[^"$\`\\\\\\s]|${use})*"`, "gu");
  return !named.test(line.replace(address, ""));
}
