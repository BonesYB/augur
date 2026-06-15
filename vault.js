/* Augur vault parser + validator — dependency-free.
   Works in Node (module.exports) and the browser (globals).
   Implements the subset of YAML the vault format spec uses:
   scalars, flow arrays [a, b], flow maps { k: v }, and block sequences of flow maps. */

function vSplitTopLevel(s, sep){
  const parts=[]; let depth=0, q=null, cur='';
  for(let i=0;i<s.length;i++){ const ch=s[i];
    if(q){ cur+=ch; if(ch===q) q=null; continue; }
    if(ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; }
    if(ch==='['||ch==='{'){ depth++; cur+=ch; continue; }
    if(ch===']'||ch==='}'){ depth--; cur+=ch; continue; }
    if(ch===sep && depth===0){ parts.push(cur); cur=''; continue; }
    cur+=ch;
  }
  if(cur.trim()!=='') parts.push(cur);
  return parts;
}
function vParseScalar(s){
  s=s.trim();
  if(s===''||s==='~'||s==='null') return null;
  if(s==='true') return true; if(s==='false') return false;
  if(/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if((s[0]==='"'&&s.endsWith('"'))||(s[0]==="'"&&s.endsWith("'"))) return s.slice(1,-1);
  return s;
}
function vParseFlowArray(s){
  const inner=s.slice(1,-1).trim();
  if(!inner) return [];
  return vSplitTopLevel(inner, ',').map(x=>vParseValue(x.trim()));
}
function vParseFlowMap(s){
  const inner=s.slice(1,-1).trim();
  const out={};
  if(!inner) return out;
  for(const pair of vSplitTopLevel(inner, ',')){
    const idx=pair.indexOf(':');
    if(idx<0) continue;
    out[pair.slice(0,idx).trim()]=vParseValue(pair.slice(idx+1).trim());
  }
  return out;
}
function vParseValue(s){
  s=s.trim();
  if(s[0]==='[') return vParseFlowArray(s);
  if(s[0]==='{') return vParseFlowMap(s);
  return vParseScalar(s);
}
function parseFrontmatter(text){
  const lines=text.split('\n'); const out={}; let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(line.trim()===''){ i++; continue; }
    const m=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if(!m){ i++; continue; }
    const key=m[1], rest=m[2];
    if(rest===''){
      const items=[]; let j=i+1;
      while(j<lines.length && /^\s*-\s+/.test(lines[j])){ items.push(vParseValue(lines[j].replace(/^\s*-\s+/,''))); j++; }
      if(items.length){ out[key]=items; i=j; continue; }
      out[key]=null; i++; continue;
    }
    out[key]=vParseValue(rest); i++;
  }
  return out;
}
function parseSections(body){
  const out={}; const parts=body.split(/^##\s+/m);
  for(let k=1;k<parts.length;k++){
    const seg=parts[k]; const nl=seg.indexOf('\n');
    const header=(nl<0?seg:seg.slice(0,nl)).trim();
    out[header]=(nl<0?'':seg.slice(nl+1)).trim();
  }
  return out;
}
function parseFile(text){
  const m=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if(!m) return { frontmatter:{}, body:text.trim(), sections:{} };
  const body=m[2].trim();
  return { frontmatter:parseFrontmatter(m[1]), body, sections:parseSections(body) };
}

const REQUIRED = {
  scene:['title','duration'], sequence:['title','kind','scenes'], clock:['title','segments'],
  npc:['title'], location:['title'], handout:['title'], creature:['title'], campaign:['title'],
  item:['title'], table:['title'], trap:['title'], quest:['title'],
};
const RELATIONS = {
  scene:[['npcs','npc'],['locations','location'],['clocks','clock'],['handouts','handout'],
         ['creatures','creature'],['items','item'],['traps','trap'],['tables','table'],['quests','quest']],
  sequence:[['scenes','scene']],
  npc:[['locations','location'],['creatures','creature']],
  location:[['parent','location',true],['npcs','npc'],['handouts','handout']],
  quest:[['scenes','scene']],
  trap:[['creatures','creature']],
};
const FOLDER_TYPE = {scenes:'scene',sequences:'sequence',clocks:'clock',npcs:'npc',locations:'location',
  handouts:'handout',creatures:'creature',items:'item',tables:'table',traps:'trap',quests:'quest'};
function folderType(path){ const seg=path.split('/'); return seg.length>1 ? (FOLDER_TYPE[seg[seg.length-2]]||null) : null; }

function buildVault(files){
  const byId=new Map();
  const byType={scene:[],sequence:[],clock:[],npc:[],location:[],handout:[],creature:[],campaign:[],item:[],table:[],trap:[],quest:[]};
  const all=[]; const sessions=[]; let manifest=null; const assetPaths=new Set();
  const errors=[], warnings=[];
  const norm=p=>p.replace(/^.*?(?=(scenes|sequences|clocks|npcs|locations|handouts|creatures|items|tables|traps|quests|sessions|assets)\/)/,'').replace(/^.*?\/?(augur\.json|campaign\.md)$/,'$1');

  for(const f of files){
    const p=norm(f.path);
    if(/(^|\/)assets\//.test(p)){ assetPaths.add(p.replace(/^.*?assets\//,'assets/')); continue; }
    const base=p.split('/').pop();
    if(base==='augur.json'){ try{ manifest=JSON.parse(f.text); }catch(e){ errors.push('augur.json: invalid JSON'); } continue; }
    if(p.endsWith('.json')){ try{ sessions.push(JSON.parse(f.text)); }catch(e){ errors.push(p+': invalid JSON'); } continue; }
    if(!p.endsWith('.md')) continue;
    const { frontmatter, sections, body }=parseFile(f.text);
    const type=frontmatter.type||folderType(p);
    const id=frontmatter.id;
    if(!id){ errors.push(p+': missing id'); continue; }
    if(!type){ errors.push(p+': missing/unknown type'); continue; }
    if(!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push(`${type} "${id}": id is not a valid slug`);
    const key=type+'::'+id;
    if(byId.has(key)) errors.push(`duplicate ${type} id "${id}"`);
    const ent={ ...frontmatter, id, type, sections, body, _path:p };
    byId.set(key,ent); (byType[type]||(byType[type]=[])).push(ent); all.push(ent);
  }

  for(const ent of all){
    for(const field of (REQUIRED[ent.type]||[])){
      const v=ent[field];
      if(v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length)) errors.push(`${ent.type} "${ent.id}": missing required "${field}"`);
    }
    if(ent.type==='scene'){
      const d=ent.duration;
      if(d && typeof d==='object'){
        if(d.confidence && !['tight','loose'].includes(d.confidence)) errors.push(`scene "${ent.id}": confidence must be tight|loose`);
        if(typeof d.min==='number' && typeof d.max==='number'){
          if(d.min>d.max) errors.push(`scene "${ent.id}": duration.min > duration.max`);
          if(d.min<=0||d.max<=0) errors.push(`scene "${ent.id}": duration must be positive`);
        }
      }
      /* ender is an optional boolean flag ("can this scene close a session?"); any truthy value is accepted. */
    }
    if(ent.type==='sequence' && ent.kind && !['tight','distributed'].includes(ent.kind)) errors.push(`sequence "${ent.id}": kind must be tight|distributed`);
    if(ent.type==='clock'){
      if(ent.scope && !['campaign','local'].includes(ent.scope)) errors.push(`clock "${ent.id}": scope must be campaign|local`);
      for(const t of (ent.thresholds||[])){
        if(!['run_beat','world_state'].includes(t.fires)) errors.push(`clock "${ent.id}": threshold.fires must be run_beat|world_state`);
        if(typeof ent.segments==='number' && (t.at<1||t.at>ent.segments)) errors.push(`clock "${ent.id}": threshold at ${t.at} outside 1..${ent.segments}`);
        if(t.fires==='run_beat' && !t.sequence) errors.push(`clock "${ent.id}": run_beat threshold needs a sequence`);
        if(t.fires==='world_state' && !t.note) errors.push(`clock "${ent.id}": world_state threshold needs a note`);
      }
    }
    if(ent.type==='item' && ent.rarity && !['common','uncommon','rare','very rare','legendary','artifact'].includes(String(ent.rarity).toLowerCase()))
      warnings.push(`item "${ent.id}": unusual rarity "${ent.rarity}"`);
  }

  const resolve=(type,id)=>byId.get(type+'::'+id);
  for(const ent of all){
    ent._resolved={};
    for(const rel of (RELATIONS[ent.type]||[])){
      const field=rel[0], target=rel[1], single=rel[2];
      const val=ent[field]; if(val==null) continue;
      const ids = single ? [val] : (Array.isArray(val)?val:[val]);
      const got=[]; const seen=new Set();
      for(const rid of ids){
        if(seen.has(rid)){ warnings.push(`${ent.type} "${ent.id}": duplicate ${field} "${rid}"`); }
        seen.add(rid);
        const r=resolve(target,rid);
        if(!r) warnings.push(`${ent.type} "${ent.id}": ${field} → "${rid}" not found (${target})`);
        else got.push(r);
      }
      ent._resolved[field]= single ? (got[0]||null) : got;
    }
    if(ent.type==='clock') for(const t of (ent.thresholds||[])) if(t.fires==='run_beat' && t.sequence && !resolve('sequence',t.sequence)) warnings.push(`clock "${ent.id}": threshold sequence "${t.sequence}" not found`);
    if(ent.type==='handout' && ent.image && !assetPaths.has(ent.image)) warnings.push(`handout "${ent.id}": image "${ent.image}" not found under assets/`);
  }
  for(const loc of (byType.location||[])){
    let cur=loc, hops=0; const seen=new Set();
    while(cur && cur.parent){ if(seen.has(cur.id)){ warnings.push(`location "${loc.id}": parent cycle`); break; } seen.add(cur.id); cur=resolve('location',cur.parent); if(++hops>50) break; }
  }
  for(const s of sessions) for(const c of (s.clips||[])) if(c.sourceId && c.sourceType && !resolve(c.sourceType,c.sourceId)) warnings.push(`session "${s.id||'?'}": clip source ${c.sourceType} "${c.sourceId}" not found`);

  return { all, byType, byId, manifest, sessions, assetPaths:[...assetPaths], issues:{errors,warnings} };
}

if(typeof module!=='undefined' && module.exports) module.exports={ parseFrontmatter, parseSections, parseFile, buildVault };
