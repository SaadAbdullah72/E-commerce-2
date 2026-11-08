const TONES = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

/** @param {{ tone?: keyof typeof TONES, children: import('react').ReactNode }} props */
export default function StatusBadge({ tone = 'gray', children }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
