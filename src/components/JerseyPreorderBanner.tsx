'use client';

import {useEffect, useState} from 'react';

import {isJerseyPreorderActive, jerseyPreorder} from '@/src/lib/promotions/jersey-preorder';

export default function JerseyPreorderBanner() {
  // Start hidden so cached HTML cannot advertise an expired promotion.
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = Date.now();
      const isActive = isJerseyPreorderActive(now);
      setActive(isActive);
      if (isActive) {
        timer = setTimeout(refresh, Math.min(jerseyPreorder.expiresAt - now, 86_400_000));
      }
    };

    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!active) return null;

  return (
    <section
      aria-labelledby="jersey-preorder-heading"
      className="relative z-10 bg-[#F5A623] text-[#16130F]"
    >
      <div className="dec-container flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between md:gap-10 md:py-7">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.08em]">
            DEC / Big Branch Bike Park · MTB jersey pre-orders
          </p>
          <h2
            id="jersey-preorder-heading"
            className="dec-display mt-3 text-3xl leading-tight md:text-4xl"
          >
            Ride the Trails. Support the Trails.
          </h2>
          <p className="mt-3 text-sm leading-6">
            Proceeds support trail tools, volunteer food and refreshments, and maintenance needs not
            covered by the county.
          </p>
          <p className="mt-3 text-sm font-bold leading-6">
            Short sleeve {jerseyPreorder.shortSleevePrice} · Long sleeve{' '}
            {jerseyPreorder.longSleevePrice}
          </p>
          <p className="mt-1 text-sm leading-6">
            Order by{' '}
            <time dateTime={jerseyPreorder.deadlineDate} className="font-bold">
              {jerseyPreorder.deadlineLabel}
            </time>
            .
          </p>
        </div>
        <a
          href={jerseyPreorder.url}
          target="_blank"
          rel="noopener noreferrer"
          className="dec-primary-button shrink-0 self-stretch text-center focus-visible:outline-[#16130F] md:self-center"
        >
          Pre-order your jersey ↗
        </a>
      </div>
    </section>
  );
}
