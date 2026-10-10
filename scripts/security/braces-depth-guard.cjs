'use strict';

// Local mitigation for GHSA-vfj7-8cjw-p6xm; not an upstream release.
// Parser and direct AST entry points share one non-configurable bound.
const MAX_DEPTH = 128;
const MAX_NODES = 20000;

function fail() {
  const error = new SyntaxError('Brace pattern exceeds the safe nesting or node limit');
  error.code = 'LISTORD_BRACES_LIMIT';
  throw error;
}

function assertStackDepth(length) {
  if (length >= MAX_DEPTH) fail();
}

function assertAstDepth(ast) {
  const pending = [{ node: ast, depth: 0 }];
  const seen = new Set();
  let count = 0;
  // Iterative validation must finish before entering any recursive walker.
  // Traverse `nodes`; validate `parent` backlinks without treating them as
  // children. expand() follows these links and can otherwise loop forever.
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node) || ++count > MAX_NODES) fail();
    seen.add(node);
    let parent = node.parent;
    let parentDepth = 0;
    const parents = new Set([node]);
    while (parent !== undefined && parent !== null) {
      if (typeof parent !== 'object' || parents.has(parent) || ++parentDepth > MAX_DEPTH) fail();
      parents.add(parent);
      parent = parent.parent;
    }
    if (node.nodes !== undefined) {
      if (!Array.isArray(node.nodes) || node.nodes.length + count + pending.length > MAX_NODES) fail();
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
  }
}

module.exports = { assertStackDepth, assertAstDepth };
