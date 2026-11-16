import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Mail, MapPin, Package, Phone, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import FormAlert from '@/features/auth/components/FormAlert';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { citiesForState, STATES } from '@/shared/constants/locations';

import { updateProfile } from '../services/profileService';
import {
  ADDRESS_MAX,
  initialProfileValues,
  NAME_MAX,
  PHONE_MAX,
  profileSchema,
} from '../validation/profile';

const INPUT =
  'w-full rounded-xl border bg-gray-50 py-2.5 text-xs text-gray-900 transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500';
const INPUT_OK = 'border-gray-200 focus:border-blue-600 focus:ring-blue-600/20';
const INPUT_BAD = 'border-red-400 focus:border-red-500 focus:ring-red-500/20';

function Field({ id, label, error, icon: Icon, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-gray-700">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        {children}
      </div>
      {hint && !error && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ProfileForm({ account, email, userId, refreshAccount }) {
  const [saved, setSaved] = useState(false);
  const save = useMutation({ mutationFn: (values) => updateProfile(userId, values) });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: initialProfileValues(account),
  });
  const state = useWatch({ control, name: 'state' });

  const inputProps = (name) => ({
    id: `profile-${name}`,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `profile-${name}-error` : undefined,
    className: `${INPUT} ${errors[name] ? INPUT_BAD : INPUT_OK}`,
  });

  const onSubmit = async (values) => {
    setSaved(false);
    try {
      await save.mutateAsync(values);
    } catch {
      return; // the message is shown from save.error
    }
    await refreshAccount(); // so the navbar and the Shipping page see the new values
    reset(values);
    setSaved(true);
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setSaved(false)}
      className="space-y-6"
    >
      {saved && <FormAlert variant="success">Your profile was saved.</FormAlert>}
      {save.isError && <FormAlert>{save.error.message}</FormAlert>}

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <User size={18} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-900">Personal Information</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="profile-fullName" label="Full Name" error={errors.fullName?.message}>
              <input
                {...register('fullName')}
                {...inputProps('fullName')}
                id="profile-fullName"
                type="text"
                autoComplete="name"
                maxLength={NAME_MAX}
                className={`${INPUT} pl-3 ${errors.fullName ? INPUT_BAD : INPUT_OK}`}
              />
            </Field>
          </div>

          <Field
            id="profile-email"
            label="Email Address"
            icon={Mail}
            hint="Your email can't be changed here."
          >
            <input
              id="profile-email"
              type="email"
              value={email}
              disabled
              readOnly
              className={`${INPUT} pr-3 pl-9 ${INPUT_OK}`}
            />
          </Field>

          <Field id="profile-phone" label="Phone Number" icon={Phone} error={errors.phone?.message}>
            <input
              {...register('phone')}
              {...inputProps('phone')}
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              maxLength={PHONE_MAX}
              className={`${INPUT} pr-3 pl-9 ${errors.phone ? INPUT_BAD : INPUT_OK}`}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <MapPin size={18} className="text-orange-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-900">Default Shipping Address</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="profile-address" label="Street Address" error={errors.address?.message}>
              <input
                {...register('address')}
                {...inputProps('address')}
                id="profile-address"
                type="text"
                autoComplete="street-address"
                maxLength={ADDRESS_MAX}
                className={`${INPUT} pl-3 ${errors.address ? INPUT_BAD : INPUT_OK}`}
              />
            </Field>
          </div>

          <Field id="profile-state" label="State" error={errors.state?.message}>
            <select
              {...register('state', {
                onChange: () => setValue('city', '', { shouldDirty: true }),
              })}
              {...inputProps('state')}
              id="profile-state"
              className={`${INPUT} cursor-pointer pl-3 ${errors.state ? INPUT_BAD : INPUT_OK}`}
            >
              <option value="">Select State</option>
              {STATES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="profile-city" label="City" error={errors.city?.message}>
            <select
              {...register('city')}
              {...inputProps('city')}
              id="profile-city"
              disabled={!state}
              className={`${INPUT} cursor-pointer pl-3 ${errors.city ? INPUT_BAD : INPUT_OK}`}
            >
              <option value="">{state ? 'Select City' : 'Select State First'}</option>
              {citiesForState(state).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-gray-500">
          This address is filled in for you at checkout. You can still change it for each order.
        </p>
      </div>

      <button
        type="submit"
        disabled={!isDirty || save.isPending}
        className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {save.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

export default function ProfilePage({ onLogout }) {
  const navigate = useNavigate();
  const { user, account, refreshAccount } = useAuth();

  const name = account?.fullName || 'Customer';
  const email = user?.email || '';

  let content;
  if (account?.profileMissing) {
    content = (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700"
      >
        Profile not found. Contact support.
      </p>
    );
  } else if (account?.loadFailed) {
    content = (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"
      >
        <p className="font-bold">We couldn&apos;t load your profile.</p>
        <button
          type="button"
          onClick={() => refreshAccount()}
          className="mt-2 cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  } else {
    content = (
      <ProfileForm
        account={account}
        email={email}
        userId={user?.id}
        refreshAccount={refreshAccount}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              Account Settings
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Manage your personal details, default shipping address, and order tracking.
            </p>
          </div>

          <button
            onClick={async () => {
              if (onLogout) await onLogout();
              navigate('/login');
            }}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-xl border border-red-200 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 sm:self-auto"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-xl font-black text-blue-600">
                {name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <h2 className="text-base font-bold text-gray-900">{name}</h2>
              <p className="mt-0.5 text-xs break-all text-gray-500">{email}</p>

              <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-4 text-[11px] font-bold text-emerald-600">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>Verified Account</span>
              </div>
            </div>

            <div className="space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-xs">
              <Link
                to="/orders"
                className="flex items-center justify-between rounded-xl p-3 text-xs font-bold text-gray-700 transition hover:bg-blue-50/60 hover:text-blue-600"
              >
                <div className="flex items-center gap-2.5">
                  <Package size={16} className="text-blue-600" aria-hidden="true" />
                  <span>My Orders & Tracking</span>
                </div>
              </Link>

              <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-700">
                <div className="flex items-center gap-2.5">
                  <User size={16} aria-hidden="true" />
                  <span>Personal Details</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:p-8 lg:col-span-8">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
