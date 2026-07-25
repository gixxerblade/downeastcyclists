import Image from 'next/image';
import Link from 'next/link';

import {fetchLeaders} from '@/src/contentful/leaders';

export default async function Leaders() {
  const data = await fetchLeaders();

  return (
    <main className="dec-page">
      <section className="dec-container py-16 text-center md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">CLUB LEADERSHIP</div>
        <h1 className="dec-display mx-auto max-w-4xl text-6xl md:text-[92px]">
          Volunteers keeping DEC rolling
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-8 text-[var(--dec-muted)]">
          Down East Cyclists is organized by club volunteers who coordinate rides, membership, trail
          support, partnerships, and community events.
        </p>
      </section>

      <section className="dec-container pb-20">
        {data.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.map((leader) => {
              const card = (
                <article className="dec-card h-full overflow-hidden transition hover:border-[#F20E02]">
                  {leader.image?.src ? (
                    <Image
                      src={leader.image.src}
                      height={leader.image.height || 420}
                      width={leader.image.width || 420}
                      alt={leader.image.alt || `Image of ${leader.name}`}
                      className="h-72 w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-72 place-items-center bg-[#16130F] text-white">
                      <span className="font-[Anton] text-5xl">
                        {(leader.name || 'DEC').slice(0, 1)}
                      </span>
                    </div>
                  )}
                  <div className="p-6">
                    <p className="text-xl font-bold">{leader.name}</p>
                    {leader.position && (
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[.06em] text-[#F20E02]">
                        {leader.position}
                      </p>
                    )}
                  </div>
                </article>
              );

              return leader.link?.url ? (
                <Link
                  key={leader.name}
                  href={leader.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {card}
                </Link>
              ) : (
                <div key={leader.name}>{card}</div>
              );
            })}
          </div>
        ) : (
          <div className="dec-card mx-auto max-w-2xl p-8 text-center">
            <h2 className="font-[Anton] text-4xl">Leadership list coming soon</h2>
            <p className="mt-3 text-[var(--dec-muted)]">
              Club leadership data is currently being updated.
            </p>
          </div>
        )}
      </section>

      <section className="dec-container pb-20">
        <div className="rounded-[28px] bg-gradient-to-br from-[#F20E02] to-[#8f0801] p-8 text-white md:p-12">
          <h2 className="dec-display text-5xl md:text-[64px]">Want to help?</h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/85">
            DEC runs on member involvement. Join the club, show up for rides, and ask where your
            time can support the next event or trail day.
          </p>
          <Link
            href="/join"
            className="mt-7 inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#F20E02]"
          >
            Join the club →
          </Link>
        </div>
      </section>
    </main>
  );
}
