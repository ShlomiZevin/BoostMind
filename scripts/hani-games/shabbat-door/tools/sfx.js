// ElevenLabs sound effects: node sfx.js <out.mp3> <secs> "<prompt>" [loop]
const fs=require('fs');const [out,secs,prompt,loop]=process.argv.slice(2);
(async()=>{const r=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({text:prompt,duration_seconds:Number(secs),prompt_influence:0.6,loop:!!loop})});
if(!r.ok){console.error('FAILED',out,r.status,(await r.text()).slice(0,200));process.exit(1)}fs.writeFileSync(out,Buffer.from(await r.arrayBuffer()));console.log('saved',out)})();
