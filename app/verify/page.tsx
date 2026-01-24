'use client';

import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Button,
} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import {isValidSignInLink, completeMagicLinkSignIn} from '@/src/lib/effect/client-auth';
import type {AuthError} from '@/src/lib/effect/errors';

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);

  // Mutation for completing sign-in
  const verifyMutation = useMutation<unknown, AuthError, string>({
    mutationFn: (email) => Effect.runPromise(completeMagicLinkSignIn(email, window.location.href)),
    onSuccess: (_, email) => {
      // Check if user is admin - normalize email comparison
      const adminEmail = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL || 'info@downeastcyclists.com')
        .toLowerCase()
        .trim();
      const userEmail = email.toLowerCase().trim();
      const isAdmin = userEmail === adminEmail;

      // Use window.location for a hard redirect to ensure it works
      const redirectUrl = isAdmin ? '/dashboard' : '/member';
      window.location.href = redirectUrl;
    },
    onError: () => {
      // Clear the invalid link state and show error
      setIsValidLink(false);
    },
  });

  useEffect(() => {
    const checkLink = async () => {
      // Verify the sign-in link
      const isValid = await Effect.runPromise(isValidSignInLink(window.location.href));

      if (!isValid) {
        setIsValidLink(false);
        return;
      }

      setIsValidLink(true);

      // Get the email from localStorage
      const storedEmail = window.localStorage.getItem('emailForSignIn');

      if (!storedEmail) {
        // Email not found, ask user to provide it
        setNeedsEmail(true);
        return;
      }

      // Auto-verify if we have the email
      verifyMutation.mutate(storedEmail);
    };

    checkLink();
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      verifyMutation.mutate(email);
    }
  };

  // Loading state: checking link validity or verifying
  if (isValidLink === null || verifyMutation.isPending) {
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
          <Typography sx={{mt: 2}}>Verifying sign-in link...</Typography>
        </Box>
      </Container>
    );
  }

  // Invalid link or sign-in error
  if (isValidLink === false) {
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
          <Alert severity="error" sx={{width: '100%', mb: 2}}>
            {verifyMutation.error
              ? `Sign-in failed: ${verifyMutation.error.message}`
              : 'Invalid or expired sign-in link'}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2, textAlign: 'center'}}>
            The link may have expired or already been used. Please request a new sign-in link.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/login')} fullWidth>
            Back to login
          </Button>
        </Box>
      </Container>
    );
  }

  // Need email input
  if (needsEmail) {
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
          <Typography component="h1" variant="h5" gutterBottom>
            Confirm your email
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{mb: 2}}>
            Please enter the email address you used to request the sign-in link.
          </Typography>

          {verifyMutation.error && (
            <Alert severity="error" sx={{width: '100%', mb: 2}}>
              {verifyMutation.error.message}
            </Alert>
          )}

          <Box component="form" onSubmit={handleEmailSubmit} sx={{width: '100%'}}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              disabled={verifyMutation.isPending}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{mt: 2}}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Continue'}
            </Button>
          </Box>
        </Box>
      </Container>
    );
  }

  return null;
}
