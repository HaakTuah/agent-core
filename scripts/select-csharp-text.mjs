// Whether a file of C# holds code the parser's tokens leave out (csharp-tree.mjs), for the test selection
// (select-csharp.mjs; #675): a raw interpolated string's holes, an interpolation's alignment ("{x,App.Width}", whose
// constant sets the padding), or a name written with an escape ("R\u0075les") or a formatting character (U+200C), which
// the tokens split. 2 where the file may hide a name it declares: such a name in code, or anywhere once the scan cannot
// keep in step, or a comment or string across an "#if"'s line, or such a line anywhere once it cannot, or an odd line
// end anywhere (LINE); else 1 (0 where none). Read in one pass from the file's start, passing over comments, strings,
// characters and directives as the lexer does, so a "$\"" in one opens nothing; a raw interpolated string's "$\"\"\""
// counts anywhere (ODD), and a comment in a hole, or one across another directive, makes it unsure: it reads more.
// Linear in the text: each character is read once.

// (a raw interpolated string's "$\"\"\"", one "$" of a run; a line's end other than "\n", "\r\n" (LINE): "\r", U+0085,
// U+2028 or U+2029, which the scan and the tree read as no end, so a "//" comment it ends may hide a declaration)
const ODD = /\$"""/u, LINE = /\r(?!\n)|[\u0085\u2028\u2029]/u;
const AT = /\/\/|\/\*|\$@?"|@\$"|@"|"{3,}|["'#]/uy; // (what begins at a place in code that the scan passes over)

export function leftOut(text) {
  const src = text.replace(/^\uFEFF/u, ""); // (a byte order mark, the one formatting character a file may begin with)
  let found = LINE.test(src) ? 2 : ODD.test(src) ? 1 : 0;
  for (let i = 0; !found && i < src.length; i++) {
    i = step(src, i);
    if (i < 0) found = -i;
  }
  return found === 1 && SPLIT.test(src) ? 2 : found; // (out of step, what may hide a name is sought anywhere: it reads more)
}

// (a name's escape, "\u" or "\U", the only escape C# code holds, or a formatting character, in a string or not; or an
// "#if", "#elif", "#else" or "#endif" line, where a comment or string one branch opens may hide a declaration)
const SPLIT = /\\[uU]|\p{Cf}|(?<![^\n\r\u0085\u2028\u2029])[\t\v\f\x1A\p{Zs}]*#[\t\v\f\x1A\p{Zs}]*(?:if|elif|else|endif)\b/u;
// (a line begins past any of C#'s line ends; C#'s spaces, as step reads them, hold none, so no two tries share one:
// linear; U+FEFF, a space there too, is a formatting character)

// Whether a name's escape or a formatting character stands at i (in code a "\" begins nothing else).
const named = (src, i) => src[i] === "\\" || /^\p{Cf}/u.test(src.slice(i, i + 2));

// In code at i: the index of the last character of what begins there (past), or -1 or -2 where it holds what the tokens
// leave out, or where it runs across a directive's line: -2 across an "#if", "#elif", "#else" or "#endif", since a comment
// or string one branch opens may hide a declaration from the tokens, else -1.
function step(src, i) {
  const end = past(src, i), span = end > i ? src.slice(i, end) : ""; // (the spans do not overlap: linear)
  return /\n[\t\v\f\r\x1A\uFEFF\p{Zs}]*#[\t\v\f\x1A\uFEFF\p{Zs}]*(?:if|elif|else|endif)\b/u.test(span) ? -2 : /\n[\t\v\f\r\x1A\uFEFF\p{Zs}]*#/u.test(span) ? -1 : end;
}
// (C#'s spaces: a tab, U+000B, U+000C, U+001A, U+FEFF and each of Zs; a "\r" too, which reads more)

// In code at i: the index of the last character of what begins there (a comment, a directive, a string or a character;
// i itself where none does), or -1 where an interpolated string there holds what the tokens leave out, -2 where a name's
// escape or a formatting character stands.
function past(src, i) {
  if (named(src, i)) return -2;
  AT.lastIndex = i;
  const m = AT.exec(src)?.[0];
  if (!m) return i;
  const j = i + m.length;
  if (m === "//" || m === "#") return to(src, "\n", j);
  if (m === "/*") return to(src, "*/", j);
  if (m.includes("$")) { const end = aligns(src, j, m.includes("@")); return end < 0 ? -1 : end - 1; }
  if (m === "@\"") return verbatim(src, j);
  return m.length > 2 ? raw(src, j, m.length) : closing(src, j, m);
}

// The index of the last quote of the run of n that closes a raw string whose text begins at i, counted as it goes, never
// searched for (a needle of n quotes is read again at each place).
function raw(src, i, n) {
  for (let run = 0; i < src.length; i++) if ((run = src[i] === "\"" ? run + 1 : 0) === n) return i;
  return src.length;
}

// The index of the last character of the first `end` at or past i (or the text's end).
function to(src, end, i) {
  const k = src.indexOf(end, i);
  return k < 0 ? src.length : k + end.length - 1;
}

// The index of the quote that closes a verbatim string whose text begins at i ("" is a quote in it).
function verbatim(src, i) {
  for (; i < src.length; i++) if (src[i] === "\"" && src[++i] !== "\"") return i - 1;
  return src.length;
}

// From past an interpolated string's opening quote: -1 where a hole's alignment (past a "," outside its own brackets; a
// generic's "<A, B>" too, which reads more) holds a word, or a hole holds an interpolated or verbatim string of its own
// or a comment, else the index past the string. A plain string or a character in a hole is passed over; "{x,-10}" names
// nothing.
function aligns(src, i, verbatim) {
  const s = { nest: -1, align: false, end: null }; // (nest: -1 in the string's text, else the brackets open in a hole)
  for (; i < src.length && s.end === null; i++) i = s.nest < 0 ? inText(src, i, verbatim, s) : inHole(src, i, s);
  return s.end ?? src.length;
}

// In the string's text at i: the index of the last character read; s.end past the closing quote, s.nest 0 at a hole.
function inText(src, i, verbatim, s) {
  const c = src[i];
  if ((c === "\\" && !verbatim) || (c === "{" && src[i + 1] === "{") || (c === "\"" && verbatim && src[i + 1] === "\"")) return i + 1;
  if (c === "\"" || (c === "\n" && !verbatim)) s.end = i + 1;
  else if (c === "{") Object.assign(s, { nest: 0, align: false, braced: src[i - 1] === "{" }); // (braced: after "{{", an escaped brace)
  return i;
}

// In a hole at i: the same, s.end -1 where it holds what the tokens leave out.
function inHole(src, i, s) {
  const c = src[i];
  if (hides(src, i, s)) s.end = -1;
  else if (c === "\"" || c === "'") return closing(src, i + 1, c);
  else if (c === ":" && src[i + 1] === ":") return i + 1;
  else if (c === ":" && s.nest === 0) { const j = src.indexOf("}", i); return (j < 0 ? src.length : j) - 1; } // (a format's text: no code)
  else if ("([{".includes(c)) s.nest++;
  else if (")]}".includes(c)) s.nest--; // (the "}" that closes the hole back to -1)
  else if (c === "," && s.nest === 0) s.align = true;
  return i;
}

// Whether what stands at i in a hole is what the tokens leave out: a word in an alignment (a letter, a letter-number
// such as "Ⅻ" or "_" may begin one), a name's escape "\u0041" or a formatting character, an interpolated, verbatim or raw string's start, a
// character or string in a hole after "{{" (whose text the tokens' recovery of "{{{" may count as code: "+", ")"), or
// a comment, which may hide where the hole ends.
function hides(src, i, s) {
  const c = src[i];
  return (s.align && /[\p{L}\p{Nl}_]/u.test(c)) || (s.braced && (c === "'" || c === "\"")) || named(src, i) || c === "$" || c === "@" || src.startsWith("\"\"\"", i) || (c === "/" && /[/*]/u.test(src[i + 1] ?? ""));
}

// The index of the quote that closes a plain string or a character whose text begins at i (or the line's end).
function closing(src, i, quote) {
  for (; i < src.length && src[i] !== quote && src[i] !== "\n"; i++) if (src[i] === "\\") i++;
  return i;
}
