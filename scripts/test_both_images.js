import fs from 'fs';

async function testImage(filename) {
  const buf = fs.readFileSync(`c:/Users/yoonj/Desktop/Praise Develope/${filename}`);
  const b64 = buf.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  const promptText = `
@@ 너는 찬양팀 악보 및 음악 화성학 최고 전문가 AI야.
첨부된 찬양 악보 이미지를 정밀 분석해서 인쇄된 모든 음악 코드를 추출하고 정확한 조성을 찾아줘.

[엄격한 분석 및 좌표 규칙]
1. "detectedKey": 악보의 원본 조성 (조표의 샵/플랫 개수와 첫/마지막 으뜸음을 분석하여 "A", "G", "C", "D", "E", "F", "Bb", "Eb" 등으로 정확히 판별).
2. "chords": 오선보(Staff) 바로 위에 인쇄된 영문 코드만 위에서부터 순서대로 정확히 추출해.
   - 실제 악보에 인쇄되어 있는 코드만 추출하고, 없는 코드를 임의로 지어내거나 추측해서 채우지 마!
   - 2마디 동안 코드가 1개면 1개만 추출해.
   - 악보 바깥 우측이나 하단의 곡 순서/가사 메모(Intro, V, PC, 드럼 in 등 설명 텍스트)는 악보 코드가 아니므로 절대 chords에 포함하지 마!
   - 각 코드 글자의 위치 비율(0.0 ~ 1.0)을 측정해줘:
     * xPercent: 전체 이미지 가로 기준 해당 코드 글자의 중심 X 비율 (0.00 ~ 1.00)
     * yPercent: 전체 이미지 세로 기준 해당 코드 글자의 중심 Y 비율 (0.00 ~ 1.00)

반드시 순수 JSON 객체만 응답해:
{
  "detectedKey": "A",
  "chords": [
    { "chordText": "A", "xPercent": 0.12, "yPercent": 0.18 },
    { "chordText": "E", "xPercent": 0.35, "yPercent": 0.18 }
  ]
}
`.trim();

  console.log(`[TEST] Testing ${filename} with model gemini-3.1-pro...`);
  const start = Date.now();
  try {
    const res = await fetch('https://debian.tailfdf16c.ts.net/v1/chat/completions', {
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
      }),
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[TEST] ${filename} Status: ${res.status} (Elapsed: ${elapsed}s)`);
    const json = await res.json();
    console.log(`[TEST] ${filename} Response:`, JSON.stringify(json).substring(0, 300));
  } catch (err) {
    console.error(`[TEST] ${filename} Error:`, err);
  }
}

async function run() {
  await testImage('IMG_7588.JPG');
  await testImage('IMG_7589.JPG');
}

run();
