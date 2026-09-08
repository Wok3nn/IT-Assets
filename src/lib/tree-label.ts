type TreeItem = { id: string; name: string; parentId: string | null };

export function buildTreeLabel(items: TreeItem[], itemId: string | null | undefined) {
  if (!itemId) return null;
  const byId = new Map(items.map((item) => [item.id, item]));
  const labels: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(itemId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    labels.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return labels.join(" / ");
}
