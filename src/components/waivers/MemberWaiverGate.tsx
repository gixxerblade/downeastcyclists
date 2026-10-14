'use client';

import {Alert, Box, Button, CircularProgress, Container, Paper, Typography} from '@mui/material';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

import {useAuth} from '@/src/components/auth/AuthProvider';
import {
  memberWaiversQueryKey,
  memberWaiversQueryOptions,
  type MemberWaiver,
} from '@/src/lib/waivers/client';
import {isWaiverComplete} from '@/src/lib/waivers/policy';
import type {WaiverSignatureInput} from '@/src/lib/waivers/schemas';

import {
  makeWaiverSignatureDraft,
  parseWaiverDraft,
  WaiverSignatureFields,
  type WaiverSignatureDraft,
} from './WaiverSignatureFields';

interface MemberWaiverGateProps {
  readonly memberName?: string;
  readonly requireHousehold?: boolean;
  readonly requestedTemplateId?: string;
  readonly children: React.ReactNode;
}

function draftForWaiver(
  waiver: MemberWaiver,
  memberName: string,
  requireHousehold: boolean,
): WaiverSignatureDraft {
  const household = requireHousehold || waiver.signerRole === 'household';
  return {
    ...makeWaiverSignatureDraft(waiver.signerName ?? memberName, household),
    previousSignatureId: waiver.signatureId ?? undefined,
    signerBirthDate: waiver.participants?.[0]?.birthDate ?? '',
    familyMembers: household ? (waiver.participants?.slice(1) ?? []) : [],
    phone: waiver.phone ?? '',
    addressStreet: waiver.addressStreet ?? '',
    addressCity: waiver.addressCity ?? '',
    addressState: waiver.addressState ?? 'NC',
    addressZip: waiver.addressZip ?? '',
  };
}

export function MemberWaiverGate(props: MemberWaiverGateProps) {
  const {user, loading} = useAuth();
  if (loading)
    return (
      <Container sx={{py: 6}}>
        <CircularProgress aria-label="Verifying your account" />
      </Container>
    );
  if (!user)
    return (
      <Container sx={{py: 6}}>
        <Button component="a" href="/login?returnTo=%2Fwaivers">
          Sign in to complete your waiver
        </Button>
      </Container>
    );
  return (
    <AccountWaiverGate
      key={user.uid}
      {...props}
      userId={user.uid}
      memberName={props.memberName || user.displayName || ''}
    />
  );
}

