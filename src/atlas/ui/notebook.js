export const NOTEBOOK_KEY = 'skyforge.bk.notebooks';
export function readNotebooks(storage) {
  try {
    const raw = storage.getItem(NOTEBOOK_KEY);
    const entries = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(entries) || entries.some(n => !n || !Number.isSafeInteger(n.id) || typeof n.date !== 'string' || !Number.isFinite(Date.parse(n.date)) || !['note','query','material'].every(k => typeof n[k] === 'string') || !['microgravity','lunar','martian'].includes(n.gravity) || !Array.isArray(n.selected) || n.selected.length > 3 || n.selected.some(k => typeof k !== 'string'))) throw new Error('NOTEBOOK_DATA_INVALID');
    return {ok:true, entries};
  } catch(error) {return {ok:false, entries:[], error:error.message};}
}
