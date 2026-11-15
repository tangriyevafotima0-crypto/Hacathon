import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const failure = (status, code) => Object.assign(new Error(code), { status });
const kinds = new Set(['note','share','chat','memory','shelf','analysis','run','pin','turn','import','asset','cache','summary','shelf_revision']);

export function openWorkspace(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS ws_sessions(token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ws_records(
      owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL, PRIMARY KEY(owner,kind,id));
    CREATE TABLE IF NOT EXISTS ws_budget(
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, day TEXT NOT NULL,
      reserved INTEGER NOT NULL, spent INTEGER, created TEXT NOT NULL);
  `);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); db.exec('COMMIT');return result; }
    catch(error){db.exec('ROLLBACK');throw error;}
  }
  function decode(row) {
    return row && {id:row.id,version:row.version,updated:row.updated,...JSON.parse(row.data)};
  }
  function get(owner,kind,id) {
    return decode(db.prepare('SELECT * FROM ws_records WHERE owner=? AND kind=? AND id=?').get(owner,kind,id));
  }
  function list(owner,kind) {
    return db.prepare('SELECT * FROM ws_records WHERE owner=? AND kind=? ORDER BY updated DESC,id').all(owner,kind).map(decode);
  }
  function save(owner,kind,data,{id=randomUUID(),version}={}) {
    if(!kinds.has(kind))throw failure(400,'INVALID_KIND');
    const time=new Date().toISOString(), payload=JSON.stringify(data);
    if(version===undefined){
      const result=db.prepare('INSERT OR IGNORE INTO ws_records(owner,kind,id,data,updated) VALUES(?,?,?,?,?)')
        .run(owner,kind,id,payload,time);
      if(!result.changes)throw failure(409,'DUPLICATE');
    }else{
      const result=db.prepare('UPDATE ws_records SET data=?,updated=?,version=version+1 WHERE owner=? AND kind=? AND id=? AND version=?')
        .run(payload,time,owner,kind,id,version);
      if(!result.changes)throw failure(409,'STALE_VERSION');
    }
    return get(owner,kind,id);
  }
  function remove(owner,kind,id){
    db.prepare('DELETE FROM ws_records WHERE owner=? AND kind=? AND id=?').run(owner,kind,id);
  }
  function identity(req) {
    const token=(req.headers.cookie||'').match(/(?:^|;\s*)skyforge_session=([0-9a-f]{64})(?:;|$)/)?.[1];
    if(!token)return null;
    return db.prepare('SELECT owner FROM ws_sessions WHERE token_hash=? AND expires>?').get(digest(token),Date.now())?.owner??null;
  }
  function session(secure) {
    const token=randomBytes(32).toString('hex'), owner=randomUUID(), seconds=30*86400;
    db.prepare('INSERT INTO ws_sessions VALUES(?,?,?)').run(digest(token),owner,Date.now()+seconds*1000);
    return {owner,cookie:`skyforge_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secure?'; Secure':''}`};
  }
  function reserve(owner,amount,limit) {
    return transaction(()=>{
      const time=new Date().toISOString(), day=time.slice(0,10);
      const {used}=db.prepare('SELECT COALESCE(SUM(COALESCE(spent,reserved)),0) AS used FROM ws_budget WHERE day=?').get(day);
      if(used+amount>limit)throw failure(429,'BUDGET_LIMIT');
      const id=randomUUID();
      db.prepare('INSERT INTO ws_budget VALUES(?,?,?,?,NULL,?)').run(id,owner,day,amount,time);
      return id;
    });
  }
  return {get,list,save,remove,transaction,identity,session,reserve,
    recoverInterrupted(){
      db.prepare("UPDATE ws_records SET data=json_set(data,'$.state','INTERRUPTED','$.error','WORKER_RESTARTED'),version=version+1 WHERE kind='turn' AND json_extract(data,'$.state')='RUNNING'").run();
      db.prepare("UPDATE ws_records SET data=json_set(data,'$.state','QUEUED'),version=version+1 WHERE kind='asset' AND json_extract(data,'$.state')='RUNNING'").run();
    },
    pendingAssetOwners(){return db.prepare("SELECT DISTINCT owner FROM ws_records WHERE kind='asset' AND json_extract(data,'$.state')='QUEUED'").all().map(row=>row.owner);},
    shelfOwners(){return db.prepare("SELECT DISTINCT owner FROM ws_records WHERE kind='shelf'").all().map(row=>row.owner);},
    settle(id,spent){db.prepare('UPDATE ws_budget SET spent=? WHERE id=? AND spent IS NULL').run(spent,id);},
    close(){db.close();}};
}
