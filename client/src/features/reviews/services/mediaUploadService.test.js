import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ functions: { invoke: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  CANCELLED,
  createUploadQueue,
  requestReviewSlot,
  uploadReviewMedia,
} from './mediaUploadService';

const REVIEW = '11111111-1111-4111-8111-111111111111';
const PUBLIC_ID = `shopyaro/reviews/${REVIEW}/photo/${'a'.repeat(32)}`;

const slot = (overrides = {}) => ({
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  apiKey: 'key',
  timestamp: 1700000000,
  signature: 'sig',
  publicId: PUBLIC_ID,
  assetFolder: `shopyaro/reviews/${REVIEW}/photo`,
  allowedFormats: 'jpg,jpeg,png,webp',
  transformation: 'c_limit,w_2000,h_2000',
  resourceType: 'image',
  ...overrides,
});

const goodResult = (overrides = {}) => ({
  secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${PUBLIC_ID}.jpg`,
  public_id: PUBLIC_ID,
  bytes: 120000,
  width: 800,
  height: 600,
  ...overrides,
});

/** A stand-in for XMLHttpRequest that answers like Cloudinary would. */
function fakeXhr({ status = 200, body = goodResult(), progress = [50, 100] } = {}) {
  const sent = [];
  class Xhr {
    constructor() {
      this.upload = {};
      Xhr.last = this;
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    send(form) {
      sent.push(form);
      progress.forEach((percent) =>
        this.upload.onprogress?.({ lengthComputable: true, loaded: percent, total: 100 }),
      );
      this.status = status;
      this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
      queueMicrotask(() => this.onload());
    }
    abort() {
      this.onabort();
    }
  }
  vi.stubGlobal('XMLHttpRequest', Xhr);
  return { Xhr, sent };
}

const photoFile = (extra = {}) => ({ name: 'a.jpg', type: 'image/jpeg', size: 1000, ...extra });

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('createUploadQueue', () => {
  it('runs at most 3 jobs at once and finishes them all', async () => {
    const queue = createUploadQueue(3);
    let active = 0;
    let peak = 0;
    const releases = [];
    const job = (n) => () =>
      new Promise((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        releases.push(() => {
          active -= 1;
          resolve(n);
        });
      });

    const results = [1, 2, 3, 4, 5].map((n) => queue.add(job(n)));
    expect(queue.running).toBe(3);
    expect(queue.waiting).toBe(2);

    releases.shift()(); // one finishes, the next one starts
    await results[0];
    await Promise.resolve();
    expect(queue.running).toBe(3);
    expect(queue.waiting).toBe(1);

    while (releases.length > 0) {
      releases.shift()();
      await Promise.resolve();
      await Promise.resolve();
    }
    await expect(Promise.all(results)).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(3);
  });

  it('keeps going after a job fails, and reports that job as failed', async () => {
    const queue = createUploadQueue(2);
    const bad = queue.add(() => Promise.reject(new Error('boom')));
    const good = queue.add(() => Promise.resolve('fine'));
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('fine');
    expect(queue.running).toBe(0);
  });
});

describe('requestReviewSlot', () => {
  it('asks for a slot in the reviews folder for this review and kind', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: slot(), error: null });
    await requestReviewSlot(REVIEW, 'photo');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('sign-upload', {
      body: { folder: 'reviews', reviewId: REVIEW, kind: 'photo' },
    });
  });

  it.each([
    [429, 'Too many uploads. Please try again in an hour.'],
    [403, 'Only customers who bought a product can add photos or videos.'],
    [401, 'Please sign in again to upload.'],
    [500, 'We could not start the upload. Please try again.'],
  ])('turns a %s answer into plain words', async (status, text) => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status } } });
    await expect(requestReviewSlot(REVIEW, 'photo')).rejects.toThrow(text);
  });

  it('refuses an incomplete answer', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { apiKey: 'k' }, error: null });
    await expect(requestReviewSlot(REVIEW, 'photo')).rejects.toThrow(/could not start/);
  });
});

describe('uploadReviewMedia', () => {
  it('signs, sends every signed value to Cloudinary, reports progress and returns the file', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: slot(), error: null });
    const { Xhr, sent } = fakeXhr();
    const onProgress = vi.fn();

    const media = await uploadReviewMedia(photoFile(), 'photo', REVIEW, { onProgress });

    expect(Xhr.last.url).toBe(slot().uploadUrl);
    const form = sent[0];
    expect(form.get('public_id')).toBe(PUBLIC_ID);
    expect(form.get('transformation')).toBe('c_limit,w_2000,h_2000');
    expect(form.get('allowed_formats')).toBe('jpg,jpeg,png,webp');
    expect(form.get('asset_folder')).toBe(slot().assetFolder);
    expect(form.get('signature')).toBe('sig');
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
    expect(media).toEqual({
      type: 'photo',
      url: goodResult().secure_url,
      publicId: PUBLIC_ID,
      width: 800,
      height: 600,
      durationSeconds: null,
      bytes: 120000,
    });
  });

  it('keeps the length of a video, from Cloudinary or else from the browser', async () => {
    const videoId = `shopyaro/reviews/${REVIEW}/video/${'b'.repeat(32)}`;
    supabase.functions.invoke.mockResolvedValue({
      data: slot({ publicId: videoId, resourceType: 'video', transformation: undefined }),
      error: null,
    });
    fakeXhr({
      body: goodResult({
        secure_url: `https://res.cloudinary.com/demo/video/upload/v1/${videoId}.mp4`,
        public_id: videoId,
        duration: 12.5,
      }),
    });
    const media = await uploadReviewMedia(
      { name: 'a.mp4', type: 'video/mp4', size: 1000 },
      'video',
      REVIEW,
      { durationSeconds: 99 },
    );
    expect(media.type).toBe('video');
    expect(media.durationSeconds).toBe(12.5);
  });

  it('never asks for a slot when the file itself is not allowed', async () => {
    await expect(
      uploadReviewMedia(photoFile({ name: 'a.gif', type: 'image/gif' }), 'photo', REVIEW),
    ).rejects.toThrow(/only JPG/);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ['a different public_id', goodResult({ public_id: 'shopyaro/reviews/other/photo/zzz' })],
    ['a non-Cloudinary address', goodResult({ secure_url: 'https://evil.example/a.jpg' })],
    ['a video address for a photo', goodResult({ secure_url: 'https://res.cloudinary.com/demo/video/upload/a.mp4' })],
    ['a missing size', goodResult({ bytes: undefined })],
    ['a size over the photo limit', goodResult({ bytes: 6 * 1024 * 1024 })],
  ])('refuses an answer with %s', async (_name, body) => {
    supabase.functions.invoke.mockResolvedValue({ data: slot(), error: null });
    fakeXhr({ body });
    await expect(uploadReviewMedia(photoFile(), 'photo', REVIEW)).rejects.toThrow(
      'The upload failed. Please try again.',
    );
  });

  it('fails clearly when Cloudinary refuses or answers nonsense', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: slot(), error: null });
    fakeXhr({ status: 400, body: { error: { message: 'bad' } } });
    await expect(uploadReviewMedia(photoFile(), 'photo', REVIEW)).rejects.toThrow(/upload failed/);
    fakeXhr({ body: 'not json' });
    await expect(uploadReviewMedia(photoFile(), 'photo', REVIEW)).rejects.toThrow(/upload failed/);
  });

  it('can be cancelled', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: slot(), error: null });
    const controller = new AbortController();
    controller.abort();
    fakeXhr();
    await expect(
      uploadReviewMedia(photoFile(), 'photo', REVIEW, { signal: controller.signal }),
    ).rejects.toThrow(CANCELLED);
  });
});
