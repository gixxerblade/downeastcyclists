'use client';

import {Box, Button, TextField, Typography, Alert, Divider} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, useEffect} from 'react';

import {getCurrentAccessRole, loginWithPassword, sendMagicLink} from '@/src/lib/effect/client-auth';
import type {AuthError} from '@/src/lib/effect/errors';
import {auth} from '@/src/utils/firebase';

interface LoginCredentials {
  email: string;
  password: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Check if user is already logged in and redirect
  // Also check if this page was loaded via a magic link
  useEffect(() => {
    const checkAuth = async () => {
      // Check if URL has Firebase action parameters (mode, oobCode, apiKey)
      const urlParams = new URLSearchParams(window.location.search);
      const hasFirebaseActionParams =
        urlParams.has('mode') || urlParams.has('oobCode') || urlParams.has('apiKey');

      if (hasFirebaseActionParams) {
        // Firebase redirected us here with auth parameters
        // Forward to the verify page to handle the magic link
        router.push(`/verify${window.location.search}`);
        return;
      }

      // Also check if this is a magic link using Firebase's method
      const {isSignInWithEmailLink} = await import('firebase/auth');
      const isMagicLink = isSignInWithEmailLink(auth, window.location.href);

      if (isMagicLink) {
        // Redirect to verify page to handle the magic link
        router.push(`/verify${window.location.search}`);
        return;
      }

      const hasSession = document.cookie.includes('session=');
      if (hasSession) {
        // Check session validity via server
        try {
          const response = await fetch('/api/auth/session', {method: 'GET'});
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
              const role = await Effect.runPromise(getCurrentAccessRole());
              window.location.href = role === 'member' ? '/member' : '/dashboard';
            }
          }
        } catch {
          // Silently fail - user can login normally
        }
      }
    };

    checkAuth();
  }, [router]);

  // Email/Password Login Mutation - using Effect
  const loginMutation = useMutation<unknown, AuthError, LoginCredentials>({
    mutationFn: (credentials) => Effect.runPromise(loginWithPassword(credentials)),
    onSuccess: async () => {
      const role = await Effect.runPromise(getCurrentAccessRole());
      window.location.href = role === 'member' ? '/member' : '/dashboard';
    },
  });

  // Magic Link Mutation - using Effect
  const magicLinkMutation = useMutation<void, AuthError, string>({
    mutationFn: (email) =>
      Effect.runPromise(sendMagicLink(email, `${window.location.origin}/auth-handler`)),
    onSuccess: () => {
      setMagicLinkSent(true);
    },
  });

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({email, password});
  };

  const handleMagicLink = () => {
    if (!email) {
      loginMutation.reset();
      magicLinkMutation.reset();
      return;
    }
    magicLinkMutation.mutate(email);
  };

  const isLoading = loginMutation.isPending || magicLinkMutation.isPending;
  const error = loginMutation.error || magicLinkMutation.error;

  if (magicLinkSent) {
    return (
      <Box textAlign="center">
        <Typography variant="h6" gutterBottom>
          Check your email
        </Typography>
        <Typography color="text.secondary">We sent a sign-in link to {email}</Typography>
      </Box>
    );
  }

  // Helper to extract error message from AuthError
  const getErrorMessage = (error: AuthError | null): string | null => {
    if (!error) return null;
    return error.message;
  };

  return (
    <Box component="form" onSubmit={handleEmailPasswordLogin}>
      {error && (
        <Alert severity="error" sx={{mb: 2}}>
          {getErrorMessage(error)}
        </Alert>
      )}

      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
      />

      <Button type="submit" fullWidth variant="contained" disabled={isLoading} sx={{mt: 2}}>
        {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
      </Button>

      <Divider sx={{my: 3}}>or</Divider>

      <Button fullWidth variant="outlined" onClick={handleMagicLink} disabled={isLoading || !email}>
        {magicLinkMutation.isPending ? 'Sending...' : 'Send Magic Link'}
      </Button>

      <Box sx={{mt: 2, textAlign: 'center'}}>
        <Typography variant="body2" color="text.secondary">
          Don&apos;t have an account?{' '}
          <Link href="/join" style={{color: '#F20E02', textDecoration: 'none'}}>
            Join Now
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