function AccountWaiverGate({
  memberName = '',
  userId,
  requireHousehold: requestedHousehold = false,
  requestedTemplateId,
  children,
}: MemberWaiverGateProps & {userId: string}) {
  const queryClient = useQueryClient();
  const waiversQuery = useQuery(memberWaiversQueryOptions(userId));
  const requireHousehold = requestedHousehold || waiversQuery.data?.requireHousehold === true;
  const waivers = waiversQuery.data?.waivers;
  const pending =
    waivers?.find(
      (waiver) =>
        waiver.isActive && waiver.isRequired && !isWaiverComplete(waiver, requireHousehold),
    ) ??
    waivers?.find(
      (waiver) =>
        waiver.isActive &&
        waiver.id === requestedTemplateId &&
        !isWaiverComplete(waiver, requireHousehold),
    );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, WaiverSignatureDraft>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const editing = pending ?? waivers?.find((waiver) => waiver.isActive && waiver.id === editingId);
  const draft = editing
    ? (drafts[editing.id] ?? draftForWaiver(editing, memberName, requireHousehold))
    : makeWaiverSignatureDraft(memberName, requireHousehold);

  const signMutation = useMutation({
    mutationFn: async ({
      templateId,
      signature,
    }: {
      templateId: string;
      signature: WaiverSignatureInput;
    }) => {
      const response = await fetch(`/api/member/waivers/${templateId}/sign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(signature),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'Unable to save your signature';
        throw new Error(message);
      }
      return body;
    },
    onSuccess: async (_result, variables) => {
      setDrafts((current) => {
        const remaining = {...current};
        delete remaining[variables.templateId];
        return remaining;
      });
      setEditingId(null);
      setValidationError(null);
      await queryClient.invalidateQueries({queryKey: memberWaiversQueryKey(userId)});
    },
  });

  if (waiversQuery.isLoading)
    return (
      <Container maxWidth="md" sx={{py: 8, display: 'grid', placeItems: 'center'}}>
        <CircularProgress aria-label="Loading waiver status" />
      </Container>
    );
  if (waiversQuery.error)
    return (
      <Container maxWidth="md" sx={{py: 6}}>
        <Alert severity="error">
          We could not verify your waiver status. Refresh the page to try again.
        </Alert>
        <Button onClick={() => waiversQuery.refetch()}>Try again</Button>
      </Container>
    );

  const editor = editing ? (
    <Box className="dec-page" sx={{minHeight: '100vh'}}>
      <Container maxWidth="md" sx={{py: {xs: 4, md: 7}}}>
        <Alert severity={editing.isSigned ? 'info' : 'warning'} sx={{mb: 3}}>
          {editing.isSigned
            ? 'Review the names and birth dates, then sign to save a new copy. Your earlier signed copy will remain available.'
            : 'Complete your waiver before participating in club rides or events.'}
        </Alert>
        <Paper
          className="dec-card"
          component="form"
          sx={{p: {xs: 2.5, md: 4}}}
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseWaiverDraft(draft);
            if (parsed.error !== undefined) {
              setValidationError(parsed.error);
              return;
            }
            setValidationError(null);
            signMutation.mutate({templateId: editing.id, signature: parsed.input});
          }}
        >
          <WaiverSignatureFields
            title={editing.title}
            version={editing.version}
            content={editing.content}
            acknowledgment={editing.acknowledgment}
            value={draft}
            onChange={(next) => {
              setDrafts((current) => ({...current, [editing.id]: next}));
              setValidationError(null);
            }}
            requireHousehold={requireHousehold}
            disabled={signMutation.isPending}
            error={validationError ?? signMutation.error?.message}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={signMutation.isPending || !draft.consent}
            sx={{mt: 3}}
          >
            {signMutation.isPending
              ? 'Saving signature…'
              : draft.signerRole === 'household'
                ? 'Sign for my household'
                : 'Sign waiver'}
          </Button>
          {!pending ? (
            <Button
              type="button"
              disabled={signMutation.isPending}
              onClick={() => {
                setEditingId(null);
                setValidationError(null);
                signMutation.reset();
              }}
              sx={{mt: 1}}
            >
              Cancel
            </Button>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
            You can print or save a copy after signing.
          </Typography>
        </Paper>
      </Container>
    </Box>
  ) : null;

  const signed = waivers?.filter((waiver) => waiver.isSigned) ?? [];
  return (
    <>
      {!editing &&
        waivers
          ?.filter((waiver) => waiver.isActive && !waiver.isRequired && !waiver.isSigned)
          .map((waiver) => (
            <Container key={waiver.id} sx={{py: 2}}>
              <Button onClick={() => setEditingId(waiver.id)}>Sign {waiver.title}</Button>
            </Container>
          ))}
      {signed.length ? (
        <Container maxWidth="lg" sx={{py: 2}}>
          {signed.map((waiver) => (
            <Paper key={waiver.id} sx={{p: 2, mb: 1}}>
              <Typography>
                {waiver.title} · Version {waiver.version}
                {waiver.isActive ? '' : ' · Archived signed record'}
              </Typography>
              <Typography fontWeight={700}>
                {waiver.signerRole === 'household'
                  ? `Family waiver complete · ${waiver.participants?.length ?? 0} people listed`
                  : 'Liability waiver complete'}
              </Typography>
              {waiver.signerRole === 'household' ? (
                <Typography variant="body2">
                  {waiver.participants?.map((person) => person.name).join(', ')}
                </Typography>
              ) : null}
              <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1}}>
                <Button
                  component="a"
                  href={`/api/waivers/records/${waiver.signatureId}`}
                  target="_blank"
                  rel="noopener"
                >
                  Print or save signed waiver
                </Button>
                {waiver.isActive && !editing ? (
                  <Button
                    onClick={() => {
                      setEditingId(waiver.id);
                      signMutation.reset();
                    }}
                  >
                    Update family details
                  </Button>
                ) : null}
              </Box>
              {waiver.history.length > 1 ? (
                <Box component="details" sx={{mt: 1}}>
                  <summary>Earlier signed copies</summary>
                  {waiver.history
                    .filter((record) => record.id !== waiver.signatureId)
                    .map((record) => (
                      <Button
                        key={record.id}
                        component="a"
                        href={`/api/waivers/records/${record.id}`}
                        target="_blank"
                        rel="noopener"
                      >
                        Copy {record.revision} · {new Date(record.signedAt).toLocaleDateString()}
                      </Button>
                    ))}
                </Box>
              ) : null}
            </Paper>
          ))}
        </Container>
      ) : null}
      {editor}
      {!editing ? children : null}
    </>
  );
}
