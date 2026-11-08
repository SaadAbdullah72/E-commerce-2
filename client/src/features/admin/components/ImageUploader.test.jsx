import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { moveItem } from '../lib/moveItem';
import ImageUploader from './ImageUploader';

const image = (name) => ({
  url: `https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/products/${name}.jpg`,
  publicId: `shopyaro/products/${name}`,
  alt: '',
});

function Harness({ initial = [], max = 8, uploadFn, onValue }) {
  const [value, setValue] = useState(initial);
  return (
    <ImageUploader
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      folder="products"
      max={max}
      uploadFn={uploadFn}
    />
  );
}

const file = (name, type = 'image/jpeg', size = 1000) =>
  new File([new Uint8Array(size)], name, { type });
const names = () => within(screen.getByRole('list', { name: 'Images' })).getAllByRole('listitem');

describe('moveItem', () => {
  it('moves an item and ignores impossible moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    const same = ['a', 'b'];
    expect(moveItem(same, 0, 0)).toBe(same);
    expect(moveItem(same, 0, 5)).toBe(same);
    expect(moveItem(same, -1, 0)).toBe(same);
  });
});

describe('ImageUploader', () => {
  it('uploads chosen files and adds them in order, the first being the main image', async () => {
    const uploadFn = vi.fn(async (picked) => image(picked.name.replace('.jpg', '')));
    const user = userEvent.setup();
    render(<Harness uploadFn={uploadFn} />);

    await user.upload(screen.getByLabelText('Upload images'), [file('one.jpg'), file('two.jpg')]);

    await waitFor(() => expect(names()).toHaveLength(2));
    expect(uploadFn).toHaveBeenCalledTimes(2);
    expect(uploadFn.mock.calls[0][1]).toBe('products');
    expect(within(names()[0]).getByText('Main')).toBeInTheDocument();
    expect(within(names()[1]).queryByText('Main')).not.toBeInTheDocument();
  });

  it('uploads files dropped onto the zone', async () => {
    const uploadFn = vi.fn(async () => image('dropped'));
    render(<Harness uploadFn={uploadFn} />);

    const zone = screen.getByText(/drag images here/i).closest('div');
    fireEvent.drop(zone, { dataTransfer: { files: [file('d.jpg')], types: ['Files'] } });

    await waitFor(() => expect(names()).toHaveLength(1));
  });

  it('rejects wrong types and big files with a reason, without uploading them', async () => {
    const uploadFn = vi.fn(async () => image('x'));
    render(<Harness uploadFn={uploadFn} />);

    // userEvent.upload skips files that do not match `accept`, so drop them instead.
    const zone = screen.getByText(/drag images here/i).closest('div');
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [file('x.gif', 'image/gif'), file('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)],
        types: ['Files'],
      },
    });

    expect(await screen.findByText(/x\.gif: only JPG, PNG or WebP/)).toBeInTheDocument();
    expect(screen.getByText(/big\.jpg: the file is larger than 5 MB/)).toBeInTheDocument();
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it('stops at the limit and says which files were left out', async () => {
    const uploadFn = vi.fn(async (picked) => image(picked.name.replace('.jpg', '')));
    const user = userEvent.setup();
    render(<Harness initial={[image('a')]} max={2} uploadFn={uploadFn} />);

    await user.upload(screen.getByLabelText('Upload images'), [file('b.jpg'), file('c.jpg')]);

    await waitFor(() => expect(names()).toHaveLength(2));
    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/c\.jpg: not added, the limit is 2 images/)).toBeInTheDocument();
    expect(screen.getByLabelText('Upload images')).toBeDisabled();
    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });

  it('shows a failed upload with its reason and lets you retry it', async () => {
    const uploadFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('The upload failed. Please try again.'))
      .mockResolvedValueOnce(image('retried'));
    const user = userEvent.setup();
    render(<Harness uploadFn={uploadFn} />);

    await user.upload(screen.getByLabelText('Upload images'), file('f.jpg'));

    expect(await screen.findByText('The upload failed. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Images' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(names()).toHaveLength(1));
    expect(uploadFn).toHaveBeenCalledTimes(2);
  });

  it('lets you dismiss a failed upload', async () => {
    const uploadFn = vi.fn().mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<Harness uploadFn={uploadFn} />);

    await user.upload(screen.getByLabelText('Upload images'), file('f.jpg'));
    await screen.findByText('nope');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });

  it('reorders with the move buttons', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[image('a'), image('b'), image('c')]} onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Move image 1 right' }));
    expect(onValue).toHaveBeenLastCalledWith([image('b'), image('a'), image('c')]);

    await user.click(screen.getByRole('button', { name: 'Move image 3 left' }));
    expect(onValue).toHaveBeenLastCalledWith([image('b'), image('c'), image('a')]);
  });

  it('disables moves that are not possible', () => {
    render(<Harness initial={[image('a'), image('b')]} />);
    expect(screen.getByRole('button', { name: 'Move image 1 left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Make image 1 the main image' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move image 2 right' })).toBeDisabled();
  });

  it('sets another image as the main one', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[image('a'), image('b'), image('c')]} onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Make image 3 the main image' }));

    expect(onValue).toHaveBeenLastCalledWith([image('c'), image('a'), image('b')]);
    expect(within(names()[0]).getByText('Main')).toBeInTheDocument();
  });

  it('reorders by dragging one thumbnail onto another', () => {
    const onValue = vi.fn();
    render(<Harness initial={[image('a'), image('b'), image('c')]} onValue={onValue} />);
    const items = names();

    fireEvent.dragStart(items[0]);
    fireEvent.dragOver(items[2]);
    fireEvent.drop(items[2]);

    expect(onValue).toHaveBeenLastCalledWith([image('b'), image('c'), image('a')]);
  });

  it('removes an image', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[image('a'), image('b')]} onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));

    expect(onValue).toHaveBeenLastCalledWith([image('b')]);
    expect(names()).toHaveLength(1);
  });

  it('edits alt text', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[image('a')]} onValue={onValue} />);

    await user.type(screen.getByLabelText('Alt text for image 1'), 'Front');

    expect(onValue).toHaveBeenLastCalledWith([{ ...image('a'), alt: 'Front' }]);
  });
});
