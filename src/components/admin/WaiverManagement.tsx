'use client';

import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

import type {StaffRole} from '@/src/lib/access-control';
import {
  DEFAULT_WAIVER_ACKNOWLEDGMENT,
  DEFAULT_WAIVER_CONTENT,
  DEFAULT_WAIVER_TITLE,
} from '@/src/lib/waivers/default-waiver';

interface WaiverTemplateSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly scope: 'membership' | 'ride' | 'event';
  readonly status: 'draft' | 'published' | 'retired';
  readonly version: number;
  readonly isRequired: boolean;
  readonly signatureCount: number;
}

interface CompletionMember {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly signatureId: string | null;
  readonly signedAt: string | null;
  readonly isSigned: boolean;
  readonly signerName: string | null;
  readonly signerRole: 'adult' | 'guardian' | 'household' | null;
  readonly participants: Array<{name: string; birthDate: string}> | null;
}

interface CompletionResponse {
  readonly templates: WaiverTemplateSummary[];
  readonly selectedTemplateId: string | null;
  readonly members: CompletionMember[];
  readonly signed: number;
  readonly pending: number;
}

async function jsonRequest(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Request failed';
    throw new Error(message);
  }
  return body;
}

function isCompletionResponse(value: unknown): value is CompletionResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'templates' in value &&
    Array.isArray(value.templates) &&
    'members' in value &&
    Array.isArray(value.members) &&
    'signed' in value &&
    typeof value.signed === 'number' &&
    'pending' in value &&
    typeof value.pending === 'number'
  );
}

function isNotificationResult(
  value: unknown,
): value is {sent: number; skipped: number; failed: number} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sent' in value &&
    typeof value.sent === 'number' &&
    'skipped' in value &&
    typeof value.skipped === 'number' &&
    'failed' in value &&
    typeof value.failed === 'number'
  );
}

