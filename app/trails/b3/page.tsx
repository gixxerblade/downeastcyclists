import Image from 'next/image';
import Link from 'next/link';

import TrailStatus from '@/src/components/TrailStatus';
import {getB3Assets} from '@/src/contentful/b3';

const trailLinks = [
  {
    name: 'Inner Loop',
    difficulty: 'Beginner',
    miles: '1.6 mi',
    color: '#2FBFA0',
    href: 'https://www.strava.com/segments/28334000',
  },
  {
    name: 'Outer Loop',
    difficulty: 'Intermediate',
    miles: '4.6 mi',
    color: '#F5A623',
    href: 'https://www.strava.com/segments/28334049',
  },
];

export default async function B3() {
  const [logo, trailMap, futureMap] = await getB3Assets();
  const logoUrl = logo?.fields.file?.url ? `https:${logo.fields.file.url}` : '';
  const trailMapUrl = trailMap?.fields.file?.url ? `https:${trailMap.fields.file.url}` : '';
  const futureMapUrl = futureMap?.fields.file?.url ? `https:${futureMap.fields.file.url}` : '';

  return (
    <main className="dec-page">
      <section className="dec-container grid gap-10 py-16 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-20">
        <div>
          <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">
            BIG BRANCH BIKE PARK
          </div>
          <h1 className="dec-display text-6xl md:text-[92px]">B3 trails</h1>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-[var(--dec-muted)]">
            Beginner flow and intermediate single-track inside Onslow County&apos;s Burton Park
            area, open dawn to dusk when trail conditions allow.
          </p>
          <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <a
              href="https://maps.google.com/?q=Big+Branch+Bike+Park"
              target="_blank"
              rel="noopener noreferrer"
              className="dec-primary-button min-h-14 whitespace-nowrap px-4 text-base leading-none"
            >
              Get directions ↗
            </a>
            <Link
              href="/join"
              className="dec-secondary-button min-h-14 whitespace-nowrap px-4 text-base leading-none"
            >
              Support the trail
            </Link>
            <Link
              href="/report-trail-issue?system=big-branch-bike-park"
              className="dec-secondary-button min-h-14 whitespace-nowrap px-4 text-base leading-none sm:col-span-2 xl:col-span-1"
            >
              ⚠️ Report Trail Issue
            </Link>
          </div>
        </div>

        <div className="dec-card p-5">
          <TrailStatus showTitle={false} />
        </div>
      </section>

      <section className="dec-container grid gap-8 pb-20 md:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-5">
          {logoUrl && (
            <div className="dec-card p-6">
              <Image
                src={logoUrl}
                width={600}
                height={400}
                alt="Big Branch Bike Park logo"
                className="h-auto w-full"
              />
            </div>
          )}

          <div className="dec-card p-6">
            <h2 className="font-[Anton] text-3xl">Trail rules</h2>
            <div className="mt-4 space-y-3 leading-7 text-[var(--dec-muted)]">
              <p>
                The trail is open from dawn to dusk and the county usually locks the gate before
                dark.
              </p>
              <p>
                <strong>Direction:</strong> Monday, Wednesday, Friday, Sunday clockwise.
              </p>
              <p>
                <strong>Direction:</strong> Tuesday, Thursday, Saturday counter clockwise.
              </p>
            </div>
          </div>

          <div className="dec-card p-6">
            <h2 className="font-[Anton] text-3xl">Segments</h2>
            <div className="mt-4 flex flex-col gap-3">
              {trailLinks.map((trail) => (
                <a
                  key={trail.name}
                  href={trail.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[var(--dec-border)] p-4"
                >
                  <span className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{backgroundColor: trail.color}} />
                    <span>
                      <span className="block font-bold">{trail.name}</span>
                      <span className="text-sm text-[var(--dec-muted)]">
                        {trail.difficulty} · {trail.miles}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#F20E02]">Strava ↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {trailMapUrl && (
            <figure className="dec-card overflow-hidden">
              <Image
                src={trailMapUrl}
                width={900}
                height={650}
                alt="Current Big Branch Bike Park trail map"
                className="h-auto w-full"
              />
              <figcaption className="border-t border-[var(--dec-border)] p-4 text-sm font-bold text-[var(--dec-muted)]">
                Current Big Branch Bike Park configuration
              </figcaption>
            </figure>
          )}

          {futureMapUrl && (
            <figure className="dec-card overflow-hidden">
              <Image
                src={futureMapUrl}
                width={900}
                height={650}
                alt="Future Big Branch Bike Park concept map"
                className="h-auto w-full"
              />
              <figcaption className="border-t border-[var(--dec-border)] p-4 text-sm font-bold text-[var(--dec-muted)]">
                Future concept of Big Branch Bike Park
              </figcaption>
            </figure>
          )}
        </div>
      </section>
    </main>
  );
}
