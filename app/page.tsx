import Link from 'next/link';

import TrailStatus from '@/src/components/TrailStatus';
import {getHeroVideo} from '@/src/contentful/video';
import {getUpcomingMeetupRides} from '@/src/lib/meetup/events';

const meetupUrl = 'https://www.meetup.com/down-east-cyclists/events/calendar/';

const whyJoin = [
  {
    number: '01',
    title: 'Group rides, all levels',
    copy: 'Weekly no-drop road and gravel rides. Never ride alone unless you want to.',
  },
  {
    number: '02',
    title: 'Trail access and upkeep',
    copy: 'Support Big Branch Bike Park and get first word on new trail openings.',
  },
  {
    number: '03',
    title: 'Shop and event perks',
    copy: 'Member discounts at local bike shops plus club-only events and clinics.',
  },
];

export default async function Home() {
  const [video, rides] = await Promise.all([getHeroVideo(), getUpcomingMeetupRides()]);
  const videoUrl = video.fields.file?.url
    ? video.fields.file.url.startsWith('//')
      ? `https:${video.fields.file.url}`
      : video.fields.file.url
    : '';

  return (
    <main className="dec-page">
      <section className="relative -mt-[76px] min-h-[calc(100vh-80px)] overflow-hidden pt-[76px] md:min-h-[720px]">
        <div className="absolute inset-0 bg-[#0E0E10]">
          {videoUrl && (
            <video
              className="absolute inset-0 hidden h-full w-full object-cover motion-safe:animate-[heroKen_24s_ease-in-out_infinite] md:block"
              src={videoUrl}
              poster="/redesign-assets/hero-poster.png"
              autoPlay
              muted
              loop
              playsInline
            />
          )}
          <div className="absolute inset-0 bg-[url('/redesign-assets/hero-poster.png')] bg-cover bg-center md:hidden" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 to-black/90 md:bg-gradient-to-r md:from-[#0E0E10]/95 md:via-[#0E0E10]/65 md:to-[#0E0E10]/15" />
        </div>

        <div className="dec-container relative z-10 flex min-h-[calc(100vh-80px)] max-w-[1220px] flex-col justify-center py-14 text-[#F5F3EF] md:min-h-[720px] md:py-20">
          <div className="mb-6">
            <TrailStatus variant="hero" showTitle={false} maxItems={1} />
          </div>

          <h1 className="dec-display text-[64px] sm:text-[82px] md:text-[118px]">
            <span className="text-[#F20E02]">#Ride</span>
            <br />
            <span className="text-[#F5A623]">Down</span>
            <br />
            <span className="text-[#2FBFA0]">East</span>
          </h1>
          <p className="mt-7 max-w-xl text-base font-light leading-7 text-[#C8C8CC] md:text-xl md:leading-8">
            A recreational cycling club built on safe miles, good company, and the roads and trails
            of Eastern NC.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/join" className="dec-primary-button">
              Become a member →
            </Link>
            <a href={meetupUrl} target="_blank" rel="noopener noreferrer" className="dec-secondary-button border-white/25 text-[#F5F3EF]">
              See rides on Meetup ↗
            </a>
          </div>

          <div className="mt-12 grid max-w-lg grid-cols-3 gap-5 md:mt-14 md:gap-10">
            <div>
              <div className="font-[Anton] text-3xl md:text-[38px]">Road</div>
              <div className="text-[11px] font-semibold tracking-[.04em] text-[#A9A9AE] md:text-[13px]">
                GRAVEL
              </div>
            </div>
            <div>
              <div className="font-[Anton] text-3xl md:text-[38px]">MTB</div>
              <div className="text-[11px] font-semibold tracking-[.04em] text-[#A9A9AE] md:text-[13px]">
                TRAILS
              </div>
            </div>
            <div>
              <div className="font-[Anton] text-3xl md:text-[38px]">Meetup</div>
              <div className="text-[11px] font-semibold tracking-[.04em] text-[#A9A9AE] md:text-[13px]">
                RIDE CALENDAR
              </div>
            </div>
          </div>
        </div>
      </section>

      <TrailStatus variant="band" showTitle={false} />

      <section className="dec-container py-20 md:py-24">
        <div className="mb-10 flex flex-col gap-5 md:mb-12 md:flex-row md:items-end md:justify-between">
          <h2 className="dec-display max-w-2xl text-5xl md:text-[56px]">
            More than a
            <br />
            ride. It&apos;s a <span className="text-[#F20E02]">crew.</span>
          </h2>
          <p className="max-w-sm leading-7 text-[var(--dec-muted)]">
            Everything your membership unlocks from the first pedal stroke.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {whyJoin.map((item) => (
            <article key={item.number} className="dec-card p-7 md:p-8">
              <div className="mb-5 font-[Anton] text-3xl text-[#F20E02]">{item.number}</div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-3 leading-7 text-[var(--dec-muted)]">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dec-container pb-20 md:pb-24">
        <div className="grid gap-8 rounded-[28px] bg-gradient-to-br from-[#F20E02] to-[#8f0801] p-7 text-white md:grid-cols-2 md:p-14">
          <div>
            <h2 className="dec-display text-5xl md:text-[64px]">
              Join in
              <br />
              two minutes
            </h2>
            <p className="mt-5 max-w-md leading-7 text-white/85">
              Pick a plan, pay securely, get your digital membership card on the spot. Cancel
              anytime.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-white/15 px-4 py-2">✓ Instant digital card</span>
              <span className="rounded-full bg-white/15 px-4 py-2">✓ Secure Stripe checkout</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-[18px] bg-white p-6 text-[#16130F]">
              <div>
                <div className="text-lg font-bold">Individual</div>
                <div className="text-sm text-[#7A7266]">One rider, all the miles</div>
              </div>
              <div className="font-[Anton] text-4xl">$30<span className="font-sans text-sm text-[#7A7266]">/yr</span></div>
            </div>
            <div className="flex items-center justify-between rounded-[18px] border-2 border-white bg-[#16130F] p-6">
              <div>
                <div className="text-lg font-bold">
                  Family <span className="rounded-full bg-[#F20E02] px-2 py-1 text-[10px]">POPULAR</span>
                </div>
                <div className="text-sm text-[#C4BCAE]">Up to 5 household riders</div>
              </div>
              <div className="font-[Anton] text-4xl">$50<span className="font-sans text-sm text-[#C4BCAE]">/yr</span></div>
            </div>
            <Link href="/join" className="mt-1 rounded-xl bg-white px-5 py-4 text-center font-bold text-[#F20E02]">
              Choose a plan and join →
            </Link>
          </div>
        </div>
      </section>

      <section className="dec-container pb-20 md:pb-24">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 text-sm font-bold tracking-[.1em] text-[#F20E02]">
              UPCOMING RIDES
            </div>
            <h2 className="dec-display text-5xl md:text-[52px]">The next five rides</h2>
          </div>
          <a href={meetupUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#F20E02]">
            Full schedule on Meetup ↗
          </a>
        </div>

        {rides.length ? (
          <div className="flex flex-col gap-3">
            {rides.map((ride) => {
              const date = ride.date ? new Date(ride.date) : null;
              return (
                <a
                  key={`${ride.title}-${ride.link}`}
                  href={ride.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dec-card flex items-center gap-5 p-5 transition hover:-translate-y-0.5 hover:border-[#F20E02] md:gap-6 md:p-6"
                >
                  <div className="min-w-16 text-center">
                    <div className="font-[Anton] text-sm tracking-[.04em] text-[#F20E02]">
                      {date ? date.toLocaleDateString('en-US', {weekday: 'short'}) : 'DEC'}
                    </div>
                    <div className="font-[Anton] text-3xl leading-none">
                      {date ? date.getDate() : '→'}
                    </div>
                    <div className="text-[11px] tracking-[.05em] text-[var(--dec-muted-2)]">
                      {date ? date.toLocaleDateString('en-US', {month: 'short'}) : 'RIDE'}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-[var(--dec-border)]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold md:text-xl">{ride.title}</h3>
                    <div className="mt-1 text-sm text-[var(--dec-muted)]">{ride.meta}</div>
                  </div>
                  <span className="hidden whitespace-nowrap text-sm font-bold text-[#F20E02] sm:inline">
                    RSVP ↗
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="dec-card p-8 text-center">
            <p className="text-[var(--dec-muted)]">Ride listings are temporarily unavailable.</p>
            <a href={meetupUrl} target="_blank" rel="noopener noreferrer" className="dec-primary-button mt-5">
              See rides on Meetup ↗
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
