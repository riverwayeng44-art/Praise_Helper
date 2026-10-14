import fs from 'fs';
import path from 'path';

// 1. Copy dist/assets to assets
if (!fs.existsSync('assets')) fs.mkdirSync('assets', { recursive: true });

// Clean old files in assets/
for (const file of fs.readdirSync('assets')) {
  fs.unlinkSync(path.join('assets', file));
}

for (const file of fs.readdirSync('dist/assets')) {
  fs.copyFileSync(path.join('dist/assets', file), path.join('assets', file));
}
console.log('[post-build] dist/assets copied to root assets/');

// 2. Ensure fonts
if (!fs.existsSync('fonts')) fs.mkdirSync('fonts', { recursive: true });
if (fs.existsSync('public/fonts/Jua-Regular.ttf')) {
  fs.copyFileSync('public/fonts/Jua-Regular.ttf', 'fonts/Jua-Regular.ttf');
}

// 3. Copy dist/index.html to root index.html so branch deployment works out of the box
fs.copyFileSync('dist/index.html', 'index.html');
console.log('[post-build] dist/index.html copied to root index.html');
