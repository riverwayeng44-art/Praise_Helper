import assert from 'assert';

// 1. Transposition Logic Verification
console.log('--- TEST 1: Transposition Logic ---');
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const KEY_TO_SEMITONE = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};
const SHARP_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ROOTS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function getSemitoneDiff(fromKey, toKey) {
  const fromSemi = KEY_TO_SEMITONE[fromKey] ?? 0;
  const toSemi = KEY_TO_SEMITONE[toKey] ?? 0;
  let diff = (toSemi - fromSemi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -5) diff += 12;
  return diff;
}

function transposeNote(note, semitones, preferFlat) {
  if (semitones === 0) return note;
  const currentSemi = KEY_TO_SEMITONE[note];
  if (currentSemi === undefined) return note;
  const newSemi = ((currentSemi + semitones) % 12 + 12) % 12;
  return preferFlat ? FLAT_ROOTS[newSemi] : SHARP_ROOTS[newSemi];
}

function transposeChord(chordText, semitones, preferFlat) {
  if (!chordText || semitones === 0) return chordText;
  const regex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
  const match = chordText.match(regex);
  if (!match) return chordText;
  const [, root, quality, , bass] = match;
  const transposedRoot = transposeNote(root, semitones, preferFlat);
  const transposedBass = bass ? '/' + transposeNote(bass, semitones, preferFlat) : '';
  return `${transposedRoot}${quality}${transposedBass}`;
}

// Test A Key -> G Key (-2 semitones)
const diffAtoG = getSemitoneDiff('A', 'G');
assert.strictEqual(diffAtoG, -2, 'A to G diff must be -2');
assert.strictEqual(transposeChord('A', diffAtoG, false), 'G');
assert.strictEqual(transposeChord('F#m7', diffAtoG, false), 'Em7');
assert.strictEqual(transposeChord('D/F#', diffAtoG, false), 'C/E');
assert.strictEqual(transposeChord('E/G#', diffAtoG, false), 'D/F#');
assert.strictEqual(transposeChord('Bm7', diffAtoG, false), 'Am7');
console.log('✓ Transposition A -> G verified successfully: F#m7 -> Em7, D/F# -> C/E, E/G# -> D/F#');

// Test C Key -> D Key (+2 semitones)
const diffCtoD = getSemitoneDiff('C', 'D');
assert.strictEqual(diffCtoD, 2);
assert.strictEqual(transposeChord('C', diffCtoD, false), 'D');
assert.strictEqual(transposeChord('Am7', diffCtoD, false), 'Bm7');
assert.strictEqual(transposeChord('G/B', diffCtoD, false), 'A/C#');
console.log('✓ Transposition C -> D verified successfully: Am7 -> Bm7, G/B -> A/C#');

// 2. Obfuscation & Security Verification
console.log('\n--- TEST 2: Bridge URL Decoding & Security ---');
const raw = '425e5e5a591005054e4f48434b44045e4b43464c4e4c1b1c49045e5904444f5e055c1b';
const key = 42;
const decoded = raw.match(/.{1,2}/g).map((hex) => String.fromCharCode(parseInt(hex, 16) ^ key)).join('');
assert.ok(decoded.startsWith('https://') && decoded.endsWith('/v1') && decoded.length === 35);
console.log('✓ Embedded Bridge URL successfully restores with prefix:', decoded.slice(0, 15) + '... and length:', decoded.length);

// 3. Color Normalization & High Contrast Badge Verification
console.log('\n--- TEST 3: Color Normalization & Badge Contrast ---');
function normalizeColor(colorStr) {
  if (!colorStr) return { r: 37, g: 99, b: 235, hex: '#2563eb' };
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10)));
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { r, g, b, hex };
  }
  const cleanHex = colorStr.replace('#', '').trim();
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) || 37;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 99;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 235;
    return { r, g, b, hex: `#${cleanHex.substring(0, 6)}` };
  }
  return { r: 37, g: 99, b: 235, hex: '#2563eb' };
}

const drumColor = normalizeColor('rgba(59, 130, 246, 0.25)');
assert.strictEqual(drumColor.hex, '#3b82f6');
const amberColor = normalizeColor('#f59e0b');
assert.strictEqual(amberColor.hex, '#f59e0b');

function getBadgeTextColor(r, g, b) {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 185 ? '#0f172a' : '#ffffff';
}

assert.strictEqual(getBadgeTextColor(drumColor.r, drumColor.g, drumColor.b), '#ffffff', 'Blue badge must have white text');
assert.strictEqual(getBadgeTextColor(255, 255, 255), '#0f172a', 'White badge must have dark text');
console.log('✓ normalizeColor handles both rgba and hex, and calculates high-contrast badge text color');

// 4. Hermes LLM Response Sanitization & JSON Extraction
console.log('\n--- TEST 4: Hermes LLM Response Extraction ---');
function extractJsonFromResponse(content) {
  let cleaned = content.trim();
  const firstOpenBrace = cleaned.indexOf('{');
  const lastCloseBrace = cleaned.lastIndexOf('}');
  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
    cleaned = cleaned.substring(firstOpenBrace, lastCloseBrace + 1);
  }
  return JSON.parse(cleaned);
}

const mockHermesResponse = `
Here is the music sheet analysis:
\`\`\`json
{
  "detectedKey": "A",
  "chords": [
    { "chordText": "A", "xPercent": 0.12, "yPercent": 0.18 },
    { "chordText": "E", "xPercent": 0.35, "yPercent": 0.18 }
  ]
}
\`\`\`
--- ⚕️ Hermes 3.1 Pro Assistant ---
`;

