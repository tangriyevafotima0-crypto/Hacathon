export function mergeLibraryStudies(studies,files,language){
 const grouped=new Map(studies.map(study=>[study.id,{...study,files:[...study.files]}]));
 for(const file of files){
  if(!grouped.has(file.studyId))grouped.set(file.studyId,{
   id:file.studyId,title:file.title||file.studyId,version:file.version,doi:file.doi,sourceUrl:file.sourceUrl,
   kind:'UNKNOWN',description:language==='uz'?'Serverga yuklangan tadqiqot fayllari.':'Research files available on the server.',
   approach:language==='uz'?'Metodika uchun asl hujjatlarni ko‘ring.':'See the original documents for methodology.',files:[],
  });
  const study=grouped.get(file.studyId);
  if(!study.files.some(old=>old.url===file.url||old.sha256&&old.sha256===file.sha256))study.files.push(file);
 }
 return [...grouped.values()];
}
