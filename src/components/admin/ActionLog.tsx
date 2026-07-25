'use client';

import {FilterAlt, NavigateBefore, NavigateNext} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {getActionLog} from '@/src/lib/effect/client-admin';
import type {ActionLogParams, AuditAction} from '@/src/types/admin';

const actions: Array<{value: AuditAction; label: string}> = [
  {value: 'MEMBER_CREATED', label: 'Member Created'},
  {value: 'MEMBER_UPDATED', label: 'Member Updated'},
  {value: 'MEMBER_DELETED', label: 'Member Deleted'},
  {value: 'RENEWAL_EMAIL_SENT', label: 'Renewal Email Sent'},
  {value: 'RENEWAL_EMAIL_RESENT', label: 'Renewal Email Resent'},
  {value: 'AUTOMATED_RENEWAL_EMAIL_SENT', label: 'Automated Renewal Email'},
  {value: 'ADMIN_ROLE_CHANGE', label: 'Role Change'},
  {value: 'REFUND_ISSUED', label: 'Refund Issued'},
  {value: 'BULK_IMPORT', label: 'Bulk Import'},
  {value: 'RECONCILIATION', label: 'Reconciliation'},
];

const actionColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  MEMBER_CREATED: 'success',
  MEMBER_UPDATED: 'info',
  MEMBER_DELETED: 'error',
  RENEWAL_EMAIL_SENT: 'info',
  RENEWAL_EMAIL_RESENT: 'warning',
  AUTOMATED_RENEWAL_EMAIL_SENT: 'success',
  ADMIN_ROLE_CHANGE: 'warning',
  REFUND_ISSUED: 'warning',
  BULK_IMPORT: 'success',
  RECONCILIATION: 'info',
};

function formatAction(action: string) {
  return action.replace(/_/g, ' ');
}

function describeAction(details: Record<string, unknown>) {
  const reminderDays = details.reminderDays;
  if (typeof reminderDays === 'number') {
    return `${reminderDays}-day renewal reminder`;
  }

  const deliveryType = details.deliveryType;
  if (deliveryType === 'resend') return 'Manual renewal email resend';
  if (deliveryType === 'send') return 'Manual renewal email';
  if (typeof details.reason === 'string') return details.reason;
  return '';
}

export function ActionLog() {
  const [filters, setFilters] = useState<ActionLogParams>({page: 1, pageSize: 50});

  const actionLogQuery = useQuery({
    queryKey: ['admin', 'action-log', filters],
    queryFn: () => Effect.runPromise(getActionLog(filters)),
  });

  const total = actionLogQuery.data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box sx={{display: 'grid', gap: 2}}>
      <Paper className="dec-card" sx={{p: 3}}>
        <Grid container spacing={2}>
          <Grid size={{xs: 12, md: 2.4}}>
            <TextField
              fullWidth
              size="small"
              label="Actor"
              value={filters.actor ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  actor: event.target.value || undefined,
                  page: 1,
                }))
              }
            />
          </Grid>
          <Grid size={{xs: 12, md: 2.4}}>
            <TextField
              fullWidth
              size="small"
              label="Target"
              value={filters.target ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  target: event.target.value || undefined,
                  page: 1,
                }))
              }
            />
          </Grid>
          <Grid size={{xs: 12, md: 2.4}}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action ?? ''}
                label="Action"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    action: (event.target.value as AuditAction) || undefined,
                    page: 1,
                  }))
                }
              >
                <MenuItem value="">All Actions</MenuItem>
                {actions.map((action) => (
                  <MenuItem key={action.value} value={action.value}>
                    {action.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{xs: 12, md: 2.4}}>
            <TextField
              fullWidth
              size="small"
              label="From"
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value || undefined,
                  page: 1,
                }))
              }
              slotProps={{inputLabel: {shrink: true}}}
            />
          </Grid>
          <Grid size={{xs: 12, md: 2.4}}>
            <TextField
              fullWidth
              size="small"
              label="To"
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value || undefined,
                  page: 1,
                }))
              }
              slotProps={{inputLabel: {shrink: true}}}
            />
          </Grid>
        </Grid>
        <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 2}}>
          <Button
            variant="outlined"
            startIcon={<FilterAlt />}
            onClick={() => setFilters({page: 1, pageSize})}
          >
            Clear
          </Button>
        </Box>
      </Paper>

      {actionLogQuery.error && (
        <Alert severity="error">
          {actionLogQuery.error.message || 'Failed to load action log'}
        </Alert>
      )}

      <Paper elevation={2}>
        <Box sx={{display: 'grid'}}>
          {actionLogQuery.isLoading && (
            <Typography color="text.secondary" align="center" sx={{py: 5}}>
              Loading actions...
            </Typography>
          )}

          {!actionLogQuery.isLoading && actionLogQuery.data?.entries.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{py: 5}}>
              No actions found
            </Typography>
          )}

          {actionLogQuery.data?.entries.map((entry) => {
            const actor = entry.performedBy === 'system' ? 'System' : entry.performedByEmail;
            const target = entry.targetName || entry.targetEmail || entry.targetUserId || '-';
            const description = describeAction(entry.details);

            return (
              <Box
                key={entry.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {xs: '1fr', lg: '220px 1fr 1fr 190px'},
                  gap: 2,
                  p: 2,
                  borderBottom: '1px solid var(--dec-border)',
                  alignItems: 'center',
                }}
              >
                <Chip
                  size="small"
                  label={formatAction(entry.action)}
                  color={actionColors[entry.action] || 'default'}
                  sx={{justifySelf: 'start'}}
                />
                <Box>
                  <Typography sx={{fontWeight: 800}}>{actor || entry.performedBy}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Actor
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{fontWeight: 800}}>{target}</Typography>
                  {description && (
                    <Typography variant="body2" color="text.secondary">
                      {description}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {new Date(entry.timestamp).toLocaleString()}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid var(--dec-border)',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Page {page} of {totalPages} · {total} actions
          </Typography>
          <Box sx={{display: 'flex', gap: 1}}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<NavigateBefore />}
              disabled={page <= 1}
              onClick={() => setFilters((current) => ({...current, page: page - 1}))}
            >
              Prev
            </Button>
            <Button
              size="small"
              variant="outlined"
              endIcon={<NavigateNext />}
              disabled={page >= totalPages}
              onClick={() => setFilters((current) => ({...current, page: page + 1}))}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
