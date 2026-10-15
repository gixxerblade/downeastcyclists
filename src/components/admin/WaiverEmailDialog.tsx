'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Schema as S} from 'effect';
import {useState} from 'react';

import {WAIVER_EMAIL_BATCH_SIZE} from '@/src/lib/waivers/email-content';
import {WaiverEmailPreview, type WaiverEmailRequest} from '@/src/lib/waivers/email-schemas';

export interface WaiverEmailRecipient {
  userId: string;
  email: string;
  name: string | null;
  lastEmailId: string | null;
}

export interface WaiverEmailDialogState {
  templateId: string;
  action: 'invite' | 'remind' | 'preview';
  recipients: WaiverEmailRecipient[];
}

const SendResult = S.Struct({sent: S.Number, skipped: S.Number, failed: S.Number});

async function requestEmail(url: string, init?: RequestInit) {
  const response = await fetch(url, {...init, cache: 'no-store'});
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Email request failed',
    );
  }
  return body;
}

async function sendEmail(input: WaiverEmailRequest) {
  return S.decodeUnknownSync(SendResult)(
    await requestEmail('/api/admin/waivers/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
    }),
  );
}

export function WaiverEmailDialog({
  state,
  adminUid,
  onClose,
  onRefresh,
}: {
  state: WaiverEmailDialogState;
  adminUid: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [progress, setProgress] = useState({sent: 0, skipped: 0, failed: 0});
  const [testRequestId, setTestRequestId] = useState(() => crypto.randomUUID());
  const preview = useQuery({
    queryKey: ['admin', 'waiver-email-preview', adminUid, state.templateId, state.action],
    queryFn: async ({signal}) =>
      S.decodeUnknownSync(WaiverEmailPreview)(
        await requestEmail(
          `/api/admin/waivers/notifications?templateId=${encodeURIComponent(state.templateId)}&reminder=${state.action === 'remind'}`,
          {signal},
        ),
      ),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const send = useMutation({
    mutationFn: async () => {
      let total = {sent: 0, skipped: 0, failed: 0};
      setProgress(total);
      for (let index = 0; index < state.recipients.length; index += WAIVER_EMAIL_BATCH_SIZE) {
        const batch = state.recipients.slice(index, index + WAIVER_EMAIL_BATCH_SIZE);
        const result = await sendEmail(
          state.action === 'remind'
            ? {
                action: 'remind',
                templateId: state.templateId,
                confirmed: true,
                recipients: batch.map((member) => {
                  if (!member.lastEmailId)
                    throw new Error('Refresh the member list before sending reminders.');
                  return {userId: member.userId, previousEmailId: member.lastEmailId};
                }),
              }
            : {
                action: 'invite',
                templateId: state.templateId,
                userIds: batch.map((member) => member.userId),
              },
        );
        total = {
          sent: total.sent + result.sent,
          skipped: total.skipped + result.skipped,
          failed: total.failed + result.failed,
        };
        setProgress(total);
      }
      return total;
    },
    onSettled: onRefresh,
    retry: false,
  });
  const test = useMutation({
    mutationFn: () =>
      sendEmail({
        action: 'test',
        templateId: state.templateId,
        requestId: testRequestId,
        reminder: state.action === 'remind',
      }),
    onSuccess: () => setTestRequestId(crypto.randomUUID()),
    retry: false,
  });
  const busy = send.isPending || test.isPending;
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="md"
      aria-labelledby="waiver-email-dialog-title"
    >
      <DialogTitle id="waiver-email-dialog-title">
        {state.action === 'remind'
          ? 'Confirm waiver reminder'
          : state.action === 'invite'
            ? 'Confirm waiver invitations'
            : 'Preview waiver email'}
      </DialogTitle>
      <DialogContent sx={{display: 'grid', gap: 2}}>
        {state.action !== 'preview' ? (
          <>
            <Alert severity={state.action === 'remind' ? 'warning' : 'info'}>
              {state.action === 'remind'
                ? 'These members have already received an invitation. Confirm to send another email.'
                : 'Only these selected members will be contacted. Previously invited or newly signed members will be skipped.'}
            </Alert>
            <Typography>
              {state.recipients.length} recipient{state.recipients.length === 1 ? '' : 's'}
            </Typography>
            <Box component="ul" sx={{m: 0, pl: 3, maxHeight: 150, overflow: 'auto'}}>
              {state.recipients.map((member) => (
                <li key={member.userId}>
                  {member.name ? `${member.name} — ` : ''}
                  {member.email}
                </li>
              ))}
            </Box>
          </>
        ) : null}
        {preview.isPending ? <Typography>Loading the published Resend template…</Typography> : null}
        {preview.error ? (
          <Alert severity="warning">
            {preview.error.message} You can still send a test to verify the published email.
          </Alert>
        ) : null}
        {preview.data ? (
          <>
            <Typography variant="body2">
              From: {preview.data.from}
              <br />
              Subject: {preview.data.subject}
            </Typography>
            <Box
              component="iframe"
              title="Waiver email preview"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview.data.html}
              sx={{
                width: '100%',
                height: 580,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Typography variant="caption">
              Sample greeting shown. Each member receives their own name and the selected waiver
              link.
            </Typography>
          </>
        ) : null}
        <Typography variant="body2">
          Send test to me uses the signed-in administrative account
          {preview.data ? ` (${preview.data.testRecipient})` : ''}. It does not contact members or
          affect invitation history. The admin account still cannot sign a personal waiver.
        </Typography>
        {test.isSuccess ? (
          <Alert severity="success">
            Test email accepted by Resend. Check the administrative inbox.
          </Alert>
        ) : null}
        {test.error ? <Alert severity="error">{test.error.message}</Alert> : null}
        {send.error ? (
          <Alert severity="error">
            {send.error.message} Some emails may already have been accepted. You can retry this
            selection safely; recorded successes will be skipped.
          </Alert>
        ) : null}
        {send.isPending || send.data || send.error ? (
          <Alert severity={progress.failed ? 'warning' : 'info'}>
            Accepted: {progress.sent}. Skipped: {progress.skipped}. Failed: {progress.failed}.
            {send.isPending
              ? ' Please keep this window open.'
              : ' Accepted means Resend received the request, not confirmed inbox delivery.'}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1}}>
        <Button disabled={busy} onClick={onClose}>
          Close
        </Button>
        <Button disabled={busy} onClick={() => test.mutate()}>
          Send test to me
        </Button>
        {state.action !== 'preview' ? (
          <Button
            variant="contained"
            disabled={busy || !state.recipients.length || (send.isSuccess && !send.data.failed)}
            onClick={() => send.mutate()}
          >
            {send.isPending
              ? 'Sending…'
              : state.action === 'remind'
                ? 'Confirm and resend reminder'
                : `Send ${state.recipients.length} invitation${state.recipients.length === 1 ? '' : 's'}`}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
