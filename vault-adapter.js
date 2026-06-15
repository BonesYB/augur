/* Adapts a parsed vault (from vault.js buildVault) into the Augur prototype's
   in-memory shapes: Bag assets (scene/sequence/clock) + a timeline from a session.
   Scenes carry resolved reference data (NPC names, creature stat blocks, loot, etc.)
   so the Monitor can show what the GM needs at the table.
   Dependency-free; works in Node and the browser. */

function _beats(S){
  return (S['Beats']||'').split('\n').filter(l=>l.trim().startsWith('-')).map(l=>l.replace(/^\s*-\s*/,'').trim()).filter(Boolean);
}
function _names(arr){ return (arr||[]).map(x=>x.title||x.id); }
function _ref(x){ return { id:x.id, title:x.title }; }
function adaptCreatureRef(c){
  const S=c.sections||{};
  return { id:c.id, title:c.title, srd:c.srd||null, cr:(c.cr!=null?c.cr:null),
    statblock:S['Statblock']||S['Stat block']||S['Stat Block']||null, notes:S['Notes']||null };
}
function adaptScene(e){
  const S=e.sections||{}; const d=e.duration||{}; const R=e._resolved||{};
  const npcs=(R.npcs&&R.npcs.length)? R.npcs.map(_ref) : (e.npcs||[]).map(t=>({title:String(t)}));
  return { id:e.id, type:'scene', title:e.title,
    durMin:d.min, durMax:d.max, conf:d.confidence,
    ender:e.ender||null, purpose:S['Purpose']||null, readAloud:S['Read-aloud']||null,
    summary:S['Summary']||null, beats:_beats(S),
    sensory:S['Sensory']||null, ifThey:S['If they…']||S['If they...']||null,
    treasure:S['Treasure']||S['Loot']||null,
    npcs, creatures:(R.creatures||[]).map(adaptCreatureRef),
    locations:(R.locations||[]).map(_ref), items:(R.items||[]).map(_ref),
    traps:(R.traps||[]).map(_ref), tables:(R.tables||[]).map(_ref), quests:(R.quests||[]).map(_ref),
    isStub:!!e.stub };
}
function adaptSequence(e){
  const S=e.sections||{};
  return { id:e.id, type:'sequence', kind:e.kind||'distributed', title:e.title,
    sceneIds:(e.scenes||[]), dur:60, summary:S['Summary']||null };
}
function adaptClock(e){
  const S=e.sections||{};
  return { id:e.id, type:'clock', title:e.title, scope:e.scope||'local', segments:e.segments||4,
    thresholds:(e.thresholds||[]).map(t=>({ at:t.at, fires:t.fires, sequenceId:t.sequence, note:t.note })),
    summary:S['Summary']||null };
}

// returns { assets:{id->asset}, clips:[], playhead, fires:[], target, clipSeqStart }
function adaptVault(vault){
  const assets={};
  for(const e of (vault.byType.scene||[]))    assets[e.id]=adaptScene(e);
  for(const e of (vault.byType.sequence||[]))  assets[e.id]=adaptSequence(e);
  for(const e of (vault.byType.clock||[]))     assets[e.id]=adaptClock(e);
  for(const id in assets){
    const a=assets[id];
    if(a.type==='sequence'){
      a.dur = a.sceneIds.reduce((s,sid)=>{ const sc=assets[sid]; return s + (sc ? Math.round(((sc.durMin||0)+(sc.durMax||0))/2) : 0); }, 0) || 60;
    }
  }

  const session=(vault.sessions||[])[0];
  let clips=[], playhead=0, fires=[], maxId=0, target=null;
  if(session){
    playhead=session.playheadMinutes||0;
    target=session.targetDurationMinutes||null;
    clips=(session.clips||[]).map(c=>{
      const a=assets[c.sourceId];
      const n=parseInt(String(c.id||'').replace(/\D/g,''),10); if(!isNaN(n)&&n>maxId) maxId=n;
      return {
        id:c.id, sourceId:c.sourceId, sourceType:c.sourceType||(a&&a.type)||'scene',
        start:c.startMinutes||0, dur:c.displayDurationMinutes||30, track:c.trackIndex||0,
        status:c.status||'planned', label:c.label||null,
        overlay: !!c.isOverlay || (a&&a.type==='clock') || c.sourceType==='clock',
        collapsed: (a&&a.type==='sequence') ? (c.collapsed!==false) : undefined,
        focusSceneId:null,
        filled: (a&&a.type==='clock') ? (c.filled||0) : undefined,
      };
    });
    fires=(session.fires||[]).map(f=>({
      id:f.id, clockClipId:f.clockClipId, clockId:f.clockId,
      clockTitle:(assets[f.clockId]||{}).title||f.clockId,
      at:f.at, flavor:f.flavor, sequenceId:f.sequence||f.sequenceId||null,
      note:f.note||null, atMin:(f.atMinutes!=null?f.atMinutes:(f.atMin||0)),
    }));
  }
  return { assets, clips, playhead, fires, target, clipSeqStart:maxId+1 };
}

if(typeof module!=='undefined' && module.exports) module.exports={ adaptVault, adaptScene, adaptSequence, adaptClock };
