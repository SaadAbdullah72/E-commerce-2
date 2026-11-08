import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { couponSchema, EMPTY_COUPON_VALUES, toCouponRow } from '../lib/couponSchema';
import { describedBy } from '../lib/formHelpers';
import FormField, { inputClass } from './FormField';

/**
 * Add / edit form for a coupon.
 *
 * @param {object} props
 * @param {object} [props.initialValues]
 * @param {number} [props.usedCount] how many times it was used; above 0 the code and discount are locked
 * @param {(row: object) => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.isSaving]
 * @param {string} [props.serverError]
 */
export default function CouponForm({
  initialValues,
  usedCount = 0,
  onSubmit,
  onCancel,
  isSaving = false,
  serverError = '',
}) {
  const locked = usedCount > 0;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(couponSchema),
    defaultValues: initialValues ?? EMPTY_COUPON_VALUES,
  });
  const [discountType, code, percentOff, amountOff] = useWatch({
    control,
    name: ['discountType', 'code', 'percentOff', 'amountOff'],
  });

  const field = (name, extra) => ({
    id: name,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': describedBy(name, { error: errors[name]?.message, ...extra }),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(toCouponRow(values)))}
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
        <h3 className="text-sm font-bold text-gray-900">Code and discount</h3>

        {locked && (
          <p
            role="note"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          >
            This coupon has been used {usedCount} time{usedCount === 1 ? '' : 's'}, so its code and
            discount can no longer change (past orders must stay accurate). You can still change the
            dates, limits and status. To change the discount, pause this coupon and create a new
            one.
          </p>
        )}

        {/* Locked fields are shown as text; hidden inputs keep their values in the form. */}
        {locked ? (
          <>
            <input type="hidden" {...register('code')} />
            <input type="hidden" {...register('discountType')} />
            <input type="hidden" {...register('percentOff')} />
            <input type="hidden" {...register('amountOff')} />
            <input type="hidden" {...register('maxDiscount')} />
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-gray-500">Code</dt>
                <dd className="font-mono font-bold text-gray-900">{code}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">Discount</dt>
                <dd className="text-gray-900">
                  {discountType === 'percent' ? `${percentOff}% off` : `${amountOff} off`}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <FormField
              id="code"
              label="Coupon code"
              error={errors.code?.message}
              hint="Customers type this at checkout. Saved in capital letters."
            >
              <input
                type="text"
                autoCapitalize="characters"
                className={`${inputClass} font-mono uppercase`}
                {...field('code', { hint: true })}
                {...register('code')}
              />
            </FormField>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-gray-700">Type of discount</legend>
              <div className="flex gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-1.5">
                  <input type="radio" value="percent" {...register('discountType')} /> Percent off
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" value="fixed" {...register('discountType')} /> Fixed amount
                  off
                </label>
              </div>
            </fieldset>

            {discountType === 'percent' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="percentOff"
                  label="Percent off (1 to 100)"
                  error={errors.percentOff?.message}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    {...field('percentOff')}
                    {...register('percentOff')}
                  />
                </FormField>
                <FormField
                  id="maxDiscount"
                  label="Highest discount (optional)"
                  error={errors.maxDiscount?.message}
                  hint="Caps how much one order can save, e.g. 10.00"
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputClass}
                    {...field('maxDiscount', { hint: true })}
                    {...register('maxDiscount')}
                  />
                </FormField>
              </div>
            ) : (
              <FormField id="amountOff" label="Amount off" error={errors.amountOff?.message}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="5.00"
                  className={inputClass}
                  {...field('amountOff')}
                  {...register('amountOff')}
                />
              </FormField>
            )}
          </>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">When and how often</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="startsAt" label="Starts (optional)" error={errors.startsAt?.message}>
            <input
              type="datetime-local"
              className={inputClass}
              {...field('startsAt')}
              {...register('startsAt')}
            />
          </FormField>
          <FormField id="expiresAt" label="Expires (optional)" error={errors.expiresAt?.message}>
            <input
              type="datetime-local"
              className={inputClass}
              {...field('expiresAt')}
              {...register('expiresAt')}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="minSubtotal"
            label="Minimum order"
            error={errors.minSubtotal?.message}
            hint="0 for no minimum"
          >
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              {...field('minSubtotal', { hint: true })}
              {...register('minSubtotal')}
            />
          </FormField>
          <FormField
            id="usageLimit"
            label="Total uses (optional)"
            error={errors.usageLimit?.message}
            hint="Empty means unlimited"
          >
            <input
              type="text"
              inputMode="numeric"
              className={inputClass}
              {...field('usageLimit', { hint: true })}
              {...register('usageLimit')}
            />
          </FormField>
          <FormField
            id="perUserLimit"
            label="Uses per customer"
            error={errors.perUserLimit?.message}
          >
            <input
              type="text"
              inputMode="numeric"
              className={inputClass}
              {...field('perUserLimit')}
              {...register('perUserLimit')}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isActive')} /> Active (can be used)
        </label>
        <p className="text-[11px] text-gray-500">
          Customers will be able to enter coupons once checkout is built. Until then, coupons are
          saved here but cannot be redeemed.
        </p>
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
          disabled={isSaving}
          className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save coupon'}
        </button>
      </div>
    </form>
  );
}
