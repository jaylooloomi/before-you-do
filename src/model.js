import { characterCount } from './unicode.js';
export function validateSnippets(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('請至少保留一句短句。');
  return items.map(item => {
    const name = String(item.name ?? '').trim();
    const text = String(item.text ?? '').trim();
    if (!name || !text) throw new Error('每句短句都需要名稱與內容。');
    if (characterCount(name) > 100 || characterCount(text) > 20000) throw new Error('名稱最多 100 字，內容最多 20,000 字。');
    const result={name,text};
    if(item.custom===true)result.custom=true;
    if(Object.hasOwn(item,'scenario')){
      if(typeof item.scenario!=='string'||characterCount(item.scenario)>1000)throw new Error('情境最多 1,000 字，且必須是文字。');
      result.scenario=item.scenario.trim();
    }
    return result;
  });
}

export function parseSnippetImport(input) {
  const json = input.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
  const items = JSON.parse(json);
  if (!Array.isArray(items) || items.length > 100) throw new Error('請提供 1～100 筆短句的 JSON 陣列。');
  items.forEach(validateImportEntry);
  return validateSnippets(items);
}

// Import is deliberately stricter than editor normalization: JSON types must be explicit.
function validateImportEntry(item, offset) {
  const fail = (field, reason, limit) => {
    const error = new Error('error.import_entry');
    error.code = 'error.import_entry';
    error.params = { index: offset + 1, field, reason, limit };
    throw error;
  };
  if (!item || typeof item !== 'object' || Array.isArray(item)) fail('item', 'error.import_object');
  for (const [field, limit] of [['name', 100], ['text', 20000], ['scenario', 1000]]) {
    if (field === 'scenario' && !Object.hasOwn(item, field)) continue;
    if (typeof item[field] !== 'string') fail(field, 'error.import_string');
    if (field !== 'scenario' && !item[field].trim()) fail(field, 'error.import_required');
    if (characterCount(item[field]) > limit) fail(field, 'error.import_length', limit);
  }
}

export function isEmptyDraft(item) {
  return ['新短句', 'New snippet', '新しい短文'].includes(String(item.name ?? '').trim()) && !String(item.text ?? '').trim() && !String(item.scenario ?? '').trim();
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

// Incomplete edits remain in memory; an existing saved version is never removed by them.
export function snippetIssues(item) {
  const fields=[];
  for(const [field,limit] of [['name',100],['text',20000]]) {
    if(!String(item[field]??'').trim()) fields.push({field,reason:'required'});
    else if(characterCount(item[field])>limit) fields.push({field,reason:'length',limit});
  }
  if(Object.hasOwn(item,'scenario')&&(typeof item.scenario!=='string'||characterCount(item.scenario)>1000)) fields.push({field:'scenario',reason:'length',limit:1000});
  return fields;
}
export function savedVersions(items) {
  return new Map(items.map(item=>[item,structuredClone(item)]));
}
export function prepareSnippetSave(items, previous=new Map()) {
  const saved=[],editorItems=[],versions=new Map(),issues=[];
  items.forEach((item,index)=>{
    const fields=snippetIssues(item),prior=previous.get(item);
    if(fields.length){
      issues.push({index,name:item.name,fields,retained:!!prior});editorItems.push(item);
      if(prior){saved.push(prior);versions.set(item,prior);}
    }else{
      const normalized=validateSnippets([item])[0];saved.push(normalized);editorItems.push(normalized);versions.set(normalized,structuredClone(normalized));
    }
  });
  if(!saved.length){const error=new Error('沒有可儲存的完整短句；草稿已保留，請補齊標示欄位。');error.issues=issues;throw error;}
  if(saved.length>100)throw new Error('最多 100 句。');
  return {saved,editorItems,versions,issues,draftCount:issues.length};
}

// Export saved data as-is; validation must not trim or otherwise rewrite the payload.
export function serializeSnippetExport(items) {
  const json = JSON.stringify(items, null, 2);
  parseSnippetImport(json);
  return json;
}
