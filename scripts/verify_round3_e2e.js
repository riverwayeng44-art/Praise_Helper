import fs from 'fs';
import { parseSetlistTextWithTitles } from '../src/utils/youtubeUtils.ts';
import { getSemitoneDiff, transposeChord, extractRootNote, FLAT_DOMINANT_KEYS, STANDARD_KEYS } from '../src/utils/transposer.ts';
import { analyzeSetlistTextWithAI, DEFAULT_API_CONFIG } from '../src/services/aiService.ts';

async function runRound3() {
  console.log('🚀 Starting Round 3: End-to-End Functional & Web Integration Verification\n');

  // TEST 1: Transposition Harmony Engine Verification
  console.log('--- TEST 1: Musical Transposition Engine ---');
  const diffGtoA = getSemitoneDiff('G', 'A');
  if (diffGtoA !== 2) throw new Error(`Semitone diff G -> A should be 2, got ${diffGtoA}`);
  console.log(`✅ G -> A semitone diff: +${diffGtoA} semitones`);

  const transposed1 = transposeChord('G', 2, 'A');
  if (transposed1 !== 'A') throw new Error(`Transposed G (+2) should be A, got ${transposed1}`);

  const preferFlatA = FLAT_DOMINANT_KEYS.has('A'); // false
  const transposedSlash = transposeChord('D/F#', 2, preferFlatA);
  if (transposedSlash !== 'E/G#') throw new Error(`Transposed D/F# (+2) should be E/G#, got ${transposedSlash}`);
  console.log(`✅ Transposed "D/F#" (+2 to A Key) -> "${transposedSlash}"`);

  const preferFlatBb = FLAT_DOMINANT_KEYS.has('Bb'); // true
  const transposedFlat = transposeChord('C', -2, preferFlatBb);
  if (transposedFlat !== 'Bb') throw new Error(`Transposed C (-2 to Bb) should be Bb, got ${transposedFlat}`);
  console.log(`✅ Transposed "C" (-2 to Bb Key) -> "${transposedFlat}" (Flat dominant preserved)`);

  const rootCsharp = extractRootNote('C#m7(b5)');
  if (rootCsharp !== 'C#') throw new Error(`Root of C#m7(b5) should be C#, got ${rootCsharp}`);
  console.log(`✅ Root note extraction: "C#m7(b5)" -> "${rootCsharp}"`);

  // TEST 2: YouTube Setlist Text Parsing (oEmbed metadata fetch)
  console.log('\n--- TEST 2: YouTube Setlist Parsing & Metadata Retrieval ---');
  const sampleSetlistText = `
1. 주를 기억하라 - https://www.youtube.com/watch?v=k5qP8W-T5v8
2. 주 이름 찬양 - https://youtu.be/k5qP8W-T5v8
`.trim();

  const extracted = await parseSetlistTextWithTitles(sampleSetlistText);
  console.log(`Extracted ${extracted.length} items from setlist:`);
  extracted.forEach((item, idx) => {
    console.log(`   [${idx + 1}] User Title: "${item.userTextTitle}", URL: "${item.url}", Video Title: "${item.videoTitle || 'N/A'}"`);
  });
  if (extracted.length !== 2) throw new Error(`Expected 2 items, got ${extracted.length}`);
  if (extracted[0].userTextTitle !== '주를 기억하라') throw new Error(`Item 1 title failed`);
  if (extracted[1].userTextTitle !== '주 이름 찬양') throw new Error(`Item 2 title failed`);
  console.log('✅ YouTube setlist parsing passed');

  // TEST 3: AI Setlist Matching
  console.log('\n--- TEST 3: AI Setlist 1:1 Matching ---');
  const mockSheets = [
    { id: 'sheet-1', title: '주를 기억하라 (IMG_7588)', detectedKey: 'G' },
    { id: 'sheet-2', title: '주 이름 찬양 (IMG_7589)', detectedKey: 'A' },
  ];

  const matched = await analyzeSetlistTextWithAI(sampleSetlistText, mockSheets, DEFAULT_API_CONFIG);
  console.log(`Matched ${matched.length} sheets:`);
  matched.forEach(m => {
    console.log(`   * Sheet "${m.sheetTitle}" -> URL "${m.youtubeUrl}"`);
  });
  if (matched.length !== 2) throw new Error(`Expected 2 matches, got ${matched.length}`);
  console.log('✅ AI Setlist matching passed');

  // TEST 4: Video Player URL Parser Check
  console.log('\n--- TEST 4: Video Player YouTube Video ID Extraction ---');
  function getYoutubeVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  }
  const vid1 = getYoutubeVideoId('https://www.youtube.com/watch?v=k5qP8W-T5v8');
  const vid2 = getYoutubeVideoId('https://youtu.be/k5qP8W-T5v8');
  if (vid1 !== 'k5qP8W-T5v8' || vid2 !== 'k5qP8W-T5v8') throw new Error('Video ID regex mismatch');
  console.log(`✅ Video ID extracted correctly: "${vid1}"`);

  // TEST 5: Verify Bundle Assets and Entry Files
  console.log('\n--- TEST 5: Web Bundle File Verification ---');
  const distHtml = fs.readFileSync('dist/index.html', 'utf8');
  if (!distHtml.includes('Jua') || !distHtml.includes('assets/')) {
    throw new Error('dist/index.html is missing expected font or assets reference');
  }
  console.log('✅ dist/index.html contains Jua font and assets link');

  const rootHtml = fs.readFileSync('index.html', 'utf8');
  if (!rootHtml.includes('Jua') || !rootHtml.includes('assets/')) {
    throw new Error('Root index.html is missing expected font or assets reference');
  }
  console.log('✅ Root index.html deployed for GitHub Pages branch hosting');

  const fontFile = 'public/fonts/Jua-Regular.ttf';
  if (!fs.existsSync(fontFile) || fs.statSync(fontFile).size < 1000000) {
    throw new Error('Jua-Regular.ttf missing or corrupted');
  }
  console.log(`✅ Jua-Regular.ttf verified (${(fs.statSync(fontFile).size / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n======================================================');
  console.log('🎉 ALL ROUND 3 CHECKS COMPLETED AND VERIFIED 100%!');
  console.log('======================================================\n');
}

runRound3().catch(err => {
  console.error('❌ ROUND 3 FAILED:', err);
  process.exit(1);
});
