export function validateSnippets(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('請至少保留一句短句。');
  return items.map(item => {
    const name = String(item.name ?? '').trim();
    const text = String(item.text ?? '').trim();
    if (!name || !text) throw new Error('每句短句都需要名稱與內容。');
    if (name.length > 100 || text.length > 20000) throw new Error('名稱最多 100 字，內容最多 20,000 字。');
    return { name, text };
  });
}

export function parseSnippetImport(input) {
  const json = input.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
  const items = JSON.parse(json);
  if (!Array.isArray(items) || items.length > 100) throw new Error('請提供 1～100 筆短句的 JSON 陣列。');
  return validateSnippets(items);
}

export function isEmptyDraft(item) {
  return ['新短句', 'New snippet', '新しい短文'].includes(String(item.name ?? '').trim()) && !String(item.text ?? '').trim();
}

export function reorderSnippets(items, from, to, selected) {
  if (![from, to, selected].every(i => Number.isInteger(i) && i >= 0 && i < items.length)) {
    return { items, selected };
  }
  const current = items[selected];
  const ordered = [...items];
  ordered.splice(to, 0, ordered.splice(from, 1)[0]);
  return { items: ordered, selected: ordered.indexOf(current) };
}

// Keep untouched drafts in the editor, but never persist or paste empty text.
export function prepareSnippetSave(items) {
  const saved = validateSnippets(items.filter(item => !isEmptyDraft(item)));
  let index = 0;
  return {
    saved,
    editorItems: items.map(item => isEmptyDraft(item) ? item : saved[index++]),
    draftCount: items.filter(isEmptyDraft).length,
  };
}
