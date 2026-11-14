import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import studies from './pitch-studies.json' with { type: 'json' };

const NASA = 'https://psi.nasa.gov/geode-py/ws';
const LIMIT = 20_000_000_000;
export const studyUrl = id => 'https://psi.nasa.gov/physci/repo/data/investigations/' + id;
export const sha = text => createHash('sha256').update(text).digest('hex');

async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: 'error' });
  if (!response.ok) throw new Error('NASA_HTTP_' + response.status);
  return response;
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest('hex');
}

export async function preparePitch(root) {
  const items = await Promise.all(studies.map(async study => {
    const metadata = await (await request(NASA + '/repo/investigations/' + study.id)).text();
    const record = JSON.parse(metadata);
    if (record.version !== study.version || record.doi !== study.doi || record.totalFileSize !== study.totalBytes) {
      throw new Error('NASA_STUDY_CHANGED:' + study.id);
    }
    const files = [...record.experimentalTable ?? [], ...record.images ?? []]
      .filter(f => f.visible === true && f.restricted === false && /^[0-9a-f]{24}$/.test(f._id?.$oid)
        && f.file_name === basename(f.file_name) && !/[\\/:*?"<>|]/.test(f.file_name)
        && Number.isSafeInteger(f.file_size) && f.file_size > 0 && f.file_size <= 5_000_000)
      .map(f => ({ id:f._id.$oid, name:f.file_name, bytes:f.file_size, version:f.version }));
    return { study, metadata, title:record.title, files };
  }));
  const total = items.reduce((sum,item) => sum + item.study.totalBytes, 0);
  if (total > LIMIT) throw new Error('PITCH_SIZE_LIMIT');
  await mkdir(root, {recursive:true});
  const plan = items.map(({study,title,files}) => ({...study,title,scope:'SELECTED_FILES',files}));
  await writeFile(join(root,'plan.json'),JSON.stringify({catalogBytes:total,studies:plan},null,2));
  for (const item of items) {
    const { study, metadata, files, title } = item;
    const dir = join(root, study.id);
    await mkdir(dir, {recursive:true});
    const manifestPath = join(dir,'manifest.json');
    const previous = await readFile(manifestPath,'utf8').then(JSON.parse).catch(()=>null);
    const manifest = { ...study, title, scope:'SELECTED_FILES', sourceUrl:studyUrl(study.id), files:[] };
    await writeFile(join(dir,'study.metadata.json'),metadata);
    for (const file of files) {
      const entry = { ...file, status:'FAILED', sha256:null, nasaChecksum:null };
      manifest.files.push(entry);
      const path = join(dir,file.name);
      try {
        const old = previous?.files.find(f=>f.id===file.id && f.version===file.version && f.status==='VERIFIED');
        const size = await stat(path).then(s=>s.size).catch(()=>null);
        if (size === file.bytes && old?.sha256 && await hashFile(path) === old.sha256) {
          entry.sha256=old.sha256;
        } else {
          const params = new URLSearchParams({file:file.id,version:file.version,studyVersion:study.version,redirect:'false'});
          const url = new URL((await (await request(`${NASA}/studies/${study.id}/download?${params}`)).text()).trim().replace(/^"|"$/g,''));
          if (url.protocol !== 'https:' || !url.hostname.endsWith('.amazonaws.com')) throw new Error('NASA_DOWNLOAD_HOST');
          const response = await request(url);
          if (Number(response.headers.get('content-length')) !== file.bytes) throw new Error('NASA_CONTENT_LENGTH');
          await pipeline(Readable.fromWeb(response.body),createWriteStream(path+'.part'));
          if ((await stat(path+'.part')).size !== file.bytes) throw new Error('NASA_SIZE_MISMATCH');
          entry.sha256=await hashFile(path+'.part');
          await rename(path+'.part',path);
        }
        entry.status='VERIFIED';
      } catch (error) { entry.error=error.message; }
    }
    await writeFile(manifestPath+'.tmp',JSON.stringify(manifest,null,2));
    await rename(manifestPath+'.tmp',manifestPath);
    console.log(study.id,manifest.files.map(f=>[f.name,f.status,f.bytes,f.error]));
  }
}
