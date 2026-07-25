import Link from 'next/link';

export const dynamic = 'force-static';

const benefits = [
  {
    number: '01',
    title: 'Local shop discounts',
    copy: '10% off at The Bicycle Shop and Bicycle Gallery after 30 days of paid active membership.',
  },
  {
    number: '02',
    title: 'Supported club events',
    copy: 'Access to club-sponsored rides, insured events, centuries, gatherings, and member activities.',
  },
  {
    number: '03',
    title: 'Advocacy and trails',
    copy: 'Your dues support safer cycling, community partnerships, and trail days at Big Branch.',
  },
];

const events = [
  'Coastal Carolina Off-Road Series',
  'Centuries',
  'Road, gravel, and MTB rides',
  'Mountain bike camping trips',
  'Social gatherings',
  'Community involvement',
  'Wounded Warrior Battalion rides',
  'Croatan Buck Fifty aid station',
  'Hope for the Warriors support',
  'Trail cleanup days at Big Branch',
  'Take a Kid Mountain Biking',
  'New Year’s Day community ride',
  'USO NC outdoor adventures',
];

const plans = [
  {
    name: 'Individual',
    price: '$30',
    copy: 'One rider, full club membership.',
  },
  {
    name: 'Family',
    price: '$50',
    copy: 'One household membership for family riders.',
    popular: true,
  },
];

export default function Membership() {
  return (
    <main className="dec-page">
      <section className="dec-container py-16 text-center md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">MEMBERSHIP</div>
        <h1 className="dec-display mx-auto max-w-4xl text-6xl md:text-[92px]">
          Join the crew.
          <br />
          Support the miles.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-8 text-[var(--dec-muted)]">
          DEC membership keeps the club moving through rides, events, local partnerships, trail
          work, and safe cycling advocacy across Eastern NC.
        </p>
      </section>

      <section className="dec-container grid gap-5 pb-16 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.number} className="dec-card p-7 md:p-8">
            <div className="mb-5 font-[Anton] text-3xl text-[#F20E02]">{benefit.number}</div>
            <h2 className="text-xl font-bold">{benefit.title}</h2>
            <p className="mt-3 leading-7 text-[var(--dec-muted)]">{benefit.copy}</p>
          </article>
        ))}
      </section>

      <section className="dec-container grid gap-8 pb-16 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
        <div>
          <div className="mb-3 text-sm font-bold tracking-[.1em] text-[#F20E02]">CLUB EVENTS</div>
          <h2 className="dec-display text-5xl md:text-[64px]">What members support</h2>
          <p className="mt-5 max-w-xl leading-8 text-[var(--dec-muted)]">
            DEC has supported rides, races, trail work, charity events, youth cycling, and community
            programs throughout the years.
          </p>
        </div>

        <div className="dec-card p-6 md:p-8">
          <div className="flex flex-wrap gap-3">
            {events.map((event) => (
              <span
                key={event}
                className="rounded-full border border-[var(--dec-border)] bg-[var(--dec-bg)] px-4 py-2 text-sm font-semibold text-[var(--dec-muted)]"
              >
                {event}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="dec-container pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-[22px] border p-8 ${
                plan.popular
                  ? 'border-[#F20E02] bg-[#16130F] text-white'
                  : 'border-[var(--dec-border)] bg-[var(--dec-surface)]'
              }`}
            >
              {plan.popular && (
                <div className="mb-5 inline-flex rounded-full bg-[#F20E02] px-3 py-1 text-xs font-bold uppercase tracking-[.06em] text-white">
                  Most popular
                </div>
              )}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-[Anton] text-4xl">{plan.name}</h2>
                  <p
                    className={`mt-2 ${plan.popular ? 'text-white/75' : 'text-[var(--dec-muted)]'}`}
                  >
                    {plan.copy}
                  </p>
                </div>
                <div className="font-[Anton] text-6xl">
                  {plan.price}
                  <span className="font-sans text-base text-[var(--dec-muted-2)]">/yr</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] bg-gradient-to-br from-[#F20E02] to-[#8f0801] p-8 text-white md:p-12">
          <h2 className="dec-display text-5xl md:text-[64px]">Ready to renew?</h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/85">
            Create an account, choose a plan, and manage your membership online with secure Stripe
            checkout.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/join"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-bold text-[#F20E02]"
            >
              Join or renew online →
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 font-bold text-white"
            >
              Ask a membership question
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-[var(--dec-muted-2)]">
          Partner discounts are available only to active club members after 30 days of paid
          membership.
        </div>
      </section>
    </main>
  );
}
