import { describe, expect, it } from 'vitest';

import { formatDuration, largeUrl, thumbnailUrl, videoPosterUrl } from './mediaUrls';
import { friendlyReviewError } from './reviewErrors';
import {
  classifyFile,
  formatBytes,
  MAX_COMMENT,
  MAX_PHOTO_BYTES,
  MAX_TITLE,
  MAX_VIDEO_BYTES,
  slotMessage,
  validateComment,
  validateRating,
  validateReviewFile,
  validateTitle,
  validateVideoDuration,
} from './reviewRules';

const file = (name, type, size = 1000) => ({ name, type, size });

describe('classifyFile', () => {
  it.each([
    ['a.jpg', 'image/jpeg', 'photo'],
    ['a.JPEG', 'image/jpeg', 'photo'],
    ['a.png', 'image/png', 'photo'],
    ['a.webp', 'image/webp', 'photo'],
    ['a.mp4', 'video/mp4', 'video'],
    ['a.webm', 'video/webm', 'video'],
  ])('accepts %s as a %s', (name, type, kind) => {
    expect(classifyFile(file(name, type))).toBe(kind);
  });

  it.each([
    ['a gif', file('a.gif', 'image/gif')],
    ['a heic photo', file('a.heic', 'image/heic')],
    ['a mov video', file('a.mov', 'video/quicktime')],
    ['a type that does not match the extension', file('a.mp4', 'image/png')],
    ['a script pretending to be a photo', file('a.php.jpg', 'image/jpeg')],
    ['an html file with a photo type', file('a.html', 'image/jpeg')],
    ['an svg', file('a.svg', 'image/svg+xml')],
    ['no extension', file('photo', 'image/jpeg')],
    ['no file', null],
  ])('refuses %s', (_name, value) => {
    expect(classifyFile(value)).toBeNull();
  });
});

