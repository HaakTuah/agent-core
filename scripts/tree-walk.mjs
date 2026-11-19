// The walk over a parsed file's tree that the shape check's readers on the parser share (csharp-functions.mjs and
// javascript-functions.mjs, beside this file): each function found with its name, its body's line and lines, the
// depth its control blocks reach and its branch points, by the reader's own parts. Node's own modules only: none.

/** The functions under `root`, in the order their bodies open, as a baseline numbers functions of one name. `parts`
 *  are the reader's: `functionBody(node)`, the body of a node that is a function, else null; `nameOf(node, parent)`;
 *  `branches(node)`, the branch points a node adds; and `isControl(node, parent)`, whether it opens a control block.
 *  The walk keeps a stack of its own so that no nesting runs out of the call stack: each item a node, its parent, the
 *  function it counts toward (null outside any) and the level of control blocks it stands at. (The parent is carried,
 *  not asked of the node: the parser finds it from the file's root, at a cost that grows with how deep it lies.) */
export function walkFunctions(root, { functionBody, nameOf, branches, isControl }) {
  const found = [], stack = [{ node: root, parent: null, fn: null, level: 0 }];
  while (stack.length) {
    const { node, parent, fn, level } = stack.pop();
    const body = functionBody(node);
    if (body) {
      const own = { name: nameOf(node, parent), line: body.startPosition.row + 1, lines: body.endPosition.row - body.startPosition.row + 1, depth: 0, branches: 0 };
      found.push([body.startIndex, own]);
      // (what stands outside its body, a parameter's default or a lambda passed to C#'s : base(...), counts where the
      // function itself stands, as the lexer read it)
      for (const c of [...node.children].reverse()) push(stack, c.id === body.id ? null : c, node, fn, level);
      push(stack, body, node, own, 0);
      continue;
    }
    if (fn) fn.branches += branches(node);
    const inner = isControl(node, parent) ? level + 1 : level;
    if (fn && inner > level) fn.depth = Math.max(fn.depth, inner);
    // (all of a node's children at once: one by one, each costs as many steps as the children before it)
    const children = node.children;
    for (let k = children.length - 1; k >= 0; k--) push(stack, children[k], node, fn, inner);
  }
  // (a lambda passed to C#'s : base(...) opens before its constructor's body)
  return found.sort((a, b) => a[0] - b[0]).map(([, fn]) => fn);
}
const push = (stack, node, parent, fn, level) => { if (node) stack.push({ node, parent, fn, level }); };
