import React, { useState, useEffect } from 'react';

export default function FlashTimer({ targetDate }) {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    if (difference <= 0) return { hours: 0, minutes: 0, seconds: 0 };

    return {
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const format = (num) => String(num).padStart(2, '0');

  return (
    <div className="flex items-center space-x-1 font-bold text-sm">
      <span className="text-red-600 mr-1 uppercase tracking-wider text-xs font-extrabold">Ends In:</span>
      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">{format(timeLeft.hours)}h</span>
      <span>:</span>
      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">{format(timeLeft.minutes)}m</span>
      <span>:</span>
      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">{format(timeLeft.seconds)}s</span>
    </div>
  );
}