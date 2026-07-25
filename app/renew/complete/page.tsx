import {Alert, Box, Button, Paper, Typography} from '@mui/material';
import Link from 'next/link';
import {redirect} from 'next/navigation';

export const metadata = {
  title: 'Renewal Received - Down East Cyclists',
  description: 'Your Down East Cyclists membership renewal payment was received',
};

interface RenewalCompletePageProps {
  searchParams: Promise<{session_id?: string; userId?: string}>;
}

export default async function RenewalCompletePage({searchParams}: RenewalCompletePageProps) {
  const params = await searchParams;

  if (!params.session_id) {
    redirect(params.userId ? `/renew?userId=${encodeURIComponent(params.userId)}` : '/renew');
  }

  return (
    <main className="dec-page">
      <section className="dec-container py-16 md:py-20">
        <Paper className="dec-card" elevation={0} sx={{mx: 'auto', maxWidth: 720, p: 4}}>
          <Typography
            variant="overline"
            sx={{color: '#F20E02', fontWeight: 800, letterSpacing: '.1em'}}
          >
            MEMBERSHIP
          </Typography>
          <Typography variant="h1" sx={{fontSize: {xs: 48, md: 72}, mb: 2}}>
            Renewal received
          </Typography>
          <Alert severity="success" sx={{mb: 3}}>
            Your payment was submitted. Membership updates usually appear after Stripe finishes
            processing the checkout.
          </Alert>
          <Typography color="text.secondary" sx={{mb: 4}}>
            You can sign in to view your digital membership card and manage your account.
          </Typography>
          <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
            <Button component={Link} href="/login" variant="contained">
              Sign in
            </Button>
            <Button component={Link} href="/" variant="outlined">
              Return home
            </Button>
          </Box>
        </Paper>
      </section>
    </main>
  );
}
