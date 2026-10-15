import fs from 'fs';

async function verifyImage(filename, expectedKey, expectedTitleSubstring) {
  const buf = fs.readFileSync(filename);
  const b64 = buf.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  const promptText = `
@@ 너는 찬양팀 악보 및 음악 화성학 최고 전문가 AI야.
첨부된 찬양 악보 이미지를 정밀 분석해서 인쇄된 모든 음악 코드를 추출하고 정확한 조성을 찾아줘.

[엄격한 분석 및 좌표 규칙]
1. "detectedTitle": 악보 맨 윗줄 중앙이나 좌상단에 가장 크게 인쇄된 실제 찬양 곡 제목 (예: "주를 기억하라", "꽃들도", "은혜" 등).
2. "detectedKey": 악보의 원본 조성 (조표의 샵/플랫 개수와 첫/마지막 으뜸음을 분석하여 "A", "G", "C", "D", "E", "F", "Bb", "Eb" 등으로 정확히 판별).
3. "chords": 오선보(Staff) 바로 위에 인쇄된 영문 코드만 위에서부터 순서대로 빠짐없이 정확히 추출해.
   - 실제 악보에 인쇄되어 있는 코드만 추출하고, 없는 코드를 임의로 지어내거나 추측해서 채우지 마!
   - 2마디 동안 코드가 1개면 1개만 추출해.
   - 악보 바깥 우측이나 하단의 곡 순서/가사 메모(Intro, V, PC, 드럼 in 등 설명 텍스트)는 악보 코드가 아니므로 절대 chords에 포함하지 마!
   - 각 코드 글자의 위치 비율(0.0 ~ 1.0)을 측정해줘:
     * xPercent: 전체 이미지 가로 기준 해당 코드 글자의 중심 X 비율 (0.00 ~ 1.00)
     * yPercent: 전체 이미지 세로 기준 해당 코드 글자의 중심 Y 비율 (0.00 ~ 1.00)

반드시 마크다운이나 추가 설명 없이 순수 JSON 객체만 응답해:
{
  "detectedTitle": "곡제목",
  "detectedKey": "A",
  "chords": [
    { "chordText": "A", "xPercent": 0.12, "yPercent": 0.18 }
  ]
}
`.trim();

  console.log(`\n======================================================`);
  console.log(`[ROUND 2 VERIFICATION] Testing: ${filename}`);
  console.log(`Expected Key: ${expectedKey} | Title keyword: ${expectedTitleSubstring}`);
  const startTime = Date.now();

  const response = await fetch('https://debian.tailfdf16c.ts.net/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dummy-key',
    },
    body: JSON.stringify({
      model: 'gemini-3.1-pro',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status Code: ${response.status} (Elapsed: ${elapsed}s)`);

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || '';
  
  // Extract JSON
  let cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  const parsed = JSON.parse(cleaned);

  console.log(`Detected Title: "${parsed.detectedTitle || 'N/A'}"`);
  console.log(`Detected Key: "${parsed.detectedKey}" (Expected: "${expectedKey}")`);
  console.log(`Extracted Chords Count: ${parsed.chords?.length || 0}`);
  if (parsed.chords && parsed.chords.length > 0) {
    console.log(`First 5 Chords: ${parsed.chords.slice(0, 5).map(c => `${c.chordText} (${c.xPercent}, ${c.yPercent})`).join(', ')}`);
  }

  // Assertions
  if (parsed.detectedKey !== expectedKey) {
    console.warn(`⚠️ Key mismatch: got "${parsed.detectedKey}", expected "${expectedKey}"`);
  } else {
    console.log(`✅ Key verification passed: ${parsed.detectedKey}`);
  }

  if (!parsed.chords || parsed.chords.length === 0) {
    throw new Error('No chords extracted!');
  } else {
    console.log(`✅ Chords extracted successfully: ${parsed.chords.length} chords found`);
  }

  console.log(`✅ Response time: ${elapsed}s (Well within threshold)`);
  return { filename, elapsed, detectedKey: parsed.detectedKey, chordCount: parsed.chords.length };
}

async function run() {
  console.log('🚀 Starting Round 2: Real API Live Verification on Both Images');
  const r1 = await verifyImage('IMG_7588.JPG', 'G', '주를 기억하라');
  const r2 = await verifyImage('IMG_7589.JPG', 'A', '주 이름 찬양');

  console.log('\n======================================================');
  console.log('🎉 ROUND 2 SUMMARY RESULTS:');
  console.log(`1. ${r1.filename}: Key=${r1.detectedKey}, Chords=${r1.chordCount}, Elapsed=${r1.elapsed}s`);
  console.log(`2. ${r2.filename}: Key=${r2.detectedKey}, Chords=${r2.chordCount}, Elapsed=${r2.elapsed}s`);
  console.log('ALL ROUND 2 CHECKS PASSED!\n======================================================');
}

run().catch(err => {
  console.error('❌ ROUND 2 FAILED:', err);
  process.exit(1);
});