export function WaiverManagement({role}: {readonly role: StaffRole}) {
  const queryClient = useQueryClient();
  const canManage = role === 'admin';
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState(DEFAULT_WAIVER_TITLE);
  const [description, setDescription] = useState(
    'Required for club membership, rides, and events.',
  );
  const [scope, setScope] = useState<'membership' | 'ride' | 'event'>('membership');
  const [content, setContent] = useState(DEFAULT_WAIVER_CONTENT);
  const [acknowledgment, setAcknowledgment] = useState(DEFAULT_WAIVER_ACKNOWLEDGMENT);
  const [isRequired, setIsRequired] = useState(true);

  const completionQuery = useQuery({
    queryKey: ['admin', 'waivers', selectedTemplateId],
    queryFn: async () => {
      const result = await jsonRequest(
        `/api/admin/waivers/completion${
          selectedTemplateId ? `?templateId=${encodeURIComponent(selectedTemplateId)}` : ''
        }`,
      );
      if (!isCompletionResponse(result)) throw new Error('Invalid waiver completion response');
      return result;
    },
  });
  const selectedId = selectedTemplateId || completionQuery.data?.selectedTemplateId || '';

  const refresh = async () => {
    await queryClient.invalidateQueries({queryKey: ['admin', 'waivers']});
  };

  const createMutation = useMutation({
    mutationFn: () =>
      jsonRequest('/api/admin/waivers/templates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title,
          description: description || undefined,
          scope,
          content,
          acknowledgment,
          isRequired,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      await refresh();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({templateId, action}: {templateId: string; action: 'publish' | 'retire'}) =>
      jsonRequest(`/api/admin/waivers/templates/${templateId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action}),
      }),
    onSuccess: refresh,
  });

  const notificationMutation = useMutation({
    mutationFn: () =>
      jsonRequest('/api/admin/waivers/notifications', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({templateId: selectedId}),
      }).then((result) => {
        if (!isNotificationResult(result)) throw new Error('Invalid email campaign response');
        return result;
      }),
    onSuccess: refresh,
  });

  const error =
    completionQuery.error?.message ||
    createMutation.error?.message ||
    statusMutation.error?.message ||
    notificationMutation.error?.message;

  return (
    <Box sx={{display: 'grid', gap: 3}}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: {xs: 'stretch', sm: 'center'},
          flexDirection: {xs: 'column', sm: 'row'},
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2">
            Liability waivers
          </Typography>
          <Typography color="text.secondary">
            Publish versioned forms, track signatures, and open signed records instantly.
          </Typography>
        </Box>
        {canManage ? (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            New waiver version
          </Button>
        ) : null}
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notificationMutation.data ? (
        <Alert severity={notificationMutation.data.failed ? 'warning' : 'success'}>
          Sent {notificationMutation.data.sent}; skipped {notificationMutation.data.skipped}; failed{' '}
          {notificationMutation.data.failed}.
        </Alert>
      ) : null}

      <Paper className="dec-card" sx={{p: 3}}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {xs: '1fr', md: 'minmax(260px, 1fr) auto'},
            gap: 2,
            alignItems: 'center',
          }}
        >
          <FormControl fullWidth>
            <InputLabel id="waiver-template-label">Waiver version</InputLabel>
            <Select
              labelId="waiver-template-label"
              label="Waiver version"
              value={selectedId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              {(completionQuery.data?.templates ?? []).map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.title} v{template.version} · {template.status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {canManage && selectedId ? (
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              disabled={notificationMutation.isPending}
              onClick={() => notificationMutation.mutate()}
            >
              Email unsigned members once
            </Button>
          ) : null}
        </Box>
        <Box sx={{display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap'}}>
          <Chip color="success" label={`${completionQuery.data?.signed ?? 0} signed`} />
          <Chip color="warning" label={`${completionQuery.data?.pending ?? 0} pending`} />
        </Box>
      </Paper>

      <TableContainer component={Paper} className="dec-card">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>People listed</TableCell>
              <TableCell>Signed</TableCell>
              <TableCell align="right">Record</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(completionQuery.data?.members ?? []).map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  <Typography fontWeight={700}>{member.name || member.email}</Typography>
                  {member.name ? (
                    <Typography variant="caption" color="text.secondary">
                      {member.email}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={member.isSigned ? 'success' : 'warning'}
                    label={member.isSigned ? 'Signed' : 'Pending'}
                  />
                </TableCell>
                <TableCell>
                  {member.participants?.length ? (
                    <>
                      <Typography variant="body2">
                        {member.participants.map((person) => person.name).join(', ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.participants.length} people · Signed by {member.signerName}
                      </Typography>
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {member.signedAt ? new Date(member.signedAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell align="right">
                  {member.signatureId ? (
                    <Button
                      component="a"
                      href={`/api/waivers/records/${member.signatureId}`}
                      target="_blank"
                      rel="noopener"
                      size="small"
                      startIcon={<DescriptionIcon />}
                    >
                      Open
                    </Button>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {canManage ? (
        <Paper className="dec-card" sx={{p: 3}}>
          <Typography variant="h5" sx={{mb: 2}}>
            Template lifecycle
          </Typography>
          <Box sx={{display: 'grid', gap: 1}}>
            {(completionQuery.data?.templates ?? []).map((template) => (
              <Box
                key={template.id}
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--dec-border)',
                  py: 1.5,
                }}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {template.title} v{template.version}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {template.scope} · {template.signatureCount} signatures
                  </Typography>
                </Box>
                {template.status === 'draft' ? (
                  <Button
                    size="small"
                    onClick={() =>
                      statusMutation.mutate({templateId: template.id, action: 'publish'})
                    }
                  >
                    Publish
                  </Button>
                ) : template.status === 'published' ? (
                  <Button
                    size="small"
                    color="warning"
                    onClick={() =>
                      statusMutation.mutate({templateId: template.id, action: 'retire'})
                    }
                  >
                    Retire
                  </Button>
                ) : (
                  <Chip size="small" label="Retired" />
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      ) : null}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create a draft waiver version</DialogTitle>
        <DialogContent sx={{display: 'grid', gap: 2, pt: '16px !important'}}>
          <TextField
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormControl>
            <InputLabel id="new-waiver-scope-label">Scope</InputLabel>
            <Select
              labelId="new-waiver-scope-label"
              label="Scope"
              value={scope}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'membership' || value === 'ride' || value === 'event')
                  setScope(value);
              }}
            >
              <MenuItem value="membership">Membership</MenuItem>
              <MenuItem value="ride">Ride</MenuItem>
              <MenuItem value="event">Event</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Waiver terms"
            required
            multiline
            minRows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <TextField
            label="Signature acknowledgment"
            required
            multiline
            minRows={3}
            value={acknowledgment}
            onChange={(e) => setAcknowledgment(e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isRequired}
                onChange={(event) => setIsRequired(event.target.checked)}
              />
            }
            label="Require this waiver before participation"
          />
          <Alert severity="info">
            Draft terms can be reviewed before publishing. Published versions cannot be edited, so
            existing signatures always remain tied to the exact text shown.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Save draft
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
