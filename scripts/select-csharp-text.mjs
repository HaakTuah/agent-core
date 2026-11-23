// Whether a file of C# holds code the parser's tokens leave out (csharp-tree.mjs), for the test selection
// (select-csharp.mjs; #675): a raw interpolated string's holes, or an interpolation's alignment ("{x,App.Width}", whose
// constant sets the padding). Read from the text, so a comment's counts too: it reads more, never less. Linear in the
// text: each character is read once.

const RAW = /\$"""/u; // (one "$", not a run of them)
const STARTS = /\$@?"|@\$"/gu;

export function leftOut(src) {
  if (RAW.test(src)) return true;
  for (let m; (m = STARTS.exec(src));) {
    const end = aligns(src, m.index + m[0].length, m[0].includes("@"));
    if (end < 0) { STARTS.lastIndex = 0; return true; }
    STARTS.lastIndex = Math.max(end, m.index + 1);
  }
  return false;
}

// From past an interpolated string's opening quote: -1 where a hole's alignment (past a "," outside its own brackets; a
// generic's "<A, B>" too, which reads more) holds a word, or a hole holds an interpolated or verbatim string of its own,
// else the index past the string. A plain string or a character in a hole is passed over; "{x,-10}" names nothing.
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
  else if (c === "{") Object.assign(s, { nest: 0, align: false });
  return i;
}

// In a hole at i: the same, s.end -1 where it holds what the tokens leave out.
function inHole(src, i, s) {
  const c = src[i];
  if ((s.align && /[\p{L}_]/u.test(c)) || c === "$" || c === "@") s.end = -1;
  else if (c === "\"" || c === "'") return closing(src, i + 1, c);
  else if (c === ":" && src[i + 1] === ":") return i + 1;
  else if (c === ":" && s.nest === 0) { const j = src.indexOf("}", i); return (j < 0 ? src.length : j) - 1; } // (a format's text: no code)
  else if ("([{".includes(c)) s.nest++;
  else if (")]}".includes(c)) s.nest--; // (the "}" that closes the hole back to -1)
  else if (c === "," && s.nest === 0) s.align = true;
  return i;
}

// The index of the quote that closes a plain string or a character whose text begins at i (or the line's end).
function closing(src, i, quote) {
  for (; i < src.length && src[i] !== quote && src[i] !== "\n"; i++) if (src[i] === "\\") i++;
  return i;
}
