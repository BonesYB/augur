/* Augur vault serializer — the inverse of vault.js's parser.
   Writes an entity object back to Markdown (frontmatter + body), preserving
   unknown frontmatter keys and the body verbatim. Round-trips losslessly:
   parse(serialize(parse(x))) deep-equals parse(x).
   Dependency-free; works in Node and the browser. */

const _INTERNAL = new Set(['sections','body']);
function _isInternal(k){ return _INTERNAL.has(k) || k.charAt(0)==='_'; }

function emitScalar(v){
  if(v===null||v===undefined) return 'null';
  if(typeof v==='number'||typeof v==='boolean') return String(v);
  const s=String(v);
  // quote when the value would otherwise re-parse as something else or break flow syntax
  if(s===''
     || /^\s|\s$/.test(s)
     || /[:#,\[\]{}"']/.test(s)
     || /^(true|false|null|~)$/i.test(s)
     || /^-?\d/.test(s)) return JSON.stringify(s);
  return s;
}
function emitFlowMap(o){
  return '{ ' + Object.keys(o).map(k=>`${k}: ${emitScalar(o[k])}`).join(', ') + ' }';
}
function emitValue(v){
  if(Array.isArray(v)) return '[' + v.map(emitScalar).join(', ') + ']';   // flow array of scalars
  if(v && typeof v==='object') return emitFlowMap(v);                       // flow map
  return emitScalar(v);
}
function emitFrontmatter(ent){
  const lines=[];
  for(const k of Object.keys(ent)){
    if(_isInternal(k)) continue;
    const v=ent[k];
    if(Array.isArray(v) && v.some(x=>x && typeof x==='object')){
      lines.push(k+':');                                                    // block sequence of flow maps
      for(const item of v) lines.push('  - ' + (item && typeof item==='object' ? emitFlowMap(item) : emitScalar(item)));
    } else {
      lines.push(k + ': ' + emitValue(v));
    }
  }
  return lines.join('\n');
}

function serializeEntity(ent){
  const body=(ent.body||'').trim();
  return `---\n${emitFrontmatter(ent)}\n---\n\n${body}\n`;
}

const FOLDER_FOR = {scene:'scenes',sequence:'sequences',clock:'clocks',npc:'npcs',location:'locations',
  handout:'handouts',creature:'creatures',item:'items',table:'tables',trap:'traps',quest:'quests'};
function pathFor(ent){
  if(ent.type==='campaign') return 'campaign.md';
  return (FOLDER_FOR[ent.type]||'misc') + '/' + ent.id + '.md';
}

/* Serialize a whole parsed vault back to a flat list of files (md + sessions + manifest).
   `recs` (optional) supplies original asset bytes to carry through unchanged. */
function serializeVault(vault, recs){
  const files=[];
  for(const ent of vault.all) files.push({ path: ent._path || pathFor(ent), text: serializeEntity(ent), isText:true });
  for(const s of (vault.sessions||[])) files.push({ path: 'sessions/'+(s.id||'session')+'.json', text: JSON.stringify(s,null,2)+'\n', isText:true });
  if(vault.manifest) files.push({ path:'augur.json', text: JSON.stringify(vault.manifest,null,2)+'\n', isText:true });
  if(recs) for(const r of recs) if(r.bytes && !r.isText) files.push({ path:r.path.replace(/^[^/]+\//,''), bytes:r.bytes, isText:false }); // carry assets
  return files;
}

if(typeof module!=='undefined' && module.exports) module.exports={ serializeEntity, serializeVault, emitFrontmatter, pathFor };
