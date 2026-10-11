'use client';
import Alert from '@mui/material/Alert';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useEffect, useState} from 'react';

const PendingNotice = dynamic(
  () => import('./PendingTrailReport').then((module) => module.PendingTrailReportsNotice),
  {ssr: false},
);

export function TrailOutboxRunner() {
  const [error, setError] = useState(false);
  useEffect(() => {
    const run = () => {
      void import('@/src/lib/trail-maintenance/outbox')
        .then(({processTrailOutbox}) => processTrailOutbox())
        .then(() => setError(false))
        .catch(() => setError(true));
    };
    run();
    const timer = window.setInterval(run, 15_000);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    const visible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return error ? (
    <Alert severity="warning">
      Saved report storage could not be opened.{' '}
      <Link href="/report-trail-issue">Check your trail reports</Link> before leaving.
    </Alert>
  ) : (
    <PendingNotice />
  );
}
