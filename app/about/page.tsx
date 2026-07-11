import Image from 'next/image';
import Link from 'next/link';

import {fetchLeaders} from '@/src/contentful/leaders';

const stats = [
  ['Road', 'group rides'],
  ['Trail', 'stewardship'],
  ['Meetup', 'ride calendar'],
];

const subPages = [
  {title: 'Leadership', href: '/about/leadership', copy: 'Meet the volunteers helping guide DEC.'},
  {title: 'Bylaws', href: '/about/bylaws', copy: 'How the club is organized and governed.'},
  {title: 'Membership', href: '/about/membership', copy: 'Benefits, discounts, and renewal details.'},
  {title: 'Privacy', href: '/about/privacy', copy: 'How member and visitor data is handled.'},
];

export default async function About() {
  const leaders = await fetchLeaders();

  return (
    <main className="dec-page">
      <section className="dec-container py-16 text-center md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">ABOUT DEC</div>
        <h1 className="dec-display mx-auto max-w-4xl text-6xl md:text-[92px]">
          Safe miles.
          <br />
          Stronger community.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-8 text-[var(--dec-muted)]">
          Down East Cyclists is a recreational cycling club for Eastern North Carolina riders who
          care about safe roads, open trails, and good company.
        </p>
      </section>

      <section className="dec-container grid gap-5 pb-16 md:grid-cols-3">
        {stats.map(([value, label]) => (
          <div key={label} className="dec-card p-7 text-center">
            <div className="font-[Anton] text-5xl text-[#F20E02]">{value}</div>
            <div className="mt-2 text-sm font-bold uppercase tracking-[.08em] text-[var(--dec-muted-2)]">
              {label}
            </div>
          </div>
        ))}
      </section>

      <section className="dec-container grid gap-10 pb-20 md:grid-cols-[.9fr_1.1fr] md:items-start">
        <div>
          <h2 className="dec-display text-5xl md:text-[56px]">Built by riders</h2>
          <p className="mt-5 leading-8 text-[var(--dec-muted)]">
            The club supports weekly group rides, bike safety advocacy, trail stewardship at Big
            Branch Bike Park, and partnerships with local shops and neighboring cycling groups.
          </p>
          <Link href="/join" className="dec-primary-button mt-7">
            Join the club →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {leaders.slice(0, 4).map((leader) => (
            <Link
              key={leader.name}
              href={leader.link?.url || '/about/leadership'}
              target={leader.link?.url ? '_blank' : undefined}
              className="dec-card overflow-hidden"
            >
              {leader.image?.src && (
                <Image
                  src={leader.image.src}
                  alt={leader.image.alt || `Image of ${leader.name}`}
                  width={leader.image.width || 420}
                  height={leader.image.height || 320}
                  className="h-56 w-full object-cover"
                />
              )}
              <div className="p-5">
                <div className="font-bold">{leader.name}</div>
                <div className="text-sm text-[var(--dec-muted)]">{leader.position}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="dec-container grid gap-5 pb-20 md:grid-cols-4">
        {subPages.map((page) => (
          <Link key={page.href} href={page.href} className="dec-card p-7 transition hover:border-[#F20E02]">
            <h3 className="font-[Anton] text-3xl">{page.title}</h3>
            <p className="mt-3 leading-7 text-[var(--dec-muted)]">{page.copy}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
