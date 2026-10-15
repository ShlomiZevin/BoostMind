// Captures the microphone as raw float samples, tagged with the audio clock frame they were
// recorded at — so the vocal can be placed against the backing track sample-accurately.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.port.onmessage = (e) => { this.on = e.data === 'start'; if (!this.on) this.port.postMessage({ done: true }); };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let sum = 0, pk = 0;
      for (let i = 0; i < ch.length; i++) { sum += ch[i] * ch[i]; pk = Math.max(pk, Math.abs(ch[i])); }
      this.level = Math.max((this.level || 0) * 0.92, Math.sqrt(sum / ch.length));
      this.peak = Math.max((this.peak || 0) * 0.995, pk);
      if ((this.n = (this.n || 0) + 1) % 8 === 0) this.port.postMessage({ level: this.level, peak: this.peak });
      if (this.on) this.port.postMessage({ frame: currentFrame, data: ch.slice(0) });
    }
    return true;
  }
}
registerProcessor('capture', Capture);
