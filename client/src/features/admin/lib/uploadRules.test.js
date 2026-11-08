import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES, validateImageFile } from './uploadRules';

const file = (overrides) => ({ name: 'a.jpg', type: 'image/jpeg', size: 1000, ...overrides });

describe('validateImageFile', () => {
  it('accepts JPG, PNG and WebP up to 5 MB', () => {
    expect(validateImageFile(file())).toBeNull();
    expect(validateImageFile(file({ type: 'image/png' }))).toBeNull();
    expect(validateImageFile(file({ type: 'image/webp' }))).toBeNull();
    expect(validateImageFile(file({ size: MAX_IMAGE_BYTES }))).toBeNull();
  });

  it('names the file and the reason when rejecting', () => {
    expect(validateImageFile(file({ name: 'x.gif', type: 'image/gif' }))).toMatch(
      /x\.gif.*JPG, PNG or WebP/,
    );
    expect(validateImageFile(file({ size: MAX_IMAGE_BYTES + 1 }))).toMatch(/larger than 5 MB/);
    expect(validateImageFile(file({ size: 0 }))).toMatch(/empty/);
    expect(validateImageFile(file({ type: 'image/svg+xml' }))).not.toBeNull();
    expect(validateImageFile(file({ type: 'application/pdf' }))).not.toBeNull();
  });
});
