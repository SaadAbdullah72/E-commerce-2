import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.hoisted(() => ({ uploadReviewMedia: vi.fn(), checkVideoFile: vi.fn() }));
vi.mock('../services/mediaUploadService', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadReviewMedia: upload.uploadReviewMedia,
  checkVideoFile: upload.checkVideoFile,
}));
const service = vi.hoisted(() => ({
  submitReview: vi.fn(),
  editReview: vi.fn(),
  requestReviewCleanup: vi.fn(),
}));
vi.mock('../services/reviewService', () => service);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import ReviewForm from './ReviewForm';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const photo = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });
const done = (publicId, extra = {}) => ({
  type: 'photo',
  url: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
  publicId,
  width: 8,
  height: 6,
  durationSeconds: null,
  bytes: 100,
  ...extra,
});

function renderForm(props = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ReviewForm productId={PRODUCT} onSaved={onSaved} onCancel={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
  return { onSaved, fileInput: screen.getByLabelText('Add photos or a video') };
}

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => vi.resetAllMocks());

describe('ReviewForm: a new review', () => {
  it('asks for a star rating and sends nothing without one', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please choose a star rating.');
    expect(service.submitReview).not.toHaveBeenCalled();
  });

  it('sends a rating-only review (title and comment are optional) with an id made in the browser', async () => {
    service.submitReview.mockResolvedValue({ id: 'x', status: 'pending' });
    const { onSaved } = renderForm();
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('created'));
    expect(service.submitReview).toHaveBeenCalledTimes(1);
    const sent = service.submitReview.mock.calls[0][0];
    expect(sent).toMatchObject({ productId: PRODUCT, rating: 4, title: '', comment: '', media: [] });
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shows a counter for the title and the comment, and refuses text that is too long', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Title (optional)'), 'Great');
    expect(screen.getByText('5/100')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your review (optional)'), {
      target: { value: 'x'.repeat(2001) },
    });
    expect(screen.getByLabelText('Your review (optional)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('The comment can be up to 2000 characters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(service.submitReview).not.toHaveBeenCalled();
  });

  it('links each error to its field for screen readers', async () => {
    renderForm();
    expect(screen.getByLabelText('Title (optional)')).toHaveAttribute('aria-describedby', 'review-title-help');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByRole('radiogroup', { name: 'Your rating' })).toHaveAttribute(
      'aria-describedby',
      'rating-error',
    );
    expect(document.getElementById('rating-error')).toHaveTextContent(/star rating/);
  });

  it('shows the plain-words error when the server refuses, and lets the customer try again', async () => {
    service.submitReview.mockRejectedValue(
      new Error("You've already reviewed this product. Edit your existing review."),
    );
    const { onSaved } = renderForm();
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText(/already reviewed this product/)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
  });

  it('shows a loading state while sending', async () => {
    const pending = deferred();
    service.submitReview.mockReturnValue(pending.promise);
    renderForm();
    await userEvent.click(screen.getByRole('radio', { name: '3 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    pending.resolve({});
  });
});

describe('StarPicker keyboard', () => {
  it('moves with the arrow keys, Home and End, and never goes past 1 or 5', async () => {
    renderForm();
    const group = screen.getByRole('radiogroup', { name: 'Your rating' });
    const checked = () =>
      screen.getAllByRole('radio').findIndex((radio) => radio.getAttribute('aria-checked') === 'true') + 1;

    screen.getByRole('radio', { name: '1 star' }).focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(checked()).toBe(1);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(checked()).toBe(3);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(checked()).toBe(2);
    fireEvent.keyDown(group, { key: 'End' });
    expect(checked()).toBe(5);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(checked()).toBe(5);
    fireEvent.keyDown(group, { key: 'Home' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(checked()).toBe(1);
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveFocus();
  });

  it('has one tab stop', () => {
    renderForm();
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
  });
});

describe('ReviewForm: photos and video', () => {
  it('uploads at once, shows the percentage, and blocks sending until it is done', async () => {
    const pending = deferred();
    let report;
    upload.uploadReviewMedia.mockImplementation((_file, _kind, _id, options) => {
      report = options.onProgress;
      return pending.promise;
    });
    service.submitReview.mockResolvedValue({});
    const { fileInput, onSaved } = renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.upload(fileInput, photo());
    await waitFor(() => expect(upload.uploadReviewMedia).toHaveBeenCalledTimes(1));
    expect(upload.uploadReviewMedia.mock.calls[0][1]).toBe('photo');

    report(40);
    expect(await screen.findByText('40%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Uploading photo 1' })).toHaveValue(40);
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled();
    expect(screen.getByText('Waiting for your files to finish uploading.')).toBeInTheDocument();
    expect(screen.getByText('1/3 photos · 0/1 video')).toBeInTheDocument();

    pending.resolve(done('shopyaro/reviews/r/photo/aaa'));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(service.submitReview.mock.calls[0][0].media).toEqual([done('shopyaro/reviews/r/photo/aaa')]);
  });

  it('uploads three at a time and keeps the rest waiting', async () => {
    const jobs = [];
    upload.uploadReviewMedia.mockImplementation(() => {
      const job = deferred();
      jobs.push(job);
      return job.promise;
    });
    const { fileInput } = renderForm();
    await userEvent.upload(fileInput, [photo('1.jpg'), photo('2.jpg'), photo('3.jpg')]);
    await waitFor(() => expect(jobs).toHaveLength(3));
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    jobs.forEach((job, index) => job.resolve(done(`shopyaro/reviews/r/photo/p${index}`)));
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(3));
  });

  it('shows a failed upload with Retry, blocks sending, and recovers on retry', async () => {
    upload.uploadReviewMedia
      .mockRejectedValueOnce(new Error('The upload failed. Please try again.'))
      .mockResolvedValueOnce(done('shopyaro/reviews/r/photo/bbb'));
    const { fileInput } = renderForm();
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.upload(fileInput, photo());

    expect(await screen.findByText('The upload failed. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled();
    expect(screen.getByText('Retry or remove the files that failed.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry photo 1' }));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(upload.uploadReviewMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
  });

  it('removing a failed file clears the block, with a labelled remove button', async () => {
    upload.uploadReviewMedia.mockRejectedValue(new Error('The upload failed. Please try again.'));
    const { fileInput } = renderForm();
    await userEvent.upload(fileInput, photo());
    await screen.findByText('The upload failed. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(screen.queryByText('The upload failed. Please try again.')).not.toBeInTheDocument();
    expect(screen.getByText('0/3 photos · 0/1 video')).toBeInTheDocument();
  });

  it('numbers the remove buttons per photo', async () => {
    upload.uploadReviewMedia.mockResolvedValue(done('shopyaro/reviews/r/photo/x'));
    const { fileInput } = renderForm();
    await userEvent.upload(fileInput, [photo('1.jpg'), photo('2.jpg')]);
    expect(await screen.findByRole('button', { name: 'Remove photo 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove photo 1' })).toBeInTheDocument();
  });

  it('refuses a fourth photo and says why, without uploading it', async () => {
    upload.uploadReviewMedia.mockResolvedValue(done('shopyaro/reviews/r/photo/x'));
    const { fileInput } = renderForm();
    await userEvent.upload(fileInput, [photo('1.jpg'), photo('2.jpg'), photo('3.jpg')]);
    await screen.findAllByText('Uploaded');
    await userEvent.upload(fileInput, photo('4.jpg'));
    expect(screen.getByRole('alert')).toHaveTextContent('4.jpg: You can add up to 3 photos.');
    expect(upload.uploadReviewMedia).toHaveBeenCalledTimes(3);
  });

  it('refuses wrong types and sizes before anything is uploaded', async () => {
    const { fileInput } = renderForm();
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['x'], 'a.gif', { type: 'image/gif' }),
          new File(['x'], 'evil.php.jpg', { type: 'image/jpeg' }),
        ],
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('a.gif: only JPG, PNG or WebP photos');
    expect(alert).toHaveTextContent('evil.php.jpg: only JPG');

    const big = photo('big.jpg');
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(fileInput, { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('big.jpg: photos can be up to 5 MB.');
    expect(upload.uploadReviewMedia).not.toHaveBeenCalled();
  });

  it('refuses a video that is too long, and uploads one that is fine', async () => {
    upload.checkVideoFile.mockResolvedValueOnce({
      seconds: 90,
      problem: 'v.mp4: videos can be up to 60 seconds.',
    });
    const { fileInput } = renderForm();
    const video = new File(['x'], 'v.mp4', { type: 'video/mp4' });
    await userEvent.upload(fileInput, video);
    expect(await screen.findByRole('alert')).toHaveTextContent('videos can be up to 60 seconds');
    expect(upload.uploadReviewMedia).not.toHaveBeenCalled();
    expect(screen.getByText('0/3 photos · 0/1 video')).toBeInTheDocument();

    upload.checkVideoFile.mockResolvedValueOnce({ seconds: 12, problem: null });
    upload.uploadReviewMedia.mockResolvedValueOnce(
      done('shopyaro/reviews/r/video/v', { type: 'video', durationSeconds: 12 }),
    );
    await userEvent.upload(fileInput, new File(['x'], 'ok.mp4', { type: 'video/mp4' }));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(upload.uploadReviewMedia.mock.calls[0][1]).toBe('video');
    expect(screen.getByRole('button', { name: 'Remove video' })).toBeInTheDocument();
  });
});

describe('ReviewForm: editing', () => {
  const existing = {
    id: '22222222-2222-4222-8222-222222222222',
    rating: 4,
    title: 'Good',
    comment: 'Works',
    media: [
      { id: 'm1', type: 'photo', url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', publicId: 'pid1', width: 8, height: 6, durationSeconds: null, bytes: 100 },
      { id: 'm2', type: 'video', url: 'https://res.cloudinary.com/demo/video/upload/v1/b.mp4', publicId: 'pid2', width: null, height: null, durationSeconds: 9, bytes: 200 },
    ],
  };

  it('tells the customer that editing sends the review for approval again', () => {
    renderForm({ existing });
    expect(
      screen.getByText('Editing sends your review for approval again. It may take up to 24 hours.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and send for approval' })).toBeInTheDocument();
  });

  it('starts with what is saved, and sends the complete list when a file is removed', async () => {
    service.editReview.mockResolvedValue({});
    const { onSaved } = renderForm({ existing });
    expect(screen.getByLabelText('Title (optional)')).toHaveValue('Good');
    expect(screen.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('1/3 photos · 1/1 video')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove video' }));
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and send for approval' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('edited'));
    expect(service.editReview).toHaveBeenCalledTimes(1);
    const sent = service.editReview.mock.calls[0][0];
    expect(sent.id).toBe(existing.id);
    expect(sent.rating).toBe(5);
    expect(sent.media.map((item) => item.publicId)).toEqual(['pid1']);
    expect(service.requestReviewCleanup).toHaveBeenCalled();
  });
});
