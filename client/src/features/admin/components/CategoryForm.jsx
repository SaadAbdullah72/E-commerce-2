import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { categorySchema, EMPTY_CATEGORY_VALUES, toCategoryRow } from '../lib/categorySchema';
import { describedBy } from '../lib/formHelpers';
import { slugify } from '../lib/slugify';
import FormField, { inputClass } from './FormField';
import ImageUploader from './ImageUploader';

/**
 * Add / edit form for a category, shown in a dialog.
 *
 * @param {object} props
 * @param {object} [props.initialValues]
 * @param {(row: object) => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.isSaving]
 * @param {string} [props.serverError]
 * @param {typeof import('../services/uploadService').uploadImage} [props.uploadFn]
 */
export default function CategoryForm({
  initialValues,
  onSubmit,
  onCancel,
  isSaving = false,
  serverError = '',
  uploadFn,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(initialValues));
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: initialValues ?? EMPTY_CATEGORY_VALUES,
  });

  const field = (name) => ({
    id: name,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': describedBy(name, { error: errors[name]?.message }),
  });

  const nameField = register('name', {
    onChange: (event) => {
      if (!slugEdited) setValue('slug', slugify(event.target.value, 80));
    },
  });
  const slugField = register('slug', {
    onChange: () => {
      setSlugEdited(true);
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(toCategoryRow(values)))}
      className="space-y-4"
    >
      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </p>
      )}

      <FormField id="name" label="Name" error={errors.name?.message}>
        <input type="text" className={inputClass} {...field('name')} {...nameField} />
      </FormField>
      <FormField id="slug" label="Slug (the web address)" error={errors.slug?.message}>
        <input type="text" className={inputClass} {...field('slug')} {...slugField} />
      </FormField>
      <FormField
        id="sortOrder"
        label="Order in menus (0 is first)"
        error={errors.sortOrder?.message}
      >
        <input
          type="text"
          inputMode="numeric"
          className={inputClass}
          {...field('sortOrder')}
          {...register('sortOrder')}
        />
      </FormField>

      <div>
        <p className="mb-1 text-xs font-semibold text-gray-700">Icon (optional)</p>
        <Controller
          control={control}
          name="icon"
          render={({ field: icon }) => (
            <ImageUploader
              value={icon.value}
              onChange={icon.onChange}
              folder="categories"
              max={1}
              showAlt={false}
              uploadFn={uploadFn}
              onBusyChange={setIsUploading}
            />
          )}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('isActive')} /> Visible in the shop (active)
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : isUploading ? 'Uploading icon...' : 'Save category'}
        </button>
      </div>
    </form>
  );
}
