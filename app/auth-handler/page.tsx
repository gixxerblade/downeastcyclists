'use client';

import {Container, Box, CircularProgress, Typography} from '@mui/material';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, Suspense} from 'react';

/**
 * Custom auth action handler page
 * This page receives Firebase auth action links and forwards them to the appropriate handler
 * with all query parameters preserved
 */
function AuthHandlerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get all query parameters
    const mode = searchParams?.get('mode');
    const oobCode = searchParams?.get('oobCode');

    // Check if this is a sign-in action
    if (mode === 'signIn' && oobCode) {
      // Forward to the verify page with all parameters
      router.push(`/verify${window.location.search}`);
    } else if (mode === 'resetPassword') {
      // Handle password reset if needed in the future
      router.push('/login');
    } else {
      // Unknown mode or missing parameters
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
        <Typography sx={{mt: 2}}>Processing authentication...</Typography>
      </Box>
    </Container>
  );
}

export default function AuthHandlerPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="xs">
          <Box
            sx={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <CircularProgress />
            <Typography sx={{mt: 2}}>Loading...</Typography>
          </Box>
        </Container>
      }
    >
      <AuthHandlerContent />
    </Suspense>
  );
}
