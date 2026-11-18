import { Star } from 'lucide-react';
import { useRef } from 'react';

/** Read-only stars: "4 out of 5 stars". */
export function Stars({ rating, size = 12 }) {
  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={size}
          aria-hidden="true"
          className={index <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </span>
  );
}

/**
 * A star picker that works with the keyboard: Tab to the group, arrow keys change the rating
 * (Home and End jump to 1 and 5), Enter or Space chooses the focused star.
 *
 * @param {{ value: number, onChange: (value: number) => void, describedBy?: string,
 *   invalid?: boolean, disabled?: boolean }} props
 */
export function StarPicker({ value, onChange, describedBy, invalid = false, disabled = false }) {
  const buttons = useRef([]);

  const move = (next) => {
    const clamped = Math.min(5, Math.max(1, next));
    onChange(clamped);
    buttons.current[clamped - 1]?.focus();
  };

  const onKeyDown = (event) => {
    const current = value || 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(current === 0 ? 1 : current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(5);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Your rating"
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onKeyDown={onKeyDown}
      className="flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <button
          key={index}
          ref={(node) => {
            buttons.current[index - 1] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === index}
          aria-label={`${index} ${index === 1 ? 'star' : 'stars'}`}
          // One tab stop: the chosen star, or the first one when nothing is chosen yet.
          tabIndex={value === index || (!value && index === 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(index)}
          className="cursor-pointer rounded p-0.5 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed"
        >
          <Star
            size={26}
            aria-hidden="true"
            className={index <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );
}
