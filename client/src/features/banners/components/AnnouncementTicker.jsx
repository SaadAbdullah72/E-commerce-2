import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLiveBanners } from '../hooks/useLiveBanners';

function TickerItem({ banner }) {
  const content = (
    <>
      <Zap size={13} className="animate-pulse fill-orange-400 text-orange-400" aria-hidden="true" />
      <span>{banner.title}</span>
      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
        Claim
      </span>
    </>
  );
  const className = 'flex items-center gap-2 tracking-wide';

  return banner.linkPath ? (
    <Link to={banner.linkPath} className={`${className} hover:underline`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * The moving bar above the header. Its text comes from the database; with nothing to show
 * (none live, still loading, or a failed request) the whole bar is simply left out.
 */
export default function AnnouncementTicker() {
  const { data } = useLiveBanners('announcement');
  if (!data || data.length === 0) return null;

  return (
    <div
      aria-label="Announcements"
      className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 py-2 text-xs font-bold text-white shadow-inner"
    >
      <div className="animate-ticker flex items-center space-x-12 whitespace-nowrap">
        {[...data, ...data].map((banner, index) => (
          <TickerItem key={`${banner.id}-${index}`} banner={banner} />
        ))}
      </div>
    </div>
  );
}
