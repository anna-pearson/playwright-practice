// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA FACTORY
// Generates realistic, randomized test data for track creation. Avoids
// hardcoded magic strings scattered across test files and makes tests more
// readable: `createTrack({ bpm: 200 })` vs. a 10-field object literal.
// ─────────────────────────────────────────────────────────────────────────────

const TITLES = [
  'Neon Pulse', 'Deep Current', 'Crystal Waves', 'Shadow Frequencies',
  'Velvet Thunder', 'Analog Sunrise', 'Digital Rain', 'Cosmic Drift',
  'Urban Echo', 'Phantom Signal', 'Solar Flare', 'Magnetic North',
];

const ARTISTS = [
  'DJ Testsuite', 'MC Automation', 'The Validators', 'Null Pointer',
  'Async Await', 'Runtime Error', 'Stack Overflow', 'Pixel Drift',
];

const GENRES = [
  'Deep House', 'Techno', 'Drum & Bass', 'Progressive House',
  'Synthwave', 'UK Garage', 'Ambient', 'Trance',
];

const KEYS = ['Am', 'Bm', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'];

const COLORS = [
  '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4',
  '#f59e0b', '#ec4899', '#6366f1', '#14b8a6',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface TrackData {
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  key: string;
  duration: number;
  freq: number;
  color: string;
}

/** Creates a realistic track object, with optional overrides for specific fields */
export function createTrack(overrides: Partial<TrackData> = {}): TrackData {
  return {
    title: pick(TITLES),
    artist: pick(ARTISTS),
    bpm: 100 + Math.floor(Math.random() * 80), // 100–180
    genre: pick(GENRES),
    key: pick(KEYS),
    duration: 10 + Math.floor(Math.random() * 25), // 10–35 seconds
    freq: 100 + Math.floor(Math.random() * 400), // 100–500 Hz
    color: pick(COLORS),
    ...overrides,
  };
}

/** Creates an array of N unique tracks */
export function createTracks(count: number, overrides: Partial<TrackData> = {}): TrackData[] {
  return Array.from({ length: count }, (_, i) => createTrack({
    title: `${pick(TITLES)} ${i + 1}`,
    ...overrides,
  }));
}

/** Creates a track with intentionally invalid data for negative testing */
export function createInvalidTrack(
  type: 'no-title' | 'no-artist' | 'empty-title' | 'empty-artist' | 'wrong-types'
): Partial<TrackData> {
  const base = createTrack();
  switch (type) {
    case 'no-title':
      const { title: _t, ...noTitle } = base;
      return noTitle;
    case 'no-artist':
      const { artist: _a, ...noArtist } = base;
      return noArtist;
    case 'empty-title':
      return { ...base, title: '' };
    case 'empty-artist':
      return { ...base, artist: '' };
    case 'wrong-types':
      return { title: 123 as any, artist: true as any, bpm: 'fast' as any };
  }
}
