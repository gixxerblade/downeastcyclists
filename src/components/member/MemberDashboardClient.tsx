'use client';

import {
  Container,
  Typography,
  Box,
  Alert,
  Paper,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';

import {getDigitalCard} from '@/src/lib/effect/client-card';
import type {CardError, NotFoundError, SessionError} from '@/src/lib/effect/errors';
import type {
  MemberDashboardResponse,
  MembershipCard as MembershipCardSchema,
} from '@/src/lib/effect/schemas';

import {DigitalCard} from './DigitalCard';
import {MembershipCard} from './MembershipCard';
import {PortalButton} from './PortalButton';

type MemberDashboardData = MemberDashboardResponse;

interface MemberDashboardClientProps {
  initialData: MemberDashboardData | {error: string};
}

export function MemberDashboardClient({initialData}: MemberDashboardClientProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id') || null;
  const [data, setData] = useState(initialData);
  const [isPolling, setIsPolling] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  // Fetch digital card using Effect + TanStack Query
  // Only enabled when user has an active membership
  const cardQuery = useQuery<
    {hasCard: boolean; card: MembershipCardSchema | null},
    CardError | NotFoundError | SessionError
  >({
    queryKey: ['digitalCard'],
    queryFn: () => Effect.runPromise(getDigitalCard()),
    // Only fetch when membership exists and not in error state
    enabled: !('error' in data) && !!data.membership,
    // Refetch when window regains focus (e.g., returning from Stripe)
    refetchOnWindowFocus: true,
    // Don't retry on 401/404 errors
    retry: (failureCount: number, error: CardError | NotFoundError | SessionError) => {
      if (error._tag === 'SessionError' || error._tag === 'NotFoundError') {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    // If we have a session_id and no membership, poll for it
    const shouldPoll = sessionId && !('error' in data) && !data.membership && pollAttempts < 10;

    if (shouldPoll) {
      setIsPolling(true);

      const pollForMembership = async () => {
        try {
          const response = await fetch('/api/member/dashboard');
          if (response.ok) {
            const freshData = await response.json();

            // Check if response has error (shouldn't be 200 but just in case)
            if ('error' in freshData) {
              console.error('Dashboard error:', freshData.error);
            } else {
              setData(freshData);

              // If membership found, stop polling and refetch card
              if (freshData.membership) {
                setIsPolling(false);
                // Refetch the digital card now that membership exists
                cardQuery.refetch();
              }
            }
          }
        } catch (error) {
          console.error('Error polling for membership:', error);
        }

        setPollAttempts((prev) => prev + 1);
      };

      // Poll every 2 seconds
      const timerId = setTimeout(pollForMembership, 2000);
      return () => clearTimeout(timerId);
    } else if (pollAttempts >= 10) {
      // Stop polling after 10 attempts (20 seconds)
      setIsPolling(false);
    }
  }, [sessionId, data, pollAttempts]);

  if ('error' in data) {
    return (
      <Container maxWidth="md" sx={{py: 4}}>
        <Alert severity="error">{data.error}</Alert>
      </Container>
    );
  }

  const {user, membership, canManageSubscription} = data;

  // Show loading state if polling for membership after checkout
  if (isPolling && sessionId) {
    return (
      <Container maxWidth="md" sx={{py: 4}}>
        <Box sx={{textAlign: 'center'}}>
          <CircularProgress size={60} sx={{mb: 3}} />
          <Typography variant="h5" gutterBottom>
            Setting up your membership...
          </Typography>
          <Typography color="text.secondary">Please wait while we process your payment.</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box className="dec-page" sx={{minHeight: '100vh'}}>
    <Container maxWidth="lg" sx={{py: {xs: 5, md: 8}}}>
      {/* Success message after checkout */}
      {sessionId && membership && (
        <Alert severity="success" sx={{mb: 3}}>
          Welcome! Your membership has been activated successfully.
        </Alert>
      )}

      {/* Warning if polling timed out */}
      {sessionId && !membership && pollAttempts >= 10 && (
        <Alert severity="warning" sx={{mb: 3}}>
          Your payment is being processed. If your membership doesn&apos;t appear shortly, please
          refresh the page or contact support.
        </Alert>
      )}

      <Box sx={{mb: 5, display: 'flex', justifyContent: 'space-between', gap: 3, flexDirection: {xs: 'column', md: 'row'}}}>
        <Box>
          <Typography variant="overline" sx={{color: '#F20E02', fontWeight: 800, letterSpacing: '.1em'}}>
            MEMBER PORTAL
          </Typography>
          <Typography variant="h1" sx={{fontSize: {xs: 54, md: 86}, lineHeight: .9}}>
            Welcome back
          </Typography>
          <Typography color="text.secondary" sx={{mt: 2, fontSize: 18}}>
            {user.name || user.email}
          </Typography>
        </Box>
        {membership && (
          <Chip
            label={membership.status.replace('_', ' ')}
            color={membership.status === 'active' ? 'success' : 'warning'}
            sx={{alignSelf: {xs: 'flex-start', md: 'center'}, fontWeight: 800, borderRadius: 999, px: 1}}
          />
        )}
      </Box>

      {membership ? (
        <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', lg: '.9fr 1.1fr'}, gap: 3, alignItems: 'start'}}>
          <Box sx={{display: 'grid', gap: 3}}>
            <Paper className="dec-card" sx={{p: 3}}>
              <Typography variant="h4" component="h2" sx={{mb: 2}}>
                Account details
              </Typography>
              <Box sx={{display: 'grid', gap: 1.5}}>
                <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
                  <Typography color="text.secondary">Name</Typography>
                  <Typography fontWeight={700}>{user.name || 'Not set'}</Typography>
                </Box>
                <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
                  <Typography color="text.secondary">Email</Typography>
                  <Typography fontWeight={700}>{user.email}</Typography>
                </Box>
                <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
                  <Typography color="text.secondary">Plan</Typography>
                  <Typography fontWeight={700}>{membership.planName}</Typography>
                </Box>
                <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
                  <Typography color="text.secondary">Renews</Typography>
                  <Typography fontWeight={700}>{new Date(membership.endDate).toLocaleDateString()}</Typography>
                </Box>
              </Box>
              <Box sx={{mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5}}>
                {canManageSubscription && (
                  <PortalButton
                    returnUrl={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/member`}
                  />
                )}
                <Button variant="outlined" disabled>
                  Edit profile
                </Button>
              </Box>
            </Paper>

            <MembershipCard membership={membership} />

            <Paper className="dec-card" sx={{p: 3}}>
              <Typography variant="h4" component="h2" sx={{mb: 2}}>
                Quick actions
              </Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'}, gap: 1.5}}>
                <Button component={Link} href="https://www.meetup.com/down-east-cyclists/events/calendar/" target="_blank" variant="outlined">
                  Rides ↗
                </Button>
                <Button component={Link} href="/trails/b3" variant="outlined">
                  Trails
                </Button>
                <Button component={Link} href="/blog" variant="outlined">
                  News
                </Button>
                <Button component={Link} href="/contact" variant="outlined">
                  Help
                </Button>
              </Box>
            </Paper>
          </Box>

          <Paper className="dec-card" sx={{p: {xs: 2, md: 4}}}>
            <Typography variant="h4" component="h2" sx={{mb: 1}}>
              Digital membership card
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
              Show this QR code to verify your membership at events and partner locations.
            </Typography>
            {cardQuery.isLoading ? (
              <DigitalCard card={{} as MembershipCardSchema} loading />
            ) : cardQuery.data?.hasCard && cardQuery.data.card ? (
              <DigitalCard card={cardQuery.data.card} />
            ) : cardQuery.error ? (
              <Paper sx={{p: 3, textAlign: 'center'}}>
                <Typography color="error">{cardQuery.error.message}</Typography>
                <Button variant="text" onClick={() => cardQuery.refetch()} sx={{mt: 1}}>
                  Try Again
                </Button>
              </Paper>
            ) : (
              <Paper sx={{p: 3, textAlign: 'center'}}>
                <Typography color="text.secondary">
                  Your digital membership card is being generated. This usually takes a few moments
                  after checkout.
                </Typography>
                <Button variant="text" onClick={() => cardQuery.refetch()} sx={{mt: 1}}>
                  Check Again
                </Button>
              </Paper>
            )}
          </Paper>
        </Box>
      ) : (
        <Paper sx={{p: 3, textAlign: 'center'}}>
          <Typography variant="h6" gutterBottom>
            No Active Membership
          </Typography>
          <Typography color="text.secondary" sx={{mb: 2}}>
            You don&apos;t have an active membership yet.
          </Typography>
          <Button component={Link} href="/join" variant="contained" color="primary">
            View Membership Plans
          </Button>
        </Paper>
      )}
    </Container>
    </Box>
  );
}
