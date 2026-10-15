/**
 * YouTube oEmbed API를 활용하여 YouTube 영상 제목을 무료 및 무제한으로 빠르게 가져옵니다.
 */
export async function fetchYoutubeVideoTitle(url: string): Promise<string> {
  if (!url) return '';
  const cleanUrl = url.trim();

  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        return cleanVideoTitle(data.title);
      }
    }
  } catch (e) {
    try {
      const res2 = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.title) {
          return cleanVideoTitle(data2.title);
        }
      }
    } catch (e2) {}
  }
  return '';
}

/**
 * 유튜브 영상 제목에서 불필요한 태그 제거 (예: [Official Video], (4K), | 어노인팅 등 정리)
 */
function cleanVideoTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^\)]*(?:official|가사|lyric|live|라이브|특송|찬양)[^\)]*\)/gi, '')
    .trim();
}

export interface ExtractedSetlistItem {
  url: string;
  userTextTitle: string;
  videoTitle: string;
}

/**
 * 콘티 텍스트에서 라인별로 곡명 및 유튜브 링크 추출
 */
export async function parseSetlistTextWithTitles(rawText: string): Promise<ExtractedSetlistItem[]> {
  const youtubeUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]+|shorts\/[^\s]+)|youtu\.be\/[^\s]+))/gi;
  const lines = rawText.split('\n');
  const items: ExtractedSetlistItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(youtubeUrlRegex);
    if (match && match[0]) {
      const url = match[0];
      // URL 앞부분 텍스트에서 곡명 추정 (예: "1. 꽃들도 - ", "주를 기억하라 : ")
      let textBefore = trimmed.substring(0, trimmed.indexOf(url)).trim();
      textBefore = textBefore.replace(/^[0-9]+[\.\-\)\s]+/, '').replace(/[\:\-\|\=]+$/, '').trim();

      items.push({
        url,
        userTextTitle: textBefore,
        videoTitle: '',
      });
    }
  }

  // 한 줄에 여러 개 있거나 줄바꿈 없는 경우 대비
  if (items.length === 0) {
    let m;
    while ((m = youtubeUrlRegex.exec(rawText)) !== null) {
      items.push({
        url: m[1],
        userTextTitle: '',
        videoTitle: '',
      });
    }
  }

  // 유튜브 영상 제목 비동기 병렬 조회
  await Promise.all(
    items.map(async (item) => {
      const title = await fetchYoutubeVideoTitle(item.url);
      item.videoTitle = title;
    })
  );

  return items;
}
