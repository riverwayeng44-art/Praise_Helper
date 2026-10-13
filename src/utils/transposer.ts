// 음악 화성학 전조(Transposition) 엔진

export const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_KEYS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const STANDARD_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// 기본 조별 선호 표기법 (플랫/샾 조 구분)
export const FLAT_DOMINANT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']);

/**
 * 음계 이름을 0~11 세미톤 인덱스로 변환
 */
export function noteToSemitone(note: string): number {
  const cleanNote = note.trim();
  // 정규화 (B# -> C, E# -> F, Cb -> B, Fb -> E)
  if (cleanNote === 'B#') return 0;
  if (cleanNote === 'Cb') return 11;
  if (cleanNote === 'E#') return 5;
  if (cleanNote === 'Fb') return 4;

  const sharpIndex = SHARP_KEYS.indexOf(cleanNote);
  if (sharpIndex !== -1) return sharpIndex;

  const flatIndex = FLAT_KEYS.indexOf(cleanNote);
  if (flatIndex !== -1) return flatIndex;

  return 0;
}

/**
 * 세미톤 인덱스를 음 이름으로 변환
 */
export function semitoneToNote(semitone: number, preferFlat = false): string {
  const normalized = ((semitone % 12) + 12) % 12;
  return preferFlat ? FLAT_KEYS[normalized] : SHARP_KEYS[normalized];
}

/**
 * 두 키 간의 반음 차이 계산 (fromKey -> toKey)
 */
export function getSemitoneDiff(fromKey: string, toKey: string): number {
  if (!fromKey || !toKey) return 0;

  // 루트 음만 추출 (예: "Am" -> "A", "F#m" -> "F#")
  const rootFrom = extractRootNote(fromKey);
  const rootTo = extractRootNote(toKey);

  const semiFrom = noteToSemitone(rootFrom);
  const semiTo = noteToSemitone(rootTo);

  let diff = (semiTo - semiFrom) % 12;
  if (diff > 6) diff -= 12; // 최단 거리 (예: +7 대신 -5)
  if (diff < -6) diff += 12;
  return diff;
}

/**
 * 코드나 키에서 루트 음(예: "A", "F#", "Bb")을 추출
 */
export function extractRootNote(text: string): string {
  const match = text.match(/^[A-G][#b]?/);
  return match ? match[0] : 'C';
}

/**
 * 단일 음표(Note) 전조
 */
export function transposeNote(note: string, semitones: number, preferFlat = false): string {
  const originalIndex = noteToSemitone(note);
  const newIndex = originalIndex + semitones;
  return semitoneToNote(newIndex, preferFlat);
}

/**
 * 복합 코드(Chord) 전조 (예: "A/C#" -> +2 -> "B/D#", "F#m7" -> "G#m7")
 */
export function transposeChord(chord: string, semitones: number, preferFlat = false): string {
  if (!chord || semitones === 0) return chord;

  const trimmed = chord.trim();

  // 분수 코드 (Slash chord) 분리: 예: A/C#
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const mainChord = transposeChord(parts[0], semitones, preferFlat);
      const bassNote = parts[1].trim();
      const matchBass = bassNote.match(/^[A-G][#b]?/);
      if (matchBass) {
        const transposedBass = transposeNote(matchBass[0], semitones, preferFlat);
        const restBass = bassNote.substring(matchBass[0].length);
        return `${mainChord}/${transposedBass}${restBass}`;
      }
      return `${mainChord}/${bassNote}`;
    }
  }

  // 루트 음과 나머지 코드 성질 분리 (예: "F#m7" -> root: "F#", suffix: "m7")
  const match = trimmed.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return trimmed;

  const root = match[1];
  const suffix = match[2];

  const transposedRoot = transposeNote(root, semitones, preferFlat);
  return `${transposedRoot}${suffix}`;
}

/**
 * 타겟 키에 맞춰 코드 리스트 전체를 전조
 */
export function transposeAllChords(
  chords: { chordText: string; [key: string]: any }[],
  fromKey: string,
  toKey: string
) {
  const semitones = getSemitoneDiff(fromKey, toKey);
  const preferFlat = FLAT_DOMINANT_KEYS.has(toKey);

  return chords.map((c) => ({
    ...c,
    chordText: transposeChord(c.chordText, semitones, preferFlat),
  }));
}
