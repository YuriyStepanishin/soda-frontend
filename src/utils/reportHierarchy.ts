export type HierarchySource = {
  id: string;
  label: string;
  level?: number;
  dimensions?: Record<string, string | null>;
};
export type HierarchyNode<T> = T & { treeId: string; subRows: HierarchyNode<T>[] };

// Use the full dimension prefix; identical names under different parents stay separate.
export function buildReportTree<T extends HierarchySource>(rows: T[], fields: string[]): HierarchyNode<T>[] {
  const identity = (row: T, depth: number) => JSON.stringify(
    fields.slice(0, depth + 1).map(field => [field, row.dimensions?.[field] ?? null])
  );
  const nodes = rows.map((row, index) => ({
    ...row,
    treeId: fields.length && row.dimensions && Object.keys(row.dimensions).length
      ? identity(row, row.level ?? 0) : JSON.stringify(['row', index, row.id]),
    subRows: [] as HierarchyNode<T>[],
  }));
  const byId = new Map(nodes.map(node => [node.treeId, node]));
  const roots: HierarchyNode<T>[] = [];
  for (const node of nodes) {
    const level = node.level ?? 0;
    const parent = level > 0 ? byId.get(identity(node, level - 1)) : undefined;
    if (parent && parent !== node) parent.subRows.push(node);
    else roots.push(node);
  }
  return roots;
}

export function reorderVisibleParameters(order: string[], reordered: string[]): string[] {
  if (new Set(reordered).size !== reordered.length || reordered.some(field => !order.includes(field))) return order;
  const visible = new Set(reordered);
  let index = 0;
  return order.map(field => visible.has(field) ? reordered[index++] : field);
}
