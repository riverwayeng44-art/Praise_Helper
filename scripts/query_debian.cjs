const fs = require('fs');
const cmd = fs.readFileSync('scripts/remote_cmd.txt', 'utf-8').trim();

const ws = new WebSocket('wss://debian.tailfdf16c.ts.net/live/ws', ['tty']);
ws.binaryType = 'arraybuffer';
function sendStr(s) {
  const enc = new TextEncoder();
  const d = enc.encode(s);
  const buf = new Uint8Array(d.length + 1);
  buf[0] = 0x30;
  buf.set(d, 1);
  ws.send(buf);
}
ws.onopen = () => {
  ws.send(JSON.stringify({ AuthToken: '', columns: 140, rows: 40 }));
  setTimeout(() => {
    sendStr('\x02'); // Ctrl-B
    setTimeout(() => {
      sendStr('2'); // Tab 2
      setTimeout(() => {
        sendStr('\x03\x03\x03'); // Ctrl-C multiple times to clear any stuck prompt!
        setTimeout(() => {
          sendStr(cmd + '\n');
        }, 500);
      }, 500);
    }, 200);
  }, 1000);
};
ws.onmessage = (e) => {
  const bytes = new Uint8Array(e.data);
  if (bytes[0] === 0x30) {
    const text = new TextDecoder().decode(bytes.slice(1));
    process.stdout.write(text);
  }
};
setTimeout(() => { ws.close(); process.exit(0); }, 6000);
