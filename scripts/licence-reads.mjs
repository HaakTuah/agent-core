// Which downloads of a file fetch a program, and which read data alone (#1361, point 11), for the licence scan's check
// that a program a file downloads is pinned by version and checksum (licence-scan.mjs's pinFault). A read of a version
// index asks no checksum; anything a later line may run does. Node's own modules alone, and the fetchers' reader.
import { downloads } from "./licence-fetchers.mjs";

// A file no program is written in, by the end of the address's path: JSON, XML, YAML, TOML and plain text, the forms
// a version index is read in; a pipe into a shell or another interpreter, which runs what it is given; a download kept
// in a file, which a later line may run (curl's -o, -O and --output, wget's file but for "-O -", -OutFile, BITS, a
// redirect or tee); and text run as code at run time, which may be what a read printed (eval, Invoke-Expression).
const DATA_FILE = /\.(?:json|xml|ya?ml|toml|txt)$/iu;
const RUNS_IT = /\|\s*(?:sudo\s+)?(?:(?:ba|z|da|k|fi)?sh|iex|Invoke-Expression|pwsh|powershell|node|deno|bun|python[\d.]*|perl|ruby|php|xargs|eval|source|\.)(?![\w-])/iu;
function kept(line) {
  const words = line.split(/\s+/u), wget = /(?<![\w-])wget(?![\w-])/iu.test(line);
  const value = (w, i) => (w.includes("=") ? w.slice(w.indexOf("=") + 1) : words[i + 1]);
  // (curl's -o, -O and --output, wget's -O and --output-document, each but to "-", the download's own output)
  const toFile = words.some((w, i) => (/^-[A-Za-z]*o$/u.test(w) && words[i + 1] !== "-")
    || (/^-[A-Za-z]*O$/u.test(w) && (!wget || words[i + 1] !== "-"))
    || (/^--(?:output|output-document)(?:=|$)/u.test(w) && value(w, i) !== "-")
    || /^(?:--remote-name(?:-all)?|-OutFile(?::\S*)?)$/iu.test(w));
  if (toFile || /Start-BitsTransfer|aria2c|(?<![\d&>])>>?(?!\s*&|\s*\/dev\/null)|\|\s*tee(?![\w-])/iu.test(line)) return true;
  // (wget keeps what it fetches in a file but where -O -, -qO- or --output-document=- sends it to its output)
  return wget && !words.some((w, i) => /^-[A-Za-z]*O-$/u.test(w) || (/^-[A-Za-z]*O$/u.test(w) && words[i + 1] === "-")
    || (/^--output-document(?:=|$)/u.test(w) && value(w, i) === "-"));
}
const RUNS_TEXT = /(?<![\w-])(?:eval|Invoke-Expression|iex)(?![\w-])|(?<![\w-])(?:ba|z|da|k)?sh\s+-c\s+["']?\$|(?<![\w-])source\s+<\(/iu;
/** Whether the download `line`, one of `all` (downloads), reads data and no program (#1361, point 11): every address it
 *  names literally ends in a file of DATA_FILE, it names one at least, it pipes into nothing that runs it (RUNS_IT), it
 *  keeps nothing in a file (kept), and no other download of `all` stands in the same words, as a second
 *  download on the same line would. */
export function readsData(line, all = [line]) {
  const addresses = [...line.matchAll(/https?:\/\/[^\s"'`<>|;&()\\]+/giu)].map((m) => m[0].replace(/[?#].*$/su, ""));
  return addresses.length > 0 && addresses.every((a) => DATA_FILE.test(a)) && !RUNS_IT.test(line) && !kept(line)
    && all.filter((d) => d === line).length === 1;
}
// The downloads of `code` that may fetch a program: all but those that read data (readsData), and all of them in a file
// that runs text as code (RUNS_TEXT), which may run what a read printed.
export const programDownloads = (code) => { const all = downloads(code); return RUNS_TEXT.test(code) ? all : all.filter((d) => !readsData(d, all)); };
