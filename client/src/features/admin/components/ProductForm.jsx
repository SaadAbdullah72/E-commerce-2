import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';

import { getDiscountPercent } from '@/features/catalog/lib/mapProduct';

import { describedBy } from '../lib/formHelpers';
import { parseMoneyToMinor } from '../lib/money';
import { EMPTY_PRODUCT_VALUES, productSchema, toProductPayload } from '../lib/productSchema';
import { slugify } from '../lib/slugify';
import { MAX_IMAGES_PER_PRODUCT } from '../lib/uploadRules';
import FormField, { inputClass } from './FormField';
import ImageUploader from './ImageUploader';
import TagInput from './TagInput';

/**
 * Add / edit form for a product. It checks the input (zod), turns it into the database
 * payload and hands it to `onSubmit`; saving itself happens in the page.
 *
 * @param {object} props
 * @param {object} [props.initialValues] form values of an existing product
 * @param {{ id: string, name: string, isActive: boolean }[]} props.categories
 * @param {{ id: string, name: string, isActive: boolean }[]} props.dealTags
 * @param {(payload: object) => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.isSaving]
 * @param {string} [props.serverError]
 * @param {typeof import('../services/uploadService').uploadImage} [props.uploadFn]
 */
export default function ProductForm({
  initialValues,
  categories,
  dealTags,
  onSubmit,
  onCancel,
  isSaving = false,
  serverError = '',
  uploadFn,
}) {
  const isEditing = Boolean(initialValues);
  const [isUploading, setIsUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(isEditing);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues ?? EMPTY_PRODUCT_VALUES,
  });

  const colors = useFieldArray({ control, name: 'colors' });
  const [isFlashDeal, price, compareAtPrice, currentCategoryId] = useWatch({
    control,
    name: ['isFlashDeal', 'price', 'compareAtPrice', 'categoryId'],
  });

  const priceMinor = parseMoneyToMinor(price);
  const compareMinor = compareAtPrice.trim() === '' ? null : parseMoneyToMinor(compareAtPrice);
  const discount = priceMinor !== null ? getDiscountPercent(priceMinor, compareMinor) : 0;

  // Warn before the tab is closed with unsaved work.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const categoryOptions = categories.filter(
    (category) => category.isActive || category.id === currentCategoryId,
  );
  const activeTags = dealTags.filter(
    (tag) => tag.isActive || (initialValues?.dealTagIds ?? []).includes(tag.id),
  );

  const field = (name, extra) => ({
    id: name,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': describedBy(name, { error: errors[name]?.message, ...extra }),
  });

  const titleField = register('title', {
    onChange: (event) => {
      if (!slugEdited) setValue('slug', slugify(event.target.value), { shouldDirty: true });
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
      onSubmit={handleSubmit((values) => onSubmit(toProductPayload(values)))}
      className="space-y-6"
    >
      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Details</h3>

        <FormField id="title" label="Title" error={errors.title?.message}>
          <input type="text" className={inputClass} {...field('title')} {...titleField} />
        </FormField>

        <FormField
          id="slug"
          label="Slug (the web address)"
          error={errors.slug?.message}
          hint="Made from the title. Lowercase letters, numbers and hyphens."
        >
          <input
            type="text"
            className={inputClass}
            {...field('slug', { hint: true })}
            {...slugField}
          />
        </FormField>

        <FormField id="description" label="Description" error={errors.description?.message}>
          <textarea
            rows={4}
            className={inputClass}
            {...field('description')}
            {...register('description')}
          />
        </FormField>

        <FormField id="categoryId" label="Category" error={errors.categoryId?.message}>
          <select className={inputClass} {...field('categoryId')} {...register('categoryId')}>
            <option value="">Choose a category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </FormField>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Price and stock</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="price" label="Sale price" error={errors.price?.message}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="12.99"
              className={inputClass}
              {...field('price')}
              {...register('price')}
            />
          </FormField>
          <FormField
            id="compareAtPrice"
            label="Original price (optional)"
            error={errors.compareAtPrice?.message}
            hint={discount > 0 ? `Shows as ${discount}% off` : 'Fill in to show a discount'}
          >
            <input
              type="text"
              inputMode="decimal"
              placeholder="49.99"
              className={inputClass}
              {...field('compareAtPrice', { hint: true })}
              {...register('compareAtPrice')}
            />
          </FormField>
          <FormField id="stock" label="Stock" error={errors.stock?.message}>
            <input
              type="text"
              inputMode="numeric"
              className={inputClass}
              {...field('stock')}
              {...register('stock')}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Options</h3>

        <FormField
          id="sizes"
          label="Sizes (press Enter to add)"
          error={errors.sizes?.message || errors.sizes?.root?.message}
        >
          <Controller
            control={control}
            name="sizes"
            render={({ field: sizes }) => (
              <TagInput
                id="sizes"
                value={sizes.value}
                onChange={sizes.onChange}
                placeholder="S, M, L ..."
                describedBy={describedBy('sizes', { error: errors.sizes?.message })}
              />
            )}
          />
        </FormField>

        <div>
          <p className="mb-1 text-xs font-semibold text-gray-700">Colours</p>
          <ul className="space-y-2">
            {colors.fields.map((item, index) => (
              <li key={item.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    aria-label={`Colour ${index + 1} name`}
                    placeholder="Name, e.g. Red"
                    className={inputClass}
                    {...register(`colors.${index}.name`)}
                  />
                  {errors.colors?.[index]?.name && (
                    <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">
                      {errors.colors[index].name.message}
                    </p>
                  )}
                  {errors.colors?.[index]?.hex && (
                    <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">
                      {errors.colors[index].hex.message}
                    </p>
                  )}
                </div>
                <input
                  type="color"
                  aria-label={`Colour ${index + 1} shade`}
                  className="h-9.5 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                  {...register(`colors.${index}.hex`)}
                />
                <button
                  type="button"
                  aria-label={`Remove colour ${index + 1}`}
                  onClick={() => colors.remove(index)}
                  className="mt-2 cursor-pointer text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          {errors.colors?.message && (
            <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">
              {errors.colors.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => colors.append({ name: '', hex: '#000000' })}
            className="mt-2 flex cursor-pointer items-center gap-1 text-xs font-bold text-blue-600"
          >
            <Plus size={14} aria-hidden="true" /> Add colour
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">
          Images{' '}
          <span className="font-normal text-gray-500">
            (up to {MAX_IMAGES_PER_PRODUCT}; the first is the main image)
          </span>
        </h3>
        <Controller
          control={control}
          name="images"
          render={({ field: images }) => (
            <ImageUploader
              value={images.value}
              onChange={images.onChange}
              folder="products"
              max={MAX_IMAGES_PER_PRODUCT}
              uploadFn={uploadFn}
              onBusyChange={setIsUploading}
            />
          )}
        />
        {errors.images && (
          <p role="alert" className="text-[11px] font-medium text-red-600">
            {errors.images.message ??
              'One of the images is not valid. Remove it and upload it again.'}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Promotion and visibility</h3>

        {activeTags.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-xs font-semibold text-gray-700">Deal tags</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {activeTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" value={tag.id} {...register('dealTagIds')} /> {tag.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isFlashDeal')} /> Flash deal
        </label>
        {isFlashDeal && (
          <FormField id="flashEndsAt" label="Flash deal ends" error={errors.flashEndsAt?.message}>
            <input
              type="datetime-local"
              className={inputClass}
              {...field('flashEndsAt')}
              {...register('flashEndsAt')}
            />
          </FormField>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isActive')} /> Visible in the shop (active)
        </label>
      </section>

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
          {isSaving ? 'Saving...' : isUploading ? 'Uploading images...' : 'Save product'}
        </button>
      </div>
    </form>
  );
}
