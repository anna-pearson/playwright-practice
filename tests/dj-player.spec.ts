import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubAudio } from './helpers/stub-audio';

// Reset server state before each test so API mutations don't leak between files
test.beforeEach(async ({ request }) => {
  await request.post('/api/tracks/reset');
});


// ─────────────────────────────────────────────────────────────────────────────
// Page Object
// Centralises locators so every test can refer to them by name instead of
// repeating selector strings throughout the file.
// ─────────────────────────────────────────────────────────────────────────────
class DjPlayerPage {
  constructor(private readonly page: Page) {}

  // ── Navigation ──────────────────────────────────────────────────────────
  async goto() {
    await this.page.goto('/');
    await this.page.getByRole('listitem').first().waitFor();
  }

  // ── Now-playing panel ───────────────────────────────────────────────────
  get nowPlayingSection() {
    return this.page.locator('section[aria-label="Now playing"]');
  }
  get trackTitle() { return this.page.locator('.track-title'); }
  get trackArtist() { return this.page.locator('.track-artist'); }
  get metaBpm()    { return this.page.locator('.meta-bpm'); }
  get metaGenre()  { return this.page.locator('.meta-genre'); }
  get metaKey()    { return this.page.locator('.meta-key'); }
  get waveform()   { return this.page.locator('canvas.waveform'); }

  // ── Transport ────────────────────────────────────────────────────────────
  get transportSection() {
    return this.page.locator('section[aria-label="Playback controls"]');
  }
  // Use exact: true so "Unmute" does not accidentally match "Mute"
  get btnPlay()    { return this.page.getByRole('button', { name: 'Play', exact: true }); }
  get btnPause()   { return this.page.getByRole('button', { name: 'Pause', exact: true }); }
  get btnNext()    { return this.page.getByRole('button', { name: 'Next track' }); }
  get btnPrev()    { return this.page.getByRole('button', { name: 'Previous track' }); }
  get seekSlider() { return this.page.getByRole('slider', { name: 'Seek' }); }
  get timeCurrent(){ return this.page.locator('.time-current'); }
  get timeDuration(){ return this.page.locator('.time-duration'); }
  get progressFill(){ return this.page.locator('.progress-fill'); }

  // ── Volume ───────────────────────────────────────────────────────────────
  // exact: true prevents "Mute" from matching "Unmute" (substring issue)
  get btnMute()      { return this.page.getByRole('button', { name: 'Mute', exact: true }); }
  get btnUnmute()    { return this.page.getByRole('button', { name: 'Unmute', exact: true }); }
  get volumeSlider() { return this.page.getByRole('slider', { name: 'Volume' }); }
  get volumeValue()  { return this.page.locator('.volume-value'); }

  // ── Library ──────────────────────────────────────────────────────────────
  get librarySection() {
    return this.page.locator('section[aria-label="Track library"]');
  }
  get searchInput() {
    return this.page.getByRole('searchbox', { name: 'Search tracks' });
  }
  get genreGroup() {
    return this.page.getByRole('group', { name: 'Filter by genre' });
  }
  get trackItems() { return this.page.getByRole('listitem'); }
  get noResults()  { return this.page.locator('.no-results'); }
  get appRoot()    { return this.page.locator('.app'); }

  // ── Helpers ──────────────────────────────────────────────────────────────
  trackItem(index: number)   { return this.trackItems.nth(index); }
  genreBtn(name: string)     { return this.page.getByRole('button', { name }); }

  async clickTrack(index: number) {
    await this.trackItem(index).click();
  }

  async startPlayback() {
    await this.btnPlay.click();
  }

  /** Fire the 'ended' event on the currently active stubbed audio instance */
  async fireEnded() {
    await this.page.evaluate(() => {
      const inst = (window as any).__stubAudioInstance as HTMLAudioElement | undefined;
      if (inst) {
        inst.dispatchEvent(new Event('ended'));
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · PAGE LOAD & INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Page load & initial state', () => {
  test('@smoke page has the correct title', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page).toHaveTitle('MixDeck — DJ Mix Player');
  });

  test('header shows the MixDeck logo and tagline', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.getByRole('heading', { level: 1, name: 'MixDeck' })).toBeVisible();
    await expect(page.getByText('DJ Mix Player')).toBeVisible();
  });

