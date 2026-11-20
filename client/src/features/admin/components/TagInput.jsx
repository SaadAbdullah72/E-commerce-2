import { X } from 'lucide-react';
import { useState } from 'react';

import { focusRing } from '@/shared/design/tokens';

import { inputClass } from './FormField';

/**
 * Type a value and press Enter (or comma) to add it as a chip. Used for sizes.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string[]} props.value
 * @param {(next: string[]) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.describedBy]
 */
export default function TagInput({ id, value, onChange, placeholder, describedBy }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (text && !value.some((tag) => tag.toLowerCase() === text.toLowerCase())) {
      onChange([...value, text]);
    }
    setDraft('');
  };

  return (
    <div>
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add();
          } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        className={inputClass}
      />
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag}
              className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
                className={`cursor-pointer rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-red-600 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center ${focusRing}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
