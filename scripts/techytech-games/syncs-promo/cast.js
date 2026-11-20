// Full-resolution phone capture (CDP screencast at DPR 2): saves every frame + its time, then makes a constant-30fps mp4.
//   start(page, dir) -> stop() ; frames go to <dir>/f<n>.jpg, times.json, then <dir>.mp4
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
exports.start = async (page, dir) => {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page), times = []; let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const name = `f${String(n++).padStart(6, '0')}.jpg`; fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    times.push([name, f.metadata.timestamp]); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  return async () => {
    await cdp.send('Page.stopScreencast').catch(() => {});
    fs.writeFileSync(path.join(dir, 'times.json'), JSON.stringify(times));
    // concat list with real durations -> constant 30 fps (a still screen sends no frames; the last one holds)
    const lines = []; for (let i = 0; i < times.length; i++) {
      const d = i + 1 < times.length ? times[i + 1][1] - times[i][1] : 0.5;
      lines.push(`file '${times[i][0]}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
    }
    lines.push(`file '${times[times.length - 1][0]}'`);
    fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', 'fps=30,scale=780:1688:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', dir + '.mp4']);
    return dir + '.mp4';
  };
};
