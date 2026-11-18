// A key given twice in one mapping of a YAML file, which GitHub's workflow reader refuses, running none of the file's
// jobs (#393). The workflow check (workflows.mjs, beside this file) fails each with its line. It reads the file with the
// YAML package the core carries (third-party/yaml, as third-party.mjs says; #528), every document of it, each mapping,
// block or flow, and throws nothing, its errors read plainly so that a text full of them is read in linear time. A key
// is read as YAML spells it and GitHub reads it, as text: quoted or plain, with its escapes, so "if" and if are one
// key, and so are 1 and "1" (the failsafe schema, which reads every scalar as text). A key that is no scalar (a mapping
// or a list) or an alias is passed over, and each line break, \r\n, \r or \n, is one, as GitHub reads it. What it
// does not read: a list or mapping nested more than DEEPEST deep, far past what a workflow holds, which it reads as an
// empty value, the rest of the text read still, since Node stops by itself where the package builds one some 800 deep
// (#610); and text that is no YAML past where the package can read it, which GitHub refuses all the same.
import { Composer, LineCounter, Parser, isScalar, visit } from "../third-party/yaml/dist/index.js";

export const DEEPEST = 128;

// A text's tokens with each list or mapping nested past DEEPEST, a document counted as one, made an empty value, read
// without recursion so that a text nested past any stack is read; the offsets of those made so, which hold no key.
function pruned(tokens) {
  const nests = new Set(["document", "block-map", "block-seq", "flow-collection"]), cut = new Set(), todo = [[tokens, 0]];
  while (todo.length) {
    const [holder, depth] = todo.pop();
    for (const part of Array.isArray(holder) ? holder.keys() : ["start", "key", "sep", "value", "items", "end"]) {
      const token = holder[part];
      if (!token || typeof token !== "object") continue;
      const own = nests.has(token.type) ? depth + 1 : depth;
      if (own > DEEPEST) { holder[part] = { type: "scalar", offset: token.offset, indent: token.indent, source: "" }; cut.add(token.offset); }
      else todo.push([token, own]);
    }
  }
  return cut;
}

// A line without its comment (" #" outside quotes, or "#" at its start).
export function uncommented(line) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote && quote === "'" && line[i + 1] === "'") i++; else if (c === quote) quote = ""; else if (c === "\\" && quote === '"') i++; }
    else if (c === "#" && (i === 0 || /\s/u.test(line[i - 1]))) return line.slice(0, i).trimEnd();
    else if ((c === '"' || c === "'") && (i === 0 || /[\s:[{,-]/u.test(line[i - 1]))) quote = c;
  }
  return line.trimEnd();
}

// The keys given twice in one mapping of a YAML text, each as { line, key, first }: the line of the second, the key as
// YAML reads it and the line of the first, numbered from 1, in the order of the seconds in the text.
export function twice(text) {
  const found = [], lines = new LineCounter();
  try {
    const tokens = Array.from(new Parser(lines.addNewLine).parse(String(text).replace(/^\ufeff/u, "").replace(/\r\n?/gu, "\n")));
    const cut = pruned(tokens);
    for (const doc of new Composer({ schema: "failsafe", uniqueKeys: false }).compose(tokens)) visit(doc, { Map(_, map) {
      const seen = new Map();
      for (const { key } of map.items) {
        if (!isScalar(key) || !key.range || cut.has(key.range[0])) continue;
        const name = String(key.value), at = key.range[0];
        if (seen.has(name)) found.push({ at, line: lines.linePos(at).line, key: name, first: lines.linePos(seen.get(name)).line });
        else seen.set(name, at);
      }
    } });
  } catch { return []; } // (a text that runs the package out of its stack: read as holding none)
  return found.sort((a, b) => a.at - b.at).map(({ line, key, first }) => ({ line, key, first }));
}
