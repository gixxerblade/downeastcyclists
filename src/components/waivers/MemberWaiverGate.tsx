'use client';

import {Alert, Box, Button, CircularProgress, Container, Paper, Typography} from '@mui/material';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

import type {WaiverSignatureInput} from '@/src/lib/waivers/schemas';

import {
  makeWaiverSignatureDraft,
  parseWaiverDraft,
  WaiverSignatureFields,
  type WaiverSignatureDraft,
} from './WaiverSignatureFields';

interface MemberWaiver {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly content: string;
  readonly acknowledgment: string;
  readonly isRequired: boolean;
  readonly signatureId: string | null;
  readonly signedAt: string | null;
  readonly signerName: string | null;
  readonly signerRole: 'adult' | 'guardian' | 'household' | null;
  readonly participants: Array<{name: string; birthDate: string}> | null;
  readonly phone: string | null;
  readonly addressStreet: string | null;
  readonly addressCity: string | null;
  readonly addressState: string | null;
  readonly addressZip: string | null;
  readonly isSigned: boolean;
  readonly history: Array<{id: string; revision: number; signedAt: string}>;
}

interface MemberWaiverGateProps {
  readonly memberName: string;
  readonly requireHousehold?: boolean;
  readonly children: React.ReactNode;
}

async function loadWaivers(): Promise<MemberWaiver[]> {
  const response = await fetch('/api/member/waivers', {cache: 'no-store'});
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== 'object' ||
    body === null ||
    !('waivers' in body) ||
    !Array.isArray(body.waivers)
  ) {
    throw new Error('Unable to load your waiver status');
  }
  return body.waivers;
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

export function MemberWaiverGate({
  memberName,
  requireHousehold = false,
  children,
}: MemberWaiverGateProps) {
  const queryClient = useQueryClient();
  const waiversQuery = useQuery({queryKey: ['member', 'waivers'], queryFn: loadWaivers});
  const pending = waiversQuery.data?.find(
    (waiver) =>
      waiver.isRequired &&
      (!waiver.isSigned || (requireHousehold && waiver.signerRole !== 'household')),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, WaiverSignatureDraft>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const editing = pending ?? waiversQuery.data?.find((waiver) => waiver.id === editingId);
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
      await queryClient.invalidateQueries({queryKey: ['member', 'waivers']});
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

  if (editing)
    return (
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
    );

  const signed = waiversQuery.data?.filter((waiver) => waiver.isSigned) ?? [];
  return (
    <>
      {signed.length ? (
        <Container maxWidth="lg" sx={{py: 2}}>
          {signed.map((waiver) => (
            <Paper key={waiver.id} sx={{p: 2, mb: 1}}>
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
                <Button
                  onClick={() => {
                    setEditingId(waiver.id);
                    signMutation.reset();
                  }}
                >
                  Update family details
                </Button>
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
      {children}
    </>
  );
}
