// A saved baseline must never share editable objects, including across cached roles.
export function savedSnapshot(items, exists) {
  return { items: structuredClone(items), exists: Boolean(exists) };
}
