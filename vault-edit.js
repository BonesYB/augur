/* Augur vault editing engine — create / delete / rename / relink with referential integrity.
   Operates on a parsed vault (vault.js buildVault result). Mutations touch entity fields +
   vault.all + sessions; callers should rebuild the vault (serialize → buildVault) afterward to
   re-resolve relations and re-validate. Dependency-free; Node + browser. */

const REL = {
  scene:[['npcs','npc',false],['locations','location',false],['clocks','clock',false],['handouts','handout',false],
         ['creatures','creature',false],['items','item',false],['traps','trap',false],['tables','table',false],['quests','quest',false]],
  sequence:[['scenes','scene',false]],
  npc:[['locations','location',false],['creatures','creature',false]],
  location:[['parent','location',true],['npcs','npc',false],['handouts','handout',false]],
  quest:[['scenes','scene',false]],
  trap:[['creatures','creature',false]],
};
const FOLDER = {scene:'scenes',sequence:'sequences',clock:'clocks',npc:'npcs',location:'locations',handout:'handouts',
  creature:'creatures',item:'items',table:'tables',trap:'traps',quest:'quests',campaign:'.'};
const relsFor = type => REL[type] || [];
function _sections(body){ const out={}; const parts=String(body||'').split(/^##\s+/m);
  for(let k=1;k<parts.length;k++){ const seg=parts[k]; const nl=seg.indexOf('\n'); out[(nl<0?seg:seg.slice(0,nl)).trim()]=(nl<0?'':seg.slice(nl+1)).trim(); } return out; }

/* every place that references (type,id): relation fields, clock thresholds, session clips */
function referrersOf(vault, type, id){
  const refs=[];
  for(const ent of vault.all){
    for(const [field,target,single] of relsFor(ent.type)){
      if(target!==type) continue;
      const v=ent[field]; if(v==null) continue;
      if(single){ if(v===id) refs.push({ent,field,single:true}); }
      else if(Array.isArray(v) && v.includes(id)) refs.push({ent,field,single:false});
    }
    if(ent.type==='clock' && type==='sequence' && (ent.thresholds||[]).some(t=>t.sequence===id)) refs.push({ent,field:'thresholds'});
  }
  let clips=0;
  for(const s of (vault.sessions||[])) clips += (s.clips||[]).filter(c=>c.sourceId===id && c.sourceType===type).length;
  return { refs, clips };
}

function createEntity(vault, type, id, fields, body){
  fields=fields||{}; body=body||'';
  if(!/^[a-z0-9][a-z0-9-]*$/.test(id)) return {error:'id must be a slug: lowercase letters, numbers, hyphens'};
  if(vault.all.some(e=>e.type===type && e.id===id)) return {error:`a ${type} with id "${id}" already exists`};
  const ent={ id, type, ...fields, sections:_sections(body), body:String(body), _path:(FOLDER[type]||'misc')+'/'+id+'.md', _resolved:{} };
  vault.all.push(ent);
  if(vault.byType[type]) vault.byType[type].push(ent); else vault.byType[type]=[ent];
  if(vault.byId) vault.byId.set(type+'::'+id, ent);
  return {ent};
}

function deleteEntity(vault, type, id){
  const ent=vault.all.find(e=>e.type===type && e.id===id); if(!ent) return {removed:0};
  const {refs}=referrersOf(vault,type,id); let unlinked=0;
  for(const r of refs){
    if(r.field==='thresholds'){ r.ent.thresholds=(r.ent.thresholds||[]).filter(t=>t.sequence!==id); unlinked++; }
    else if(r.single){ r.ent[r.field]=null; unlinked++; }
    else { r.ent[r.field]=r.ent[r.field].filter(x=>x!==id); unlinked++; }
  }
  vault.all=vault.all.filter(e=>e!==ent);
  if(vault.byType[type]) vault.byType[type]=vault.byType[type].filter(e=>e!==ent);
  if(vault.byId) vault.byId.delete(type+'::'+id);
  let clipsRemoved=0;
  for(const s of (vault.sessions||[])){ const n=(s.clips||[]).length; s.clips=(s.clips||[]).filter(c=>!(c.sourceId===id && c.sourceType===type)); clipsRemoved+=n-(s.clips||[]).length; }
  return {removed:1, unlinked, clipsRemoved};
}

function renameEntity(vault, type, oldId, newId){
  if(!/^[a-z0-9][a-z0-9-]*$/.test(newId)) return {error:'id must be a slug: lowercase letters, numbers, hyphens'};
  if(oldId===newId) return {renamed:false, updated:0};
  if(vault.all.some(e=>e.type===type && e.id===newId)) return {error:`a ${type} with id "${newId}" already exists`};
  const ent=vault.all.find(e=>e.type===type && e.id===oldId); if(!ent) return {error:'not found'};
  const {refs}=referrersOf(vault,type,oldId); let updated=0;
  for(const r of refs){
    if(r.field==='thresholds'){ for(const t of r.ent.thresholds) if(t.sequence===oldId) t.sequence=newId; updated++; }
    else if(r.single){ r.ent[r.field]=newId; updated++; }
    else { r.ent[r.field]=r.ent[r.field].map(x=>x===oldId?newId:x); updated++; }
  }
  ent.id=newId; ent._path=(FOLDER[type]||'misc')+'/'+newId+'.md';
  if(vault.byId){ vault.byId.delete(type+'::'+oldId); vault.byId.set(type+'::'+newId, ent); }
  for(const s of (vault.sessions||[])){
    for(const c of (s.clips||[])) if(c.sourceId===oldId && c.sourceType===type) c.sourceId=newId;
    for(const f of (s.fires||[])) if(type==='sequence' && f.sequence===oldId) f.sequence=newId;
  }
  return {renamed:true, updated};
}

function setRelation(ent, field, single, ids){
  if(single){ ent[field]=ids[0]||null; }
  else { ent[field]=ids.slice(); }
}
function addRelation(ent, field, single, id){
  if(single){ ent[field]=id; }
  else { if(!Array.isArray(ent[field])) ent[field]= ent[field]?[ent[field]]:[]; if(!ent[field].includes(id)) ent[field].push(id); }
}
function removeRelation(ent, field, single, id){
  if(single){ if(ent[field]===id) ent[field]=null; }
  else if(Array.isArray(ent[field])) ent[field]=ent[field].filter(x=>x!==id);
}

if(typeof module!=='undefined' && module.exports) module.exports={ REL, FOLDER, relsFor, referrersOf, createEntity, deleteEntity, renameEntity, addRelation, removeRelation, setRelation };
