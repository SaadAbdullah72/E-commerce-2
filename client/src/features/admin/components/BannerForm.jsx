import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { BANNER_THEMES } from '@/features/banners/lib/themes';

import { bannerSchema, EMPTY_BANNER_VALUES, toBannerRow } from '../lib/bannerSchema';
import { describedBy } from '../lib/formHelpers';
import BannerPreview from './BannerPreview';
import FormField, { inputClass } from './FormField';
import ImageUploader from './ImageUploader';

/**
 * Add / edit form for a hero slide or an announcement.
 *
 * @param {object} props
 * @param {'hero' | 'announcement'} props.kind
 * @param {object} [props.initialValues]
 * @param {(row: object) => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.isSaving]
 * @param {string} [props.serverError]
 * @param {typeof import('../services/uploadService').uploadImage} [props.uploadFn]
 */
export default function BannerForm({
  kind,
  initialValues,
  onSubmit,
  onCancel,
  isSaving = false,
  serverError = '',
  uploadFn,
}) {
  const isHero = kind === 'hero';
  const [isUploading, setIsUploading] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bannerSchema),
    defaultValues: initialValues ?? EMPTY_BANNER_VALUES,
  });
  const [title, badge, subtitle, buttonText, theme, image] = useWatch({
    control,
    name: ['title', 'badge', 'subtitle', 'buttonText', 'theme', 'image'],
  });

  const field = (name, extra) => ({
    id: name,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': describedBy(name, { error: errors[name]?.message, ...extra }),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(toBannerRow(values, kind)))}
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

      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Preview</h3>
        <BannerPreview
          kind={kind}
          title={title}
          badge={badge}
          subtitle={subtitle}
          buttonText={buttonText}
          theme={theme}
          imageUrl={image?.[0]?.url ?? null}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Text and link</h3>

        <FormField
          id="title"
          label={isHero ? 'Headline' : 'Announcement text'}
          error={errors.title?.message}
        >
          <input type="text" className={inputClass} {...field('title')} {...register('title')} />
        </FormField>

        {isHero && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="badge" label="Small label (optional)" error={errors.badge?.message}>
                <input
                  type="text"
                  className={inputClass}
                  {...field('badge')}
                  {...register('badge')}
                />
              </FormField>
              <FormField
                id="buttonText"
                label="Button text (optional)"
                error={errors.buttonText?.message}
              >
                <input
                  type="text"
                  className={inputClass}
                  {...field('buttonText')}
                  {...register('buttonText')}
                />
              </FormField>
            </div>
            <FormField
              id="subtitle"
              label="Sub-heading (optional)"
              error={errors.subtitle?.message}
            >
              <input
                type="text"
                className={inputClass}
                {...field('subtitle')}
                {...register('subtitle')}
              />
            </FormField>
          </>
        )}

        <FormField
          id="linkPath"
          label="Link to a page on this site (optional)"
          error={errors.linkPath?.message}
          hint="For example /category/electronics. Only pages on this site are allowed."
        >
          <input
            type="text"
            className={inputClass}
            {...field('linkPath', { hint: true })}
            {...register('linkPath')}
          />
        </FormField>
      </section>

      {isHero && (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900">Look</h3>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold text-gray-700">Colour theme</legend>
            <div className="flex flex-wrap gap-3">
              {Object.entries(BANNER_THEMES).map(([key, option]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input type="radio" value={key} {...register('theme')} />
                  <span
                    className={`inline-block h-5 w-10 rounded bg-gradient-to-r ${option.gradient}`}
                    aria-hidden="true"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">Picture (optional)</p>
            <Controller
              control={control}
              name="image"
              render={({ field: picture }) => (
                <ImageUploader
                  value={picture.value}
                  onChange={picture.onChange}
                  folder="banners"
                  max={1}
                  showAlt={false}
                  uploadFn={uploadFn}
                  onBusyChange={setIsUploading}
                />
              )}
            />
            {errors.image && (
              <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">
                {errors.image.message ?? 'The picture is not valid. Remove it and upload it again.'}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Schedule and order</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="startsAt" label="Show from (optional)" error={errors.startsAt?.message}>
            <input
              type="datetime-local"
              className={inputClass}
              {...field('startsAt')}
              {...register('startsAt')}
            />
          </FormField>
          <FormField id="endsAt" label="Show until (optional)" error={errors.endsAt?.message}>
            <input
              type="datetime-local"
              className={inputClass}
              {...field('endsAt')}
              {...register('endsAt')}
            />
          </FormField>
          <FormField id="sortOrder" label="Position (0 is first)" error={errors.sortOrder?.message}>
            <input
              type="text"
              inputMode="numeric"
              className={inputClass}
              {...field('sortOrder')}
              {...register('sortOrder')}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isActive')} /> Active (shown in the shop)
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
          {isSaving ? 'Saving...' : isUploading ? 'Uploading picture...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
