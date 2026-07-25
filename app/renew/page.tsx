import {Alert} from '@mui/material';
import {redirect} from 'next/navigation';

import {getMemberDashboard} from '@/src/actions/portal';
import {RenewMembershipClient} from '@/src/components/membership/RenewMembershipClient';

export const metadata = {
  title: 'Renew Membership - Down East Cyclists',
  description: 'Renew your Down East Cyclists membership',
};

interface RenewPageProps {
  searchParams: Promise<{canceled?: string}>;
}

export default async function RenewPage({searchParams}: RenewPageProps) {
  const params = await searchParams;
  const dashboardData = await getMemberDashboard();

  if ('error' in dashboardData) {
    return (
      <main className="dec-page">
        <section className="dec-container py-16">
          <Alert severity="error">{dashboardData.error}</Alert>
        </section>
      </main>
    );
  }

  if (
    dashboardData.membership &&
    dashboardData.membership.status !== 'expired' &&
    dashboardData.membership.daysRemaining > 0
  ) {
    redirect('/member');
  }

  return (
    <main className="dec-page">
      <section className="dec-container py-16 text-center md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">MEMBERSHIP</div>
        <h1 className="dec-display text-6xl md:text-[92px]">Renew membership</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-8 text-[var(--dec-muted)]">
          Choose a plan and check out securely with Stripe to restore your member benefits.
        </p>
      </section>

      <section className="dec-container pb-20">
        <RenewMembershipClient
          userId={dashboardData.user.id}
          email={dashboardData.user.email}
          name={dashboardData.user.name}
          canceled={params.canceled === 'true'}
          expiredOn={dashboardData.membership?.endDate}
        />
      </section>
    </main>
  );
}
