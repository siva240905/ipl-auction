import fs from 'fs';

const files = ['./db.js', './server.js', './auctionEngine.js'];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('playingXI') || line.includes('captainId') || line.includes('viceCaptainId')) {
      console.log(`${f} L${idx+1}: ${line.trim()}`);
    }
  });
});
