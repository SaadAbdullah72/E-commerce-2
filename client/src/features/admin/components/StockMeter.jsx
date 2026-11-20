import { stockStatus } from '../lib/adminStats';

const FULL_BAR_AT = 20; // 20 units or more fills the bar
const FILL = { out: 'bg-red-600', low: 'bg-amber-500', ok: 'bg-green-600' };

/**
 * A thin bar next to the stock number. Red when out of stock, amber when low, green otherwise.
 * It only decorates: the number and the stock badge say the same thing in words.
 *
 * @param {{ stock: number }} props
 */
export default function StockMeter({ stock }) {
  const units = Number.isFinite(stock) ? Math.max(stock, 0) : 0;
  const status = stockStatus(stock);
  const width = status === 'out' ? 0 : Math.max((Math.min(units, FULL_BAR_AT) / FULL_BAR_AT) * 100, 6);
  return (
    <div aria-hidden="true" data-stock={status} className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
      <div className={`h-full rounded-full ${FILL[status]}`} style={{ width: `${width}%` }} />
    </div>
  );
}
