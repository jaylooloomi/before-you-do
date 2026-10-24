// Normalize only lookup text. Snippets and scenario metadata are never modified.
const lookup = value => String(value ?? '').normalize('NFKC').toLowerCase();
export function matchesSnippetQuery(item, query, scenario = item.scenario ?? '') {
  const terms = lookup(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [item.name, item.text, scenario].map(lookup).join('\n');
  return terms.every(term => haystack.includes(term));
}
