import {Alert} from '@mui/material';

import {JoinForm} from '@/src/components/membership/JoinForm';

export const metadata = {
  title: 'Join - Down East Cyclists',
  description: 'Become a member of Down East Cyclists and enjoy exclusive benefits',
};

interface JoinPageProps {
  searchParams: Promise<{canceled?: string}>;
}

export default async function JoinPage({searchParams}: JoinPageProps) {
  const params = await searchParams;
  const wasCanceled = params.canceled === 'true';

  return (
    <main className="dec-page">
      <section className="dec-container py-16 text-center md:py-20">
        <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">MEMBERSHIP</div>
        <h1 className="dec-display text-6xl md:text-[92px]">Join in two minutes</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-8 text-[var(--dec-muted)]">
          Pick a plan, check out securely with Stripe, and get your digital membership card on the
          spot. Cancel anytime.
        </p>
      </section>

      <section className="dec-container pb-20">
        {wasCanceled && (
          <Alert severity="info" sx={{mb: 3}}>
            Your payment was canceled. You can try again below or contact us if you need assistance.
          </Alert>
        )}

        <JoinForm />
      </section>
    </main>
  );
}
