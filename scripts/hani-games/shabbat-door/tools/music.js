// ElevenLabs music (instrumental): node music.js <out.mp3> <secs> "<prompt>"
const fs=require('fs');const [out,secs,prompt]=process.argv.slice(2);
(async()=>{const r=await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({prompt,music_length_ms:Math.round(secs*1000),model_id:'music_v1',force_instrumental:true})});
if(!r.ok){console.error('FAILED',r.status,(await r.text()).slice(0,300));process.exit(1)}fs.writeFileSync(out,Buffer.from(await r.arrayBuffer()));console.log('saved',out)})();
