// Озвучка произношения словарных слов: media/audio/<audioKey>.mp3 из word.
// Usage: OPENAI_API_KEY=... node scripts/gen-vocab-audio.js <vocab_items.json> [--dry]
const fs=require('fs');
const KEY=process.env.OPENAI_API_KEY, MODEL=process.env.TTS_MODEL||'tts-1', VOICE=process.env.TTS_VOICE||'alloy';
const MEDIA='/home/alex/englishintg/media/audio';
const DRY=process.argv.includes('--dry');
const FILE=process.argv[2];
if(!KEY&&!DRY){console.error('OPENAI_API_KEY not set');process.exit(1);}
async function tts(text){const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,voice:VOICE,input:text,response_format:'mp3'})});if(!r.ok)throw new Error('tts '+r.status);return Buffer.from(await r.arrayBuffer());}
(async()=>{
  const items=JSON.parse(fs.readFileSync(FILE,'utf8'));
  const jobs=[];
  for(const it of items){ if(!it.audioKey||!it.word)continue; const f=`${MEDIA}/${it.audioKey}.mp3`; if(!fs.existsSync(f))jobs.push({f,text:it.word}); }
  console.log(`слов: ${items.length} | нужно озвучить: ${jobs.length} | уже есть: ${items.length-jobs.length}`);
  if(DRY){console.log('DRY');return;}
  let done=0,fail=0,C=6,idx=0;
  async function worker(){ while(idx<jobs.length){ const j=jobs[idx++]; try{fs.writeFileSync(j.f,await tts(j.text));done++;}catch(e){fail++;} if(done%100===0)console.log(`  ${done}/${jobs.length}`); } }
  await Promise.all(Array.from({length:C},worker));
  console.log(`Готово: ${done}, ошибок ${fail}`);
})();
