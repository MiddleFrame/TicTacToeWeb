export function elements(root, predicate) {
  const found = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object" || !node.props) return;
    if (predicate(node)) found.push(node);
    visit(node.props.children);
  }
  visit(root);
  return found;
}

export function element(root, predicate) {
  const found = elements(root, predicate);
  if (found.length !== 1) throw new Error(`Expected one element, found ${found.length}`);
  return found[0];
}
