import { ArrowLeft, ArrowRight, Star, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import ProductImage from '@/features/catalog/components/ProductImage';

import { moveItem } from '../lib/moveItem';
import { ALLOWED_IMAGE_TYPES, validateImageFile } from '../lib/uploadRules';
import { uploadImage } from '../services/uploadService';

const PARALLEL_UPLOADS = 3;

let jobCounter = 0;

/**
 * Upload, order and remove images. The first image is the main one.
 * Value: [{ url, publicId, alt }]. Files go straight to Cloudinary through a signed upload;
 * nothing here ever sees the API secret.
 *
 * @param {object} props
 * @param {{ url: string, publicId: string, alt: string }[]} props.value
 * @param {(next: { url: string, publicId: string, alt: string }[]) => void} props.onChange
 * @param {'products' | 'categories'} props.folder
 * @param {number} props.max
 * @param {boolean} [props.showAlt]
 * @param {boolean} [props.disabled]
 * @param {typeof uploadImage} [props.uploadFn] replaceable for tests
 * @param {(busy: boolean) => void} [props.onBusyChange] true while uploads are running or waiting
 */
export default function ImageUploader({
  value,
  onChange,
  folder,
  max,
  showAlt = true,
  disabled = false,
  uploadFn = uploadImage,
  onBusyChange,
}) {
  const [jobs, setJobs] = useState([]);
  const [notices, setNotices] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [overDropZone, setOverDropZone] = useState(false);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const uploadRef = useRef(uploadFn);
  const pendingRef = useRef([]);
  const runningRef = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    uploadRef.current = uploadFn;
  });

  const commit = (next) => {
    valueRef.current = next;
    onChangeRef.current(next);
  };

  const patchJob = (id, patch) =>
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));

  const pump = () => {
    while (runningRef.current < PARALLEL_UPLOADS && pendingRef.current.length > 0) {
      const job = pendingRef.current.shift();
      runningRef.current += 1;
      patchJob(job.id, { status: 'uploading', progress: 0, error: null });

      uploadRef
        .current(job.file, folder, {
          onProgress: (percent) => patchJob(job.id, { progress: percent }),
        })
        .then((uploaded) => {
          if (valueRef.current.length < max) {
            commit([
              ...valueRef.current,
              { url: uploaded.url, publicId: uploaded.publicId, alt: '' },
            ]);
          }
          setJobs((current) => current.filter((item) => item.id !== job.id));
        })
        .catch((error) => patchJob(job.id, { status: 'failed', error: error.message }))
        .finally(() => {
          runningRef.current -= 1;
          pump();
        });
    }
  };

  const busyCount = jobs.filter((job) => job.status !== 'failed').length;
  const isBusy = busyCount > 0;
  const busyRef = useRef(onBusyChange);
  useEffect(() => {
    busyRef.current = onBusyChange;
  });
  useEffect(() => {
    busyRef.current?.(isBusy);
  }, [isBusy]);
  const room = max - value.length - busyCount;

  const addFiles = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    const messages = [];
    const accepted = [];
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) messages.push(problem);
      else if (accepted.length >= room) {
        messages.push(`${file.name}: not added, the limit is ${max} image${max === 1 ? '' : 's'}.`);
      } else accepted.push(file);
    }
    setNotices(messages);
    if (accepted.length === 0) return;

    const created = accepted.map((file) => ({
      id: ++jobCounter,
      name: file.name,
      file,
      status: 'queued',
      progress: 0,
      error: null,
    }));
    setJobs((current) => [...current, ...created]);
    pendingRef.current.push(...created);
    pump();
  };

  const retry = (job) => {
    pendingRef.current.push(job);
    patchJob(job.id, { status: 'queued', error: null });
    pump();
  };

  const dismiss = (id) => setJobs((current) => current.filter((job) => job.id !== id));

  const updateAlt = (index, alt) =>
    commit(value.map((image, position) => (position === index ? { ...image, alt } : image)));

  const canAdd = !disabled && room > 0;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          if (!canAdd || !event.dataTransfer?.types?.includes('Files')) return;
          event.preventDefault();
          setOverDropZone(true);
        }}
        onDragLeave={() => setOverDropZone(false)}
        onDrop={(event) => {
          setOverDropZone(false);
          if (!event.dataTransfer?.files?.length) return; // a thumbnail being reordered
          event.preventDefault();
          if (canAdd) addFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm ${
          overDropZone ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        } ${canAdd ? '' : 'opacity-60'}`}
      >
        <UploadCloud size={24} className="text-gray-400" aria-hidden="true" />
        <p className="text-gray-600">
          {canAdd ? 'Drag images here, or' : `Limit reached (${max} image${max === 1 ? '' : 's'})`}
        </p>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose images
        </button>
        <p className="text-[11px] text-gray-400">JPG, PNG or WebP, up to 5 MB each.</p>
        <input
          ref={inputRef}
          type="file"
          aria-label="Upload images"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple={max > 1}
          disabled={!canAdd}
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {notices.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-red-600">
          {notices.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {jobs.length > 0 && (
        <ul className="space-y-2" aria-label="Uploads in progress">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-md border border-gray-200 bg-white p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-gray-700">{job.name}</span>
                {job.status === 'failed' ? (
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => retry(job)}
                      className="cursor-pointer font-bold text-blue-600 underline"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(job.id)}
                      className="cursor-pointer font-bold text-gray-500 underline"
                    >
                      Dismiss
                    </button>
                  </span>
                ) : (
                  <span className="shrink-0 text-gray-500">
                    {job.status === 'queued' ? 'Waiting' : `${job.progress}%`}
                  </span>
                )}
              </div>
              {job.status === 'failed' ? (
                <p role="alert" className="mt-1 text-red-600">
                  {job.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${job.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={job.progress}
                  className="mt-1 h-1.5 overflow-hidden rounded bg-gray-100"
                >
                  <div className="h-full bg-blue-500" style={{ width: `${job.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Images">
          {value.map((image, index) => (
            <li
              key={image.publicId}
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => {
                if (dragIndex !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                event.stopPropagation();
                commit(moveItem(value, dragIndex, index));
                setDragIndex(null);
              }}
              className={`rounded-lg border bg-white p-2 ${
                dragIndex === index ? 'opacity-50' : ''
              } ${index === 0 ? 'border-blue-500' : 'border-gray-200'}`}
            >
              <div className="relative">
                <ProductImage
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="aspect-square w-full rounded object-contain"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Main
                  </span>
                )}
              </div>

              {showAlt && (
                <input
                  type="text"
                  value={image.alt}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(event) => updateAlt(index, event.target.value)}
                  aria-label={`Alt text for image ${index + 1}`}
                  placeholder="Describe the image"
                  className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              )}

              <div className="mt-2 flex items-center justify-between">
                <span className="flex gap-1">
                  <IconButton
                    label={`Move image ${index + 1} left`}
                    disabled={disabled || index === 0}
                    onClick={() => commit(moveItem(value, index, index - 1))}
                  >
                    <ArrowLeft size={14} />
                  </IconButton>
                  <IconButton
                    label={`Move image ${index + 1} right`}
                    disabled={disabled || index === value.length - 1}
                    onClick={() => commit(moveItem(value, index, index + 1))}
                  >
                    <ArrowRight size={14} />
                  </IconButton>
                  <IconButton
                    label={`Make image ${index + 1} the main image`}
                    disabled={disabled || index === 0}
                    onClick={() => commit(moveItem(value, index, 0))}
                  >
                    <Star size={14} />
                  </IconButton>
                </span>
                <IconButton
                  label={`Remove image ${index + 1}`}
                  disabled={disabled}
                  onClick={() => commit(value.filter((_, position) => position !== index))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded border border-gray-200 p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