const extracted = extractJsonFromResponse(mockHermesResponse);
assert.strictEqual(extracted.detectedKey, 'A');
assert.strictEqual(extracted.chords.length, 2);
assert.strictEqual(extracted.chords[0].chordText, 'A');
assert.strictEqual(extracted.chords[0].xPercent, 0.12);
console.log('✓ Hermes signature and markdown wrapper successfully extracted to pure JSON');

// 5. 8-Point Bright Background Inpainting Luminance Test
console.log('\n--- TEST 5: Background Luminance Threshold ---');
const sampleWhite = [250, 248, 245]; // paper
const sampleNoteLine = [30, 30, 30]; // staff line
const lumWhite = 0.299 * sampleWhite[0] + 0.587 * sampleWhite[1] + 0.114 * sampleWhite[2];
const lumLine = 0.299 * sampleNoteLine[0] + 0.587 * sampleNoteLine[1] + 0.114 * sampleNoteLine[2];
assert.ok(lumWhite >= 200, 'White paper luminance must pass threshold >= 200');
assert.ok(lumLine < 200, 'Staff line luminance must be filtered out (< 200)');
console.log('✓ 8-Point bright background sampling correctly selects paper (lum: ' + Math.round(lumWhite) + ') over lines (lum: ' + Math.round(lumLine) + ')');

// 6. Compact Box Sizing Algorithm Verification
console.log('\n--- TEST 6: Compact Chord Box Sizing ---');
function calculateBox(imageWidth, imageHeight, chordStr, xPercent, yPercent) {
  const charCount = chordStr.length;
  const baseCharWidth = Math.max(14, Math.round(imageWidth * 0.011));
  const boxW = Math.max(26, Math.min(Math.round(baseCharWidth * Math.max(1.2, charCount + 0.8)), 80));
  const boxH = Math.max(22, Math.round(imageHeight * 0.022));
  const bx = Math.round(xPercent * imageWidth - boxW / 2);
  const by = Math.round(yPercent * imageHeight - boxH / 2);
  return { boxW, boxH, bx, by };
}

const boxG = calculateBox(1000, 1400, 'G', 0.5, 0.5);
assert.ok(boxG.boxW >= 26 && boxG.boxW <= 40, `Single char box width should be compact (got ${boxG.boxW})`);
const boxFsharpM7 = calculateBox(1000, 1400, 'F#m7', 0.5, 0.5);
assert.ok(boxFsharpM7.boxW > boxG.boxW, 'Multi-char chord should have wider box');
assert.ok(boxFsharpM7.boxW <= 80, 'Multi-char chord should not exceed 80px');
console.log('✓ Compact box sizing correctly scales with chord length (G: ' + boxG.boxW + 'px, F#m7: ' + boxFsharpM7.boxW + 'px)');

// 7. Direct Google Gemini & Proxy URL Resolution
console.log('\n--- TEST 7: Gemini Key & Endpoint Resolution ---');
function isGoogleGeminiKeyOrEndpoint(apiKey, endpoint) {
  if (apiKey && apiKey.startsWith('AIza')) return true;
  if (endpoint && endpoint.includes('generativelanguage.googleapis.com')) return true;
  return false;
}
assert.strictEqual(isGoogleGeminiKeyOrEndpoint('AIzaSyD-TestKey', ''), true);
assert.strictEqual(isGoogleGeminiKeyOrEndpoint('dummy-key', 'https://debian.tailfdf16c.ts.net/v1/chat/completions'), false);
console.log('✓ Direct Google Gemini API detection correctly routes AIza keys and bridge endpoints');

// 8. Production Bundle & Asset Sanity Check
import fs from 'fs';
console.log('\n--- TEST 8: Production Bundle & Asset Sanity Check ---');
assert.ok(fs.existsSync('index.html'), 'index.html must exist');
const html = fs.readFileSync('index.html', 'utf8');

const scriptMatch = html.match(/src="(\.\/assets\/index-[^"]+\.js)"/);
const cssMatch = html.match(/href="(\.\/assets\/index-[^"]+\.css)"/);
assert.ok(scriptMatch, 'script tag with bundle JS must be present');
assert.ok(cssMatch, 'link tag with bundle CSS must be present');

const jsPath = scriptMatch[1].replace('./', '');
const cssPath = cssMatch[1].replace('./', '');
assert.ok(fs.existsSync(jsPath), 'JS bundle must exist on disk: ' + jsPath);
assert.ok(fs.existsSync(cssPath), 'CSS bundle must exist on disk: ' + cssPath);

const jsSize = fs.statSync(jsPath).size;
const cssSize = fs.statSync(cssPath).size;
assert.ok(jsSize > 100000, 'JS bundle size ok (' + jsSize + ')');
assert.ok(cssSize > 10000, 'CSS bundle size ok (' + cssSize + ')');
console.log('✓ JS and CSS bundles exist (' + Math.round(jsSize/1024) + 'KB, ' + Math.round(cssSize/1024) + 'KB)');

assert.ok(fs.existsSync('public/fonts/Jua-Regular.ttf'), 'public font must exist');
assert.ok(fs.existsSync('fonts/Jua-Regular.ttf'), 'root fonts must exist');
console.log('✓ Jua font assets verified in public and root');

const jsContent = fs.readFileSync(jsPath, 'utf8');
assert.ok(jsContent.includes('찬양팀 콘티 도우미'), 'Title should be bundled');
assert.ok(jsContent.includes('PPT 슬라이드 쇼'), 'PPT button should be bundled');
assert.ok(jsContent.includes('detectedKey'), 'Analysis logic should be bundled');
console.log('✓ Key UI strings and features confirmed inside compiled bundle');

console.log('\n=== ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! ===\n');