describe('validateReviewFile', () => {
  it('accepts normal files, including exactly the size limits', () => {
    expect(validateReviewFile(file('a.jpg', 'image/jpeg', MAX_PHOTO_BYTES))).toBeNull();
    expect(validateReviewFile(file('a.mp4', 'video/mp4', MAX_VIDEO_BYTES))).toBeNull();
  });

  it('refuses a photo over 5 MB and a video over 10 MB', () => {
    expect(validateReviewFile(file('a.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1))).toMatch(/5 MB/);
    expect(validateReviewFile(file('a.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1))).toMatch(/10 MB/);
  });

  it('refuses an empty file and a wrong type, naming the file', () => {
    expect(validateReviewFile(file('a.jpg', 'image/jpeg', 0))).toMatch(/a\.jpg: the file is empty/);
    expect(validateReviewFile(file('a.gif', 'image/gif'))).toMatch(/^a\.gif: only JPG/);
  });
});

describe('validateVideoDuration', () => {
  it('accepts up to 60 seconds', () => {
    expect(validateVideoDuration('v.mp4', 1)).toBeNull();
    expect(validateVideoDuration('v.mp4', 60)).toBeNull();
  });

  it('refuses longer videos and videos whose length cannot be read', () => {
    expect(validateVideoDuration('v.mp4', 60.5)).toMatch(/60 seconds/);
    expect(validateVideoDuration('v.mp4', Number.NaN)).toMatch(/could not read/);
    expect(validateVideoDuration('v.mp4', Infinity)).toMatch(/could not read/);
    expect(validateVideoDuration('v.mp4', 0)).toMatch(/could not read/);
  });
});

describe('slotMessage', () => {
  const photos = (n) => Array.from({ length: n }, () => ({ kind: 'photo' }));

  it('allows 3 photos and 1 video, and says so when full', () => {
    expect(slotMessage(photos(2), 'photo')).toBeNull();
    expect(slotMessage(photos(3), 'photo')).toMatch(/up to 3 photos/);
    expect(slotMessage(photos(3), 'video')).toBeNull();
    expect(slotMessage([{ kind: 'video' }], 'video')).toMatch(/1 video/);
  });
});

describe('text and rating', () => {
  it('accepts empty text (both are optional) and text at the limit', () => {
    expect(validateTitle('')).toBe('');
    expect(validateTitle('x'.repeat(MAX_TITLE))).toBe('');
    expect(validateComment('')).toBe('');
    expect(validateComment('x'.repeat(MAX_COMMENT))).toBe('');
  });

  it('measures the trimmed text', () => {
    expect(validateTitle(`  ${'x'.repeat(MAX_TITLE)}  `)).toBe('');
  });

  it('refuses text that is too long', () => {
    expect(validateTitle('x'.repeat(MAX_TITLE + 1))).toMatch(/100 characters/);
    expect(validateComment('x'.repeat(MAX_COMMENT + 1))).toMatch(/2000 characters/);
  });

  it('lets a comment have line breaks but not other control characters', () => {
    expect(validateComment('one\ntwo\r\nthree\tfour')).toBe('');
    expect(validateComment(`a${String.fromCharCode(7)}b`)).toMatch(/not allowed/);
    expect(validateComment(`a${String.fromCharCode(0)}b`)).toMatch(/not allowed/);
    expect(validateTitle('one\ntwo')).toMatch(/not allowed/);
  });

  it('wants a whole number of stars from 1 to 5', () => {
    for (const ok of [1, 2, 3, 4, 5]) expect(validateRating(ok)).toBe('');
    for (const bad of [0, 6, 2.5, null, undefined, '3']) {
      expect(validateRating(bad)).toMatch(/star rating/);
    }
  });
});

describe('formatBytes', () => {
  it('prints KB and MB', () => {
    expect(formatBytes(340 * 1024)).toBe('340 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('friendlyReviewError', () => {
  it.each([
    [{ message: 'not_purchased' }, 'Only customers who bought this product can review it.'],
    [
      { message: 'already_reviewed' },
      "You've already reviewed this product. Edit your existing review.",
    ],
    [{ message: 'rate_limited' }, 'Too many uploads. Please try again in an hour.'],
    [{ message: 'product_not_found' }, 'Product not found.'],
    [{ message: 'media_invalid', details: 'too_many' }, 'You can add up to 3 photos and 1 video.'],
    [{ message: 'media_invalid', details: 'duration' }, 'Videos can be up to 60 seconds.'],
  ])('words %j exactly', (error, text) => {
    expect(friendlyReviewError(error)).toBe(text);
  });

  it('has specific words for size, type and the other file problems', () => {
    expect(friendlyReviewError({ message: 'media_invalid', details: 'size' })).toMatch(/too large/);
    expect(friendlyReviewError({ message: 'media_invalid', details: 'type' })).toMatch(
      /not a supported type/,
    );
    expect(friendlyReviewError({ message: 'media_invalid', details: 'not_uploaded' })).toMatch(
      /not uploaded properly/,
    );
    expect(friendlyReviewError({ message: 'text_invalid', details: 'title' })).toMatch(/title/);
    expect(friendlyReviewError({ message: 'text_invalid', details: 'comment' })).toMatch(/comment/);
  });

  it('never shows raw database text', () => {
    const text = friendlyReviewError({ code: 'XX000', message: 'relation "reviews" does not exist' });
    expect(text).toBe('We could not save your review. Please try again.');
    expect(friendlyReviewError({ code: '42501', message: 'x' })).toMatch(/sign in/);
    expect(friendlyReviewError(null)).toMatch(/could not save/);
  });
});

describe('media addresses', () => {
  const photo = 'https://res.cloudinary.com/demo/image/upload/v1/shopyaro/reviews/r/photo/abc.jpg';
  const video = 'https://res.cloudinary.com/demo/video/upload/v1/shopyaro/reviews/r/video/abc.mp4';

  it('builds a cropped thumbnail and a large picture on Cloudinary', () => {
    expect(thumbnailUrl(photo, 100)).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_100,h_100,q_auto,f_auto/v1/shopyaro/reviews/r/photo/abc.jpg',
    );
    expect(largeUrl(photo)).toContain('/upload/c_limit,w_1600,q_auto,f_auto/v1/');
  });

  it('makes a poster picture from a Cloudinary video', () => {
    expect(videoPosterUrl(video)).toBe(
      'https://res.cloudinary.com/demo/video/upload/so_0,c_fill,w_320,h_320/v1/shopyaro/reviews/r/video/abc.jpg',
    );
  });

  it('leaves addresses that are not Cloudinary alone (and has no poster for them)', () => {
    expect(thumbnailUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(videoPosterUrl('https://example.com/a.mp4')).toBeNull();
  });

  it('prints a duration as m:ss', () => {
    expect(formatDuration(12.4)).toBe('0:12');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(null)).toBe('');
  });
});
