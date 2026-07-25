'use client';

import {Typography, Button, CircularProgress} from '@mui/material';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import React, {Suspense} from 'react';

// Client component that uses useSearchParams
function ThanksContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams?.get('error') === 'true';

  return (
    <div className="dec-card mx-auto max-w-2xl p-8 text-center md:p-10">
      <Typography variant="h1" sx={{fontSize: {xs: 56, md: 82}, mb: 2}}>
        {hasError ? 'Oops!' : 'Thank You!'}
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

      <div className="mt-8 flex flex-wrap justify-center gap-3">
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
    <main className="dec-page">
      <section className="dec-container py-16 md:py-20">
        <Suspense
          fallback={
            <div className="flex justify-center items-center" style={{minHeight: '200px'}}>
              <CircularProgress />
            </div>
          }
        >
          <ThanksContent />
        </Suspense>
      </section>
    </main>
  );
}
