'use client';

import React, { Suspense } from 'react';
import { Container, Typography, Button, CircularProgress } from '@mui/material';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Client component that uses useSearchParams
function ThanksContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams?.get('error') === 'true';

  return (
    <div className="text-center">
      <Typography variant="h3" component="h1" gutterBottom align="center">
        {hasError ? "Oops!" : "Thank You!"}
      </Typography>
      
      {hasError ? (
        <Typography variant="body1" paragraph color="error">
          There was an error submitting your form. You can try again if you&apos;d like.
        </Typography>
      ) : (
        <Typography variant="body1" paragraph>
          Your message has been received. We&apos;ll get back to you as soon as possible.
        </Typography>
      )}
      
      <div className="mt-8 flex justify-center space-x-4">
        {hasError && (
          <Link href="/contact" passHref>
            <Button variant="contained" color="secondary">
              Try Again
            </Button>
          </Link>
        )}
        
        <Link href="/" passHref>
          <Button variant="contained" color="primary">
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Page component with Suspense boundary
export default function Thanks() {
  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <Suspense fallback={
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <CircularProgress />
        </div>
      }>
        <ThanksContent />
      </Suspense>
    </Container>
  );
}
