import { Check, Circle } from 'lucide-react';

import { getPasswordStrength, PASSWORD_RULES } from '../validation/password';

const BAR_COLORS = {
  1: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-blue-600',
  4: 'bg-emerald-600',
};

/**
 * Strength meter plus requirement checklist for the main password field.
 * Guidance only: the form is gated by validatePassword(), not by this score.
 *
 * @param {object} props
 * @param {string} props.password
 * @param {string[]} [props.personal] Name/email parts the password should not contain.
 */
export default function PasswordStrength({ password, personal }) {
  const { score, label } = getPasswordStrength(password, { personal });

  return (
    <div className="space-y-2">
      {password && (
        <div>
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                className={`h-1.5 flex-1 rounded-full ${
                  segment <= score ? BAR_COLORS[score] : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] font-medium text-gray-600" aria-live="polite">
            Password strength: <span className="font-bold text-gray-900">{label}</span>
          </p>
        </div>
      )}

      <ul className="space-y-1" aria-label="Password requirements">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-1.5 text-[11px] ${
                met ? 'text-emerald-700' : 'text-gray-500'
              }`}
            >
              {met ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Circle size={12} aria-hidden="true" />
              )}
              <span>{rule.label}</span>
              <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
