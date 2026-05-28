import type { Page } from '@playwright/test';

/**
 * Replaces the browser's Audio constructor with a controllable fake so tests
 * run headlessly without relying on the Web Audio API or real media decoding.
 * Each Audio instance carries its own state — no shared mutable prototype.
 */
export async function stubAudio(page: Page) {
  await page.addInitScript(() => {
    class FakeAudio extends EventTarget {
      currentTime = 0;
      duration = 20;
      volume = 0.8;
      paused = true;
      src = '';
      private _interval: ReturnType<typeof setInterval> | null = null;

      constructor(src?: string) {
        super();
        if (src) this.src = src;
        (window as any).__stubAudioInstance = this;
      }

      load() {
        this.currentTime = 0;
        this.duration = 20;
        (window as any).__stubAudioInstance = this;
        setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 10);
      }

      play() {
        this.paused = false;
        (window as any).__stubAudioInstance = this;
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(() => {
          this.currentTime += 0.25;
          this.dispatchEvent(new Event('timeupdate'));
          if (this.currentTime >= this.duration) {
            this.currentTime = this.duration;
            clearInterval(this._interval!);
            this._interval = null;
            this.paused = true;
            this.dispatchEvent(new Event('ended'));
          }
        }, 250);
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }
    }

    // Intercept src setter to trigger load behavior
    Object.defineProperty(FakeAudio.prototype, 'src', {
      get() { return this._src || ''; },
      set(v: string) {
        this._src = v;
        this.currentTime = 0;
        this.duration = 20;
        (window as any).__stubAudioInstance = this;
        setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 10);
      },
    });

    (window as any).Audio = FakeAudio;
  });
}
