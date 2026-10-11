'use client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {eq, not, useLiveQuery} from '@tanstack/react-db';
import Link from 'next/link';
import {useEffect, useState} from 'react';

import {
  getTrailOutbox,
  processTrailOutbox,
  retryTrailReport,
} from '@/src/lib/trail-maintenance/outbox';

import {TrailReportBotCheck} from './TrailReportBotCheck';

type Outbox = Awaited<ReturnType<typeof getTrailOutbox>>;
export function PendingTrailReport({id}: {id: string}) {
  const [outbox, setOutbox] = useState<Outbox>();
  const [error, setError] = useState('');
  useEffect(() => {
    void getTrailOutbox()
      .then(setOutbox)
      .catch(() =>
        setError(
          'Could not open saved reports on this phone. Check that browser storage is enabled and try again.',
        ),
      );
  }, []);
  return (
    <Container maxWidth="md" sx={{py: 4}}>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : outbox ? (
        <ReportStatus id={id} outbox={outbox} />
      ) : (
        <Typography>Opening saved report…</Typography>
      )}
    </Container>
  );
}
function ReportStatus({id, outbox}: {id: string; outbox: Outbox}) {
  const {data} = useLiveQuery((q) => q.from({report: outbox.reports}));
  const report = data.find((row) => row.id === id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void processTrailOutbox().catch(() =>
      setError('Could not start sending. Your saved report is still on this phone.'),
    );
  }, []);
  const retry = async (token?: string) => {
    setBusy(true);
    setError('');
    try {
      await retryTrailReport(id, token);
    } catch {
      setError('Could not retry. Your saved report is still on this phone.');
    } finally {
      setBusy(false);
    }
  };
  if (!report)
    return (
      <Alert severity="warning">
        This report is not saved in this browser. It may be on another phone or browser, or its
        local data was removed. <Link href="/report-trail-issue">Write a report</Link>
      </Alert>
    );
  const submitted = report.status === 'submitted';
  return (
    <Paper sx={{p: {xs: 2, md: 4}}}>
      <Typography variant="h1" sx={{fontSize: 30, mb: 2}}>
        {submitted
          ? 'Report submitted'
          : report.status === 'submitting'
            ? 'Submitting your report'
            : 'Report saved on this phone'}
      </Typography>
      <Alert
        role="status"
        severity={submitted ? 'success' : report.status === 'failed' ? 'error' : 'info'}
      >
        {report.message}
      </Alert>
      {error && (
        <Alert severity="error" sx={{mt: 2}}>
          {error}
        </Alert>
      )}
      {!submitted && (
        <Typography sx={{my: 2}}>
          DEC has not confirmed receipt yet. We retry automatically while the website is running. If
          you lock your phone or close the site, reopen DEC when coverage improves to finish
          sending. Keep this browser’s site data until submission is confirmed.
        </Typography>
      )}
      <Typography sx={{my: 2}}>
        {report.filenames.length} image(s) {submitted ? 'attached' : 'saved with this report'}.
      </Typography>
      {submitted && report.publicId ? (
        <Button
          component={Link}
          href={`/report-trail-issue/${report.publicId}`}
          variant="contained"
        >
          View report
        </Button>
      ) : report.status === 'needs-check' ? (
        <>
          <TrailReportBotCheck
            onToken={(token) => {
              if (token) void retry(token);
            }}
          />
          {!process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY && (
            <Alert severity="warning">
              Bot verification is unavailable. Please try again later.
            </Alert>
          )}
        </>
      ) : (
        <Button
          disabled={busy || report.status === 'submitting'}
          onClick={() => {
            void retry();
          }}
          variant="contained"
        >
          Retry now
        </Button>
      )}
      <Box sx={{mt: 3}}>
        <Link href="/report-trail-issue">Report another issue</Link>
      </Box>
    </Paper>
  );
}
export function SavedTrailReports() {
  const [outbox, setOutbox] = useState<Outbox>();
  useEffect(() => {
    void getTrailOutbox()
      .then(setOutbox)
      .catch(() => {});
  }, []);
  return outbox ? <SavedReportLinks outbox={outbox} /> : null;
}
function SavedReportLinks({outbox}: {outbox: Outbox}) {
  const {data} = useLiveQuery((q) =>
    q.from({report: outbox.reports}).orderBy(({report}) => report.createdAt, 'desc'),
  );
  if (!data.length) return null;
  return (
    <Box sx={{mb: 3}}>
      <Typography variant="h3" sx={{fontSize: 20, mb: 1}}>
        Reports saved on this phone
      </Typography>
      {data.map((report) => (
        <Box key={report.id} sx={{mb: 1}}>
          <Link href={`/report-trail-issue/pending/${report.id}`}>
            {new Date(report.createdAt).toLocaleString()}:{' '}
            {report.status === 'submitted' ? 'Submitted' : 'Not yet received by DEC'}
          </Link>
        </Box>
      ))}
    </Box>
  );
}

export function PendingTrailReportsNotice() {
  const [outbox, setOutbox] = useState<Outbox>();
  useEffect(() => {
    void getTrailOutbox()
      .then(setOutbox)
      .catch(() => {});
  }, []);
  return outbox ? <PendingNotice outbox={outbox} /> : null;
}
function PendingNotice({outbox}: {outbox: Outbox}) {
  const {data} = useLiveQuery((q) =>
    q.from({report: outbox.reports}).where(({report}) => not(eq(report.status, 'submitted'))),
  );
  const first = data[0];
  return first ? (
    <Alert severity="info">
      {data.length} trail report(s) saved on this phone; DEC has not confirmed receipt.{' '}
      <Link href={`/report-trail-issue/pending/${first.id}`}>Check submission</Link>
    </Alert>
  ) : null;
}