  test('defaults to "No track selected"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.trackTitle).toHaveText('No track selected');
    await expect(player.trackArtist).toHaveText('');
  });

  test('BPM, genre and key meta fields are empty on load', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.metaBpm).toHaveText('');
    await expect(player.metaGenre).toHaveText('');
    await expect(player.metaKey).toHaveText('');
  });

  test('progress bar starts at 0:00 / 0:00', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.timeCurrent).toHaveText('0:00');
    await expect(player.timeDuration).toHaveText('0:00');
  });

  test('play button is visible and labelled "Play" initially', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.btnPlay).toBeVisible();
  });

  test('pause icon is hidden initially', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.locator('.icon-pause')).not.toBeVisible();
  });

  test('volume slider defaults to 80', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.volumeSlider).toHaveValue('80');
    await expect(player.volumeValue).toHaveText('80%');
  });

  test('mute button is visible and labelled "Mute"', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.btnMute).toBeVisible();
  });

  test('@smoke all six tracks are rendered in the tracklist', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.trackItems).toHaveCount(6);
  });

  test('"No results" message is hidden on load', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.noResults).not.toBeVisible();
  });

  test('"All" genre filter is active by default', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.genreBtn('All')).toHaveClass(/active/);
  });

  test('waveform canvas is present', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.waveform).toBeVisible();
  });

  test('app root does NOT have the "playing" class initially', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.appRoot).not.toHaveClass(/playing/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · TRACKLIST — CONTENT & STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Tracklist — content & structure', () => {
  const expectedTracks = [
    { title: 'Midnight Sessions', artist: 'DJ Anna P', bpm: '122', genre: 'Deep House',        key: 'Am', duration: '0:20' },
    { title: 'Warehouse Echoes',  artist: 'DJ Anna P', bpm: '138', genre: 'Techno',             key: 'Dm', duration: '0:25' },
    { title: 'Liquid Sunshine',   artist: 'DJ Anna P', bpm: '174', genre: 'Drum & Bass',        key: 'Fm', duration: '0:15' },
    { title: 'Cloud Nine',        artist: 'DJ Anna P', bpm: '128', genre: 'Progressive House',  key: 'Cm', duration: '0:30' },
    { title: 'Neon Dreams',       artist: 'DJ Anna P', bpm: '110', genre: 'Synthwave',          key: 'Em', duration: '0:20' },
    { title: 'Bass Culture',      artist: 'DJ Anna P', bpm: '130', genre: 'UK Garage',          key: 'Gm', duration: '0:18' },
  ];

  for (const [i, track] of expectedTracks.entries()) {
    test(`track ${i + 1} — "${track.title}" shows correct metadata`, async ({ page }) => {
      const player = new DjPlayerPage(page);
      await player.goto();
      const item = player.trackItem(i);
      await expect(item.locator('.item-title')).toHaveText(track.title);
      await expect(item.locator('.item-artist')).toHaveText(track.artist);
      await expect(item.locator('.item-bpm')).toHaveText(track.bpm);
      await expect(item.locator('.item-genre')).toHaveText(track.genre);
      await expect(item.locator('.item-key')).toHaveText(track.key);
      await expect(item.locator('.item-duration')).toHaveText(track.duration);
    });
  }

  test('tracklist header shows all column labels', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    const header = page.locator('.tracklist-header');
    await expect(header.locator('.col-title')).toHaveText('Title');
    await expect(header.locator('.col-bpm')).toHaveText('BPM');
    await expect(header.locator('.col-genre')).toHaveText('Genre');
    await expect(header.locator('.col-key')).toHaveText('Key');
    await expect(header.locator('.col-duration')).toHaveText('Duration');
  });

  test('each track item has a tabindex so it is keyboard reachable', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    const items = player.trackItems;
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('tabindex', '0');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · TRACK SELECTION
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Track selection', () => {
  test('@smoke clicking a track loads it into the "Now Playing" panel', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
    await expect(player.trackArtist).toHaveText('DJ Anna P');
    await expect(player.metaBpm).toHaveText('122');
    await expect(player.metaGenre).toHaveText('Deep House');
    await expect(player.metaKey).toHaveText('Am');
  });

  test('clicking the third track loads its details', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);

    await expect(player.trackTitle).toHaveText('Liquid Sunshine');
    await expect(player.metaBpm).toHaveText('174');
    await expect(player.metaGenre).toHaveText('Drum & Bass');
    await expect(player.metaKey).toHaveText('Fm');
  });

  test('clicking a track marks it as "active" in the list', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(1);
    await expect(player.trackItem(1)).toHaveClass(/active/);
  });

  test('previously active track loses the "active" class', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.clickTrack(3);

    await expect(player.trackItem(0)).not.toHaveClass(/active/);
    await expect(player.trackItem(3)).toHaveClass(/active/);
  });

  test('only one track is active at a time', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.clickTrack(4);

    const activeItems = page.locator('.tracklist-item.active');
    await expect(activeItems).toHaveCount(1);
  });

  test('pressing Enter on a focused track loads it', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.trackItem(3).focus();
    await page.keyboard.press('Enter');

    await expect(player.trackTitle).toHaveText('Cloud Nine');
  });

  test('pressing Space on a focused track loads it', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.trackItem(4).focus();
    await page.keyboard.press('Space');

    await expect(player.trackTitle).toHaveText('Neon Dreams');
  });

  test('clicking a track starts playback automatically', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);

    await expect(player.btnPause).toBeVisible();
    await expect(player.appRoot).toHaveClass(/playing/);
  });

  test('track duration appears in the transport bar after loading', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0); // duration 20 s
    await expect(player.timeDuration).toHaveText('0:20');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · PLAYBACK CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Playback controls', () => {
  test('pressing Play with no track loads and plays the first track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
    await expect(player.btnPause).toBeVisible();
  });

  test('@smoke play icon hides and pause icon appears when playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    await expect(page.locator('.icon-play')).not.toBeVisible();
    await expect(page.locator('.icon-pause')).toBeVisible();
  });

  test('pause icon hides and play icon returns after pausing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();
    await player.btnPause.click();

    await expect(page.locator('.icon-play')).toBeVisible();
    await expect(page.locator('.icon-pause')).not.toBeVisible();
  });

  test('app gains "playing" class on play', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    await expect(player.appRoot).toHaveClass(/playing/);
  });

  test('app loses "playing" class on pause', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();
    await player.btnPause.click();

    await expect(player.appRoot).not.toHaveClass(/playing/);
  });

  test('Next track advances to the second track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.btnNext.click();

    await expect(player.trackTitle).toHaveText('Warehouse Echoes');
  });

  test('Next track wraps around from the last track to the first', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(5); // Bass Culture (last)
    await player.btnNext.click();

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
  });

  test('Previous track goes back one track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);
    await player.btnPrev.click();

    await expect(player.trackTitle).toHaveText('Warehouse Echoes');
  });

  test('Previous track wraps from the first track to the last', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    // Ensure currentTime is under 3s so Prev goes to previous track, not restart
    await page.evaluate(() => {
      const inst = (window as any).__stubAudioInstance;
      if (inst) inst.currentTime = 0;
    });
    await player.btnPrev.click();

    await expect(player.trackTitle).toHaveText('Bass Culture');
  });

  test('track progresses: current time advances while playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    // Wait for simulated time to tick at least once
    await expect(player.timeCurrent).not.toHaveText('0:00', { timeout: 3000 });
  });

  test('progress bar fill width increases while playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    await expect(async () => {
      const width = await player.progressFill.evaluate((el) =>
        parseFloat((el as HTMLElement).style.width));
      expect(width).toBeGreaterThan(0);
    }).toPass({ timeout: 4000, intervals: [300, 500, 500, 500] });
  });

  test('track auto-advances to next when it ends', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    // Load the first track and start playback so the stub instance is set
    await player.clickTrack(0);

    // Fire the 'ended' event on the stubbed audio instance via the exposed reference
    await player.fireEnded();

    // After ended fires, the player's onTrackEnd → nextTrack() loads track 2
    await expect(player.trackTitle).toHaveText('Warehouse Echoes', { timeout: 3000 });
  });

  test('seek slider aria-valuenow updates as track plays', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    await expect(async () => {
      const val = await player.seekSlider.getAttribute('aria-valuenow');
      expect(Number(val)).toBeGreaterThan(0);
    }).toPass({ timeout: 4000, intervals: [300, 500, 500, 500] });
  });

  test('clicking Next while paused still advances the track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(1);
    await player.btnPause.click();
    await player.btnNext.click();

    await expect(player.trackTitle).toHaveText('Liquid Sunshine');
  });

  test('Previous restarts the current track if playback is past 3 seconds', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2); // Liquid Sunshine
    // Seek past the 3-second threshold using the stub instance
    await page.evaluate(() => {
      (window as any).__stubAudioInstance.currentTime = 5;
    });
    await player.btnPrev.click();

    // Track should stay the same (restart, not go to previous)
    await expect(player.trackTitle).toHaveText('Liquid Sunshine');
    await expect(player.timeCurrent).toHaveText('0:00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · SEEKING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Seeking', () => {
  test('ArrowRight seeks forward by 5 seconds', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    // Snapshot time just before seeking
    const before = await page.evaluate(() => (window as any).__stubAudioInstance.currentTime);
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => (window as any).__stubAudioInstance.currentTime);

    // ArrowRight adds 5s — allow small slack for the stub's interval
    expect(after - before).toBeGreaterThanOrEqual(4.5);
    expect(after - before).toBeLessThanOrEqual(6);
  });

  test('ArrowLeft seeks backward by 5 seconds', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    // Seek forward twice first so we have room to go back
    await page.keyboard.press('ArrowRight'); // +5
    await page.keyboard.press('ArrowRight'); // +5
    const before = await page.evaluate(() => (window as any).__stubAudioInstance.currentTime);
    await page.keyboard.press('ArrowLeft');  // -5
    const after = await page.evaluate(() => (window as any).__stubAudioInstance.currentTime);

    expect(before - after).toBeGreaterThanOrEqual(4.5);
    expect(before - after).toBeLessThanOrEqual(6);
  });

  test('seek slider has correct aria attributes', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await expect(player.seekSlider).toHaveAttribute('aria-valuemin', '0');
    await expect(player.seekSlider).toHaveAttribute('aria-valuemax', '100');
    await expect(player.seekSlider).toHaveAttribute('aria-valuenow', '0');
  });

  test('clicking the progress bar seeks to that position', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    // Click the middle of the progress bar to seek to ~50%
    const progressTrack = page.locator('.progress-track');
    const box = await progressTrack.boundingBox();
    if (!box) throw new Error('Progress bar not found');

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // Time should be roughly half the track duration (20s → ~10s)
    await expect(player.timeCurrent).not.toHaveText('0:00');
    const time = await player.timeCurrent.textContent();
    const [min, sec] = time!.split(':').map(Number);
    const totalSec = min * 60 + sec;
    expect(totalSec).toBeGreaterThanOrEqual(8);
    expect(totalSec).toBeLessThanOrEqual(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 · VOLUME CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Volume controls', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
  });

  test('dragging the volume slider to 50 shows "50%"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('50');
    await expect(player.volumeValue).toHaveText('50%');
  });

  test('dragging the volume slider to 0 shows "0%"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('0');
    await expect(player.volumeValue).toHaveText('0%');
  });

  test('dragging the volume slider to 100 shows "100%"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('100');
    await expect(player.volumeValue).toHaveText('100%');
  });

  test('Mute button sets volume display to 0%', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.btnMute.click();
    await expect(player.volumeValue).toHaveText('0%');
    await expect(player.volumeSlider).toHaveValue('0');
  });

  test('Mute button label changes to "Unmute" after clicking', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // The mute button's aria-label changes from "Mute" to "Unmute" on the
    // same DOM element. We verify by checking the aria-label attribute directly.
    await player.btnMute.click();
    await expect(page.locator('.btn-mute')).toHaveAttribute('aria-label', 'Unmute');
  });

  test('mute icon switches to muted icon', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.btnMute.click();
    await expect(page.locator('.icon-vol-on')).not.toBeVisible();
    await expect(page.locator('.icon-vol-off')).toBeVisible();
  });

  test('Unmute restores the previous volume level', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.btnMute.click();
    // After muting, the same btn-mute element now has aria-label="Unmute"
    // so btnUnmute (exact match) finds it correctly
    await player.btnUnmute.click();

    await expect(player.volumeValue).toHaveText('80%');
    await expect(player.volumeSlider).toHaveValue('80');
  });

  test('unmuting restores the volume icon to the "on" state', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.btnMute.click();
    await player.btnUnmute.click();

    await expect(page.locator('.icon-vol-on')).toBeVisible();
    await expect(page.locator('.icon-vol-off')).not.toBeVisible();
  });

  test('setting slider to 0 changes mute button label to "Unmute"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('0');
    await expect(page.locator('.btn-mute')).toHaveAttribute('aria-label', 'Unmute');
  });

  test('raising slider above 0 after muting changes label back to "Mute"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('0');
    await player.volumeSlider.fill('60');
    await expect(page.locator('.btn-mute')).toHaveAttribute('aria-label', 'Mute');
  });

  test('mute then unmute preserves a custom volume level', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('40');
    await player.btnMute.click();
    await player.btnUnmute.click();

    await expect(player.volumeValue).toHaveText('40%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6b · MOBILE RESPONSIVE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mobile responsive', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile-only tests');
  });

  test('volume controls are hidden on mobile', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.locator('.volume-row')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7 · SEARCH
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Search', () => {
  test('search box has the correct placeholder text', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.searchInput).toHaveAttribute('placeholder', 'Search mixes...');
  });

  test('@smoke typing filters the tracklist by title', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('midnight');
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Midnight Sessions');
  });

  test('typing filters by artist name', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // All tracks share the same artist – should return all 6
    await player.searchInput.fill('DJ Anna');
    await expect(player.trackItems).toHaveCount(6);
  });

  test('typing filters by genre', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('techno');
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Warehouse Echoes');
  });

  test('typing filters by musical key', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('Gm');
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Bass Culture');
  });

  test('search is case-insensitive', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('LIQUID SUNSHINE');
    await expect(player.trackItems).toHaveCount(1);
  });

  test('partial title match works', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('neon');
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Neon Dreams');
  });

  test('clearing the search shows all 6 tracks again', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // "synthwave" uniquely matches only Neon Dreams (1 result)
    await player.searchInput.fill('synthwave');
    await expect(player.trackItems).toHaveCount(1);

    await player.searchInput.clear();
    await expect(player.trackItems).toHaveCount(6);
  });

  test('a query that matches nothing shows the "No tracks" message', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('xyzxyzxyz');
    await expect(player.trackItems).toHaveCount(0);
    await expect(player.noResults).toBeVisible();
    await expect(player.noResults).toHaveText('No tracks match your search.');
  });

  test('"No tracks" message disappears after clearing the query', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.fill('xyzxyzxyz');
    await expect(player.noResults).toBeVisible();

    await player.searchInput.clear();
    await expect(player.noResults).not.toBeVisible();
  });

  test('single-character query shows matching tracks', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // 'Fm' key — searching 'f' should match Liquid Sunshine's key
    await player.searchInput.fill('f');
    // At minimum Liquid Sunshine (key Fm) and Drum & Bass (contains 'f') match
    const count = await player.trackItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('"bass culture" uniquely matches the UK Garage track', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // Use full title to ensure a unique match — "bass" alone also hits "Drum & Bass"
    await player.searchInput.fill('bass culture');
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Bass Culture');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8 · GENRE FILTERS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Genre filters', () => {
  const genreScenarios: Array<{ label: string; genre: string; expectedTitle: string }> = [
    { label: 'Deep House',        genre: 'Deep House',       expectedTitle: 'Midnight Sessions' },
    { label: 'Techno',            genre: 'Techno',           expectedTitle: 'Warehouse Echoes'  },
    { label: 'DnB',               genre: 'Drum & Bass',      expectedTitle: 'Liquid Sunshine'   },
    { label: 'Progressive',       genre: 'Progressive House',expectedTitle: 'Cloud Nine'        },
    { label: 'Synthwave',         genre: 'Synthwave',        expectedTitle: 'Neon Dreams'       },
    { label: 'Garage',            genre: 'UK Garage',        expectedTitle: 'Bass Culture'      },
  ];

  for (const { label, expectedTitle } of genreScenarios) {
    test(`clicking "${label}" shows only that genre's track`, async ({ page }) => {
      const player = new DjPlayerPage(page);
      await player.goto();

      await player.genreBtn(label).click();
      await expect(player.trackItems).toHaveCount(1);
      await expect(player.trackItem(0).locator('.item-title')).toHaveText(expectedTitle);
    });
  }

  test('@smoke clicking a genre marks it as "active"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await expect(player.genreBtn('Techno')).toHaveClass(/active/);
    await expect(player.genreBtn('All')).not.toHaveClass(/active/);
  });

  test('only one genre button is active at a time', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await player.genreBtn('Synthwave').click();

    await expect(player.genreBtn('Techno')).not.toHaveClass(/active/);
    await expect(player.genreBtn('Synthwave')).toHaveClass(/active/);
  });

  test('clicking "All" after a filter restores all 6 tracks', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await expect(player.trackItems).toHaveCount(1);

    await player.genreBtn('All').click();
    await expect(player.trackItems).toHaveCount(6);
    await expect(player.genreBtn('All')).toHaveClass(/active/);
  });

  test('genre filter combines with search — both must match', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Progressive').click();
    await player.searchInput.fill('cloud');

    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0).locator('.item-title')).toHaveText('Cloud Nine');
  });

  test('genre filter + mismatching search shows "No tracks" message', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await player.searchInput.fill('zzz_nomatch'); // no track title/artist/genre/key contains this

    await expect(player.trackItems).toHaveCount(0);
    await expect(player.noResults).toBeVisible();
  });

  test('clearing search after a combined filter reverts to genre-only result', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await player.searchInput.fill('zzz_nomatch');
    await expect(player.trackItems).toHaveCount(0);

    await player.searchInput.clear();
    // Techno filter still active → only Warehouse Echoes
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.noResults).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9 · KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Keyboard shortcuts', () => {
  test('Space plays the first track when nothing is selected', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('Space');

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
    await expect(player.btnPause).toBeVisible();
  });

  test('Space pauses a playing track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();
    await page.keyboard.press('Space');

    await expect(player.btnPlay).toBeVisible();
    await expect(player.appRoot).not.toHaveClass(/playing/);
  });

  test('Space does NOT toggle playback when search input is focused', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.focus();
    await page.keyboard.press('Space');

    // Search box should receive the space character; player must stay idle
    await expect(player.trackTitle).toHaveText('No track selected');
  });

  test('Shift+ArrowRight skips to the next track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await page.keyboard.press('Shift+ArrowRight');

    await expect(player.trackTitle).toHaveText('Warehouse Echoes');
  });

  test('Shift+ArrowLeft skips to the previous track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);
    await page.keyboard.press('Shift+ArrowLeft');

    await expect(player.trackTitle).toHaveText('Warehouse Echoes');
  });

  test('ArrowUp increases volume by 5%', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('ArrowUp');
    await expect(player.volumeValue).toHaveText('85%');
  });

  test('ArrowDown decreases volume by 5%', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('ArrowDown');
    await expect(player.volumeValue).toHaveText('75%');
  });

  test('ArrowUp caps volume at 100%', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // 80 → 100 needs 4 presses; press 10 to be sure
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    await expect(player.volumeValue).toHaveText('100%');
  });

  test('ArrowDown caps volume at 0%', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // 80 → 0 needs 16 presses; press 20 to be sure
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown');
    await expect(player.volumeValue).toHaveText('0%');
  });

  test('"m" key mutes', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('m');
    await expect(player.volumeValue).toHaveText('0%');
  });

  test('"m" key unmutes and restores previous volume', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('m');
    await page.keyboard.press('m');
    await expect(player.volumeValue).toHaveText('80%');
  });

  test('"M" (uppercase) also toggles mute', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await page.keyboard.press('M');
    await expect(player.volumeValue).toHaveText('0%');
  });

  test('ArrowUp/ArrowDown do not change volume when search input is focused', async ({ page }) => {
    // The keyboard handler bails early when e.target === searchInput,
    // so ArrowUp/Down are suppressed — volume stays unchanged.
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.focus();
    await page.keyboard.press('ArrowUp');

    // Volume stays at 80% because the handler returned early
    await expect(player.volumeValue).toHaveText('80%');
  });

  test('Shift+ArrowRight wraps around from last to first', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(5); // Bass Culture
    await page.keyboard.press('Shift+ArrowRight');

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10 · ACCESSIBILITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility', () => {
  test('"Now playing" section has an accessible region label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.getByRole('region', { name: 'Now playing' })).toBeVisible();
  });

  test('"Playback controls" section has an accessible region label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.getByRole('region', { name: 'Playback controls' })).toBeVisible();
  });

  test('"Track library" section has an accessible region label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.getByRole('region', { name: 'Track library' })).toBeVisible();
  });

  test('Genre filter group has an accessible label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.getByRole('group', { name: 'Filter by genre' })).toBeVisible();
  });

  test('Seek progress bar has role="slider" and aria-label="Seek"', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.seekSlider).toBeVisible();
  });

  test('Volume slider has aria-label="Volume"', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.volumeSlider).toBeVisible();
  });

  test('Play button has an accessible name', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.btnPlay).toHaveAttribute('aria-label', 'Play');
  });

  test('Pause button aria-label updates to "Pause" when playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();
    await expect(page.locator('.btn-play')).toHaveAttribute('aria-label', 'Pause');
  });

  test('Mute button aria-label updates to "Unmute" when muted', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.btnMute.click();
    await expect(page.locator('.btn-mute')).toHaveAttribute('aria-label', 'Unmute');
  });

  test('Previous track button has an accessible name', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.btnPrev).toHaveAttribute('aria-label', 'Previous track');
  });

  test('Next track button has an accessible name', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.btnNext).toHaveAttribute('aria-label', 'Next track');
  });

  test('Waveform canvas has an accessible aria-label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.waveform).toHaveAttribute('aria-label', 'Audio waveform visualization');
  });

  test('Search input has an accessible label', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.searchInput).toHaveAttribute('aria-label', 'Search tracks');
  });

  test('Track items are keyboard focusable', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.trackItem(0).focus();
    await expect(player.trackItem(0)).toBeFocused();
  });

  test('seek slider aria-valuemin is 0', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.seekSlider).toHaveAttribute('aria-valuemin', '0');
  });

  test('seek slider aria-valuemax is 100', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(player.seekSlider).toHaveAttribute('aria-valuemax', '100');
  });

  test('page language is set to English', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('axe scan: page has no critical accessibility violations', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });

  test('axe scan: page has no serious accessibility violations', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'serious')).toHaveLength(0);
  });

  test('@smoke axe scan: full WCAG 2.1 AA compliance check', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11 · EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Edge cases', () => {
  test('clicking Next with no track loaded plays the first track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    // currentTrackIndex starts at -1; (−1 + 1) % 6 = 0 → first track
    await player.btnNext.click();
    await expect(player.trackTitle).toHaveText('Midnight Sessions');
  });

  test('clicking the same track twice keeps it active', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);
    await player.clickTrack(2);

    await expect(player.trackTitle).toHaveText('Liquid Sunshine');
    await expect(player.trackItem(2)).toHaveClass(/active/);
  });

  test('volume slider min boundary: cannot go below 0', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('0');
    const value = await player.volumeSlider.inputValue();
    expect(Number(value)).toBeGreaterThanOrEqual(0);
    await expect(player.volumeValue).toHaveText('0%');
  });

  test('volume slider max boundary: cannot exceed 100', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.volumeSlider.fill('100');
    const value = await player.volumeSlider.inputValue();
    expect(Number(value)).toBeLessThanOrEqual(100);
    await expect(player.volumeValue).toHaveText('100%');
  });

  test('search with only whitespace shows no tracks (whitespace is not trimmed)', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    // The app does not trim search input — "   " is truthy so it tries to
    // match, but no track title/artist/genre/key contains only spaces → 0 results
    await player.searchInput.fill('   ');
    await expect(player.trackItems).toHaveCount(0);
  });

  test('rapidly switching genre filters does not crash the app', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    const genres = ['Techno', 'DnB', 'Progressive', 'Synthwave', 'All'];
    for (const g of genres) await player.genreBtn(g).click();

    await expect(player.trackItems).toHaveCount(6);
  });

  test('loading tracks in quick succession shows only the last one', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    // Click multiple tracks rapidly
    await player.clickTrack(0);
    await player.clickTrack(1);
    await player.clickTrack(2);
    await player.clickTrack(3);

    await expect(player.trackTitle).toHaveText('Cloud Nine');
    const activeItems = page.locator('.tracklist-item.active');
    await expect(activeItems).toHaveCount(1);
  });

  test('BPM display shows correct suffix via CSS ::after — element text is numeric only', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0); // BPM 122
    // The CSS ::after pseudo-element appends " BPM"; the raw text content is just the number
    await expect(player.metaBpm).toHaveText('122');
  });

  test('all genre filter buttons are visible and interactive', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    const genreLabels = ['All', 'Deep House', 'Techno', 'DnB', 'Progressive', 'Synthwave', 'Garage'];
    for (const label of genreLabels) {
      await expect(player.genreBtn(label)).toBeVisible();
    }
  });

  test('app layout is present at desktop viewport (900 px wide)', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await player.goto();

    await expect(player.nowPlayingSection).toBeVisible();
    await expect(player.transportSection).toBeVisible();
    await expect(player.librarySection).toBeVisible();
  });

  test('app layout is present at mobile viewport (375 px wide)', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await player.goto();

    // Core sections remain visible on mobile
    await expect(player.nowPlayingSection).toBeVisible();
    await expect(player.trackTitle).toBeVisible();
    await expect(player.btnPlay).toBeVisible();
  });

  test('typing in search does not fire global Space shortcut', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.focus();
    await page.keyboard.type('liquid '); // includes a space

    // Space in search field must not trigger play
    await expect(player.trackTitle).toHaveText('No track selected');
    // Search value should include the space
    await expect(player.searchInput).toHaveValue('liquid ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13 · VISUAL FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Visual feedback', () => {
  test('EQ bars appear on the active track while playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    // The active track's number column should show EQ bars while playing
    const activeItem = page.locator('.tracklist-item.active');
    await expect(activeItem.locator('.eq-bars')).toBeVisible();
  });

  test('EQ bars disappear when playback is paused', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await expect(page.locator('.tracklist-item.active .eq-bars')).toBeVisible();

    await player.btnPause.click();
    // After pausing, the EQ bars should be replaced by the track number
    await expect(page.locator('.tracklist-item.active .eq-bars')).toHaveCount(0);
  });

  test('EQ bars move to the new track when switching tracks', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await expect(player.trackItem(0).locator('.eq-bars')).toBeVisible();

    await player.clickTrack(2);
    // EQ bars should now be on track 3, not track 1
    await expect(player.trackItem(0).locator('.eq-bars')).toHaveCount(0);
    await expect(player.trackItem(2).locator('.eq-bars')).toBeVisible();
  });

  test('volume persists when switching tracks', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    // Set volume to 40%
    await player.volumeSlider.fill('40');
    await expect(player.volumeValue).toHaveText('40%');

    await player.clickTrack(0);
    await player.clickTrack(2);

    // Volume should still be 40% after switching tracks
    await expect(player.volumeValue).toHaveText('40%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14 · VISUAL REGRESSION
// Uses toHaveScreenshot() to catch unintended layout or styling changes.
// Baseline images are generated on first run; subsequent runs compare against them.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Visual regression', () => {
  test('default state', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    // Mask the waveform canvas — it can render differently across runs
    await expect(page).toHaveScreenshot('default-state.png', {
      mask: [player.waveform],
    });
  });

  test('playing state', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.clickTrack(0);
    await expect(player.btnPause).toBeVisible();
    await expect(page).toHaveScreenshot('playing-state.png', {
      mask: [player.waveform],
    });
  });

  test('genre filter active', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.genreBtn('Techno').click();
    await expect(player.trackItems).toHaveCount(1);
    await expect(page).toHaveScreenshot('genre-filter-active.png', {
      mask: [player.waveform],
    });
  });

  test('search results', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.searchInput.fill('midnight');
    await expect(player.trackItems).toHaveCount(1);
    await expect(page).toHaveScreenshot('search-results.png', {
      mask: [player.waveform],
    });
  });

  test('no results state', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.searchInput.fill('xyzxyzxyz');
    await expect(player.trackItems).toHaveCount(0);
    await expect(player.noResults).toBeVisible();
    await expect(page).toHaveScreenshot('no-results.png', {
      mask: [player.waveform],
    });
  });

  test('muted state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.btnMute.click();
    await expect(player.volumeValue).toHaveText('0%');
    await expect(page).toHaveScreenshot('muted-state.png', {
      mask: [player.waveform],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15 · DRAG SEEKING
// Tests the mousedown → mousemove → mouseup seeking interaction on the
// progress bar, which is more complex than a single click.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Drag seeking', () => {
  test('dragging the progress bar seeks through the track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.clickTrack(0); // 20s track

    const progressTrack = page.locator('.progress-track');
    const box = await progressTrack.boundingBox();
    if (!box) throw new Error('Progress bar not found');

    // Drag from 25% to 75% of the progress bar
    const startX = box.x + box.width * 0.25;
    const endX = box.x + box.width * 0.75;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 5 });
    await page.mouse.up();

    // Time should be roughly 75% of 20s ≈ 15s
    const time = await player.timeCurrent.textContent();
    const [min, sec] = time!.split(':').map(Number);
    const totalSec = min * 60 + sec;
    expect(totalSec).toBeGreaterThanOrEqual(13);
    expect(totalSec).toBeLessThanOrEqual(17);
  });

  test('progress fill updates during a drag', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.clickTrack(0);

    const progressTrack = page.locator('.progress-track');
    const box = await progressTrack.boundingBox();
    if (!box) throw new Error('Progress bar not found');

    const midX = box.x + box.width * 0.5;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width * 0.1, y);
    await page.mouse.down();
    await page.mouse.move(midX, y, { steps: 3 });

    // While still dragging, check fill width is roughly 50%
    const width = await player.progressFill.evaluate((el) =>
      parseFloat((el as HTMLElement).style.width));
    expect(width).toBeGreaterThanOrEqual(40);
    expect(width).toBeLessThanOrEqual(60);

    await page.mouse.up();
  });

  test('dragging to the very start resets time to 0:00', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();
    await player.clickTrack(0);

    // Wait for playback to tick forward
    await expect(player.timeCurrent).not.toHaveText('0:00', { timeout: 3000 });

    const progressTrack = page.locator('.progress-track');
    const box = await progressTrack.boundingBox();
    if (!box) throw new Error('Progress bar not found');

    // Click at the very start of the bar
    await page.mouse.click(box.x + 1, box.y + box.height / 2);
    await expect(player.timeCurrent).toHaveText('0:00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16 · PLAYBACK + FILTER INTERACTION
// Verifies that filtering the tracklist while a track is playing does not
// disrupt playback or corrupt the active-track highlight.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Playback + filter interaction', () => {
  test('active track stays highlighted when its genre is selected', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(1); // Warehouse Echoes — Techno
    await expect(player.trackItem(1)).toHaveClass(/active/);

    await player.genreBtn('Techno').click();
    // Warehouse Echoes is the only Techno track → item 0 in the filtered list
    await expect(player.trackItems).toHaveCount(1);
    await expect(player.trackItem(0)).toHaveClass(/active/);
  });

  test('playing track continues when filtered out of the visible list', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0); // Midnight Sessions — Deep House
    await expect(player.btnPause).toBeVisible();

    // Filter to Techno — Midnight Sessions is Deep House, so it disappears
    await player.genreBtn('Techno').click();
    await expect(player.trackItems).toHaveCount(1);

    // Playback should still be active — now-playing panel is unchanged
    await expect(player.trackTitle).toHaveText('Midnight Sessions');
    await expect(player.btnPause).toBeVisible();
  });

  test('clearing genre filter while playing restores active highlight', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0); // Midnight Sessions — Deep House
    await player.genreBtn('Techno').click(); // hide the playing track
    await player.genreBtn('All').click();    // show all again

    await expect(player.trackItems).toHaveCount(6);
    await expect(player.trackItem(0)).toHaveClass(/active/);
  });

  test('searching while playing keeps the now-playing panel intact', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0); // Midnight Sessions
    await expect(player.btnPause).toBeVisible();

    await player.searchInput.fill('warehouse');
    await expect(player.trackItems).toHaveCount(1);

    // Now-playing panel still shows Midnight Sessions, not the search result
    await expect(player.trackTitle).toHaveText('Midnight Sessions');
    await expect(player.btnPause).toBeVisible();
  });

  test('Next track works correctly after filtering and clearing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.genreBtn('Techno').click();
    await player.genreBtn('All').click();

    await player.btnNext.click();
    await expect(player.trackTitle).toHaveText('Warehouse Echoes');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17 · TRACK NUMBER DISPLAY
// The tracklist shows a numeric index (1, 2, 3…) for each track when idle,
// replacing it with EQ bars for the active track during playback.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Track number display', () => {
  test('each track shows its number when not playing', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    for (let i = 0; i < 6; i++) {
      await expect(player.trackItem(i).locator('.item-num')).toHaveText(String(i + 1));
    }
  });

  test('active track shows EQ bars instead of its number while playing', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2); // Liquid Sunshine
    await expect(player.trackItem(2).locator('.eq-bars')).toBeVisible();
    await expect(player.trackItem(2).locator('.item-num')).not.toHaveText('3');
  });

  test('non-active tracks still show their numbers while another plays', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);
    await expect(player.trackItem(0).locator('.item-num')).toHaveText('1');
    await expect(player.trackItem(1).locator('.item-num')).toHaveText('2');
    await expect(player.trackItem(3).locator('.item-num')).toHaveText('4');
    await expect(player.trackItem(4).locator('.item-num')).toHaveText('5');
    await expect(player.trackItem(5).locator('.item-num')).toHaveText('6');
  });

  test('pausing restores the track number on the active track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await expect(player.trackItem(0).locator('.eq-bars')).toBeVisible();

    await player.btnPause.click();
    await expect(player.trackItem(0).locator('.eq-bars')).toHaveCount(0);
    await expect(player.trackItem(0).locator('.item-num')).toHaveText('1');
  });

  test('filtered list renumbers tracks starting from 1', async ({ page }) => {
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.genreBtn('Techno').click();
    await expect(player.trackItems).toHaveCount(1);
    // Warehouse Echoes is track 2 overall, but shows "1" in the filtered view
    await expect(player.trackItem(0).locator('.item-num')).toHaveText('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18 · SEARCH INPUT ISOLATION
// Verifies that global keyboard shortcuts (mute, track skip) are suppressed
// when the search input is focused so typing doesn't trigger player actions.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Search input isolation', () => {
  test('"m" key in search does not toggle mute', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.focus();
    await page.keyboard.type('m');

    await expect(player.volumeValue).toHaveText('80%');
    await expect(player.searchInput).toHaveValue('m');
  });

  test('"M" (uppercase) in search does not toggle mute', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.searchInput.focus();
    await page.keyboard.type('M');

    await expect(player.volumeValue).toHaveText('80%');
    await expect(player.searchInput).toHaveValue('M');
  });

  test('Shift+ArrowRight in search does not skip track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.searchInput.focus();
    await page.keyboard.press('Shift+ArrowRight');

    await expect(player.trackTitle).toHaveText('Midnight Sessions');
  });

  test('Shift+ArrowLeft in search does not skip track', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(2);
    await player.searchInput.focus();
    await page.keyboard.press('Shift+ArrowLeft');

    await expect(player.trackTitle).toHaveText('Liquid Sunshine');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19 · PLAY/PAUSE RESILIENCE
// Stress-tests repeated and rapid state changes to ensure the UI stays
// consistent and no event listeners leak or desync.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Play/pause resilience', () => {
  test('multiple play/pause cycles leave the UI in a consistent state', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.startPlayback();

    for (let i = 0; i < 5; i++) {
      await player.btnPause.click();
      await expect(player.btnPlay).toBeVisible();
      await expect(player.appRoot).not.toHaveClass(/playing/);

      await player.startPlayback();
      await expect(player.btnPause).toBeVisible();
      await expect(player.appRoot).toHaveClass(/playing/);
    }
  });

  test('rapid play/pause toggling does not break the UI', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);

    // Rapidly toggle 10 times via Space (even count → back to playing)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Space');
    }

    await expect(player.btnPause).toBeVisible();
    await expect(player.trackTitle).toHaveText('Midnight Sessions');
  });

  test('switching tracks mid-playback leaves a clean state', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await expect(player.btnPause).toBeVisible();

    await player.clickTrack(3);
    await expect(player.trackTitle).toHaveText('Cloud Nine');
    await expect(player.btnPause).toBeVisible();
    await expect(player.appRoot).toHaveClass(/playing/);

    // Only one track should be active
    const activeItems = page.locator('.tracklist-item.active');
    await expect(activeItems).toHaveCount(1);
    await expect(player.trackItem(3)).toHaveClass(/active/);
  });

  test('pause, switch track, verify new track auto-plays', async ({ page }) => {
    await stubAudio(page);
    const player = new DjPlayerPage(page);
    await player.goto();

    await player.clickTrack(0);
    await player.btnPause.click();
    await expect(player.btnPlay).toBeVisible();

    await player.clickTrack(4);
    await expect(player.trackTitle).toHaveText('Neon Dreams');
    // Clicking a track auto-plays
    await expect(player.btnPause).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20 · PERFORMANCE
// Measures Core Web Vitals and page load performance using the browser's
// built-in Performance API. Ensures the app meets modern web performance
// standards (thresholds based on Google's "good" Web Vitals benchmarks).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance', () => {

  test('page load timing: TTFB, DOMContentLoaded, and full load', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const timing = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return {
        ttfb: nav.responseStart - nav.startTime,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
      };
    });

    expect(timing.ttfb, 'Time to First Byte').toBeLessThan(500);
    expect(timing.domContentLoaded, 'DOMContentLoaded').toBeLessThan(2000);
    expect(timing.load, 'Full page load').toBeLessThan(3000);
  });

  test('First Contentful Paint is under 1.5 seconds', async ({ page }, testInfo) => {
    // FCP PerformanceObserver is Chromium-only
    test.skip(testInfo.project.name !== 'chromium', 'Paint Timing API is Chromium-only');

    await page.addInitScript(() => {
      (window as any).__fcp = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            (window as any).__fcp = entry.startTime;
          }
        }
      }).observe({ type: 'paint', buffered: true });
    });

    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();
    await page.waitForFunction(() => (window as any).__fcp > 0, { timeout: 5000 });

    const fcp = await page.evaluate(() => (window as any).__fcp);
    expect(fcp, 'FCP should be captured').toBeGreaterThan(0);
    expect(fcp, 'First Contentful Paint').toBeLessThan(1500);
  });

  test('Largest Contentful Paint is under 2.5 seconds', async ({ page }, testInfo) => {
    // LCP PerformanceObserver is Chromium-only
    test.skip(testInfo.project.name !== 'chromium', 'LCP API is Chromium-only');

    await page.addInitScript(() => {
      (window as any).__lcp = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        (window as any).__lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();
    await page.waitForFunction(() => (window as any).__lcp > 0, { timeout: 5000 });

    const lcp = await page.evaluate(() => (window as any).__lcp);
    expect(lcp, 'LCP should be captured').toBeGreaterThan(0);
    expect(lcp, 'Largest Contentful Paint').toBeLessThan(2500);
  });

  test('Cumulative Layout Shift is under 0.1', async ({ page }, testInfo) => {
    // CLS PerformanceObserver is Chromium-only
    test.skip(testInfo.project.name !== 'chromium', 'Layout Shift API is Chromium-only');

    await page.addInitScript(() => {
      (window as any).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__cls += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();
    await page.waitForFunction(() => typeof (window as any).__cls === 'number', { timeout: 5000 });

    const cls = await page.evaluate(() => (window as any).__cls);
    expect(cls, 'Cumulative Layout Shift').toBeLessThan(0.1);
  });

  test('/api/tracks responds within 200ms', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const apiDuration = await page.evaluate(() => {
      const entry = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .find(r => r.name.includes('/api/tracks'));
      return entry ? entry.duration : null;
    });

    expect(apiDuration, 'API resource entry should exist').not.toBeNull();
    expect(apiDuration!, '/api/tracks response time').toBeLessThan(200);
  });

  test('total page weight is under 500 KB', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const totalBytes = await page.evaluate(() => {
      return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .reduce((sum, r) => sum + (r.transferSize || 0), 0);
    });

    const totalKB = totalBytes / 1024;
    expect(totalKB, 'Total page weight in KB').toBeLessThan(500);
  });

  test('no individual resource exceeds 200 KB', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const resources = await page.evaluate(() => {
      return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(r => ({
        name: r.name.split('/').pop() || r.name,
        sizeKB: (r.transferSize || 0) / 1024,
      }));
    });

    for (const res of resources) {
      expect(res.sizeKB, `${res.name} exceeds 200 KB`).toBeLessThan(200);
    }
  });

  test('all static resources load within 1 second', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const resources = await page.evaluate(() => {
      return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(r => ({
        name: r.name.split('/').pop() || r.name,
        duration: r.duration,
      }));
    });

    for (const res of resources) {
      expect(res.duration, `${res.name} took too long`).toBeLessThan(1000);
    }
  });

  test('no long tasks block the main thread during load', async ({ page }, testInfo) => {
    // Long Task API is Chromium-only
    test.skip(testInfo.project.name !== 'chromium', 'Long Task API is Chromium-only');

    await page.addInitScript(() => {
      (window as any).__longTasks = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as any).__longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch {
        // Observer not supported — leave array empty
      }
    });

    await page.goto('/');
    await page.getByRole('listitem').first().waitFor();

    const longTasks: Array<{ duration: number }> = await page.evaluate(
      () => (window as any).__longTasks
    );

    // Long tasks are >50ms by definition — we want zero during page load
    expect(longTasks, 'No long tasks should block the main thread').toHaveLength(0);
  });
});
