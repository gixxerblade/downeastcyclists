'use client';

import {ExpandMore, ExpandLess} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Chip,
  Paper,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {getMemberAuditLog} from '@/src/lib/effect/client-admin';
import type {AuditEntry} from '@/src/types/admin';

interface MemberAuditLogProps {
  open: boolean;
  userId: string | null;
  memberName?: string;
  onClose: () => void;
}

const actionColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  MEMBER_CREATED: 'success',
  MEMBER_UPDATED: 'info',
  MEMBER_DELETED: 'error',
  MEMBERSHIP_EXTENDED: 'success',
  MEMBERSHIP_PAUSED: 'warning',
  EMAIL_CHANGED: 'info',
  STRIPE_SYNCED: 'info',
  REFUND_ISSUED: 'warning',
  BULK_IMPORT: 'success',
  ADMIN_ROLE_CHANGE: 'warning',
  MEMBERSHIP_ADJUSTMENT: 'info',
  RECONCILIATION: 'info',
};

function AuditEntryItem({entry}: {entry: AuditEntry}) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails =
    entry.details &&
    (entry.details.previousValues || entry.details.newValues || entry.details.reason);

  return (
    <Paper sx={{p: 2, mb: 1}} elevation={1}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <Box>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
            <Chip
              size="small"
              label={entry.action.replace(/_/g, ' ')}
              color={actionColors[entry.action] || 'default'}
            />
            <Typography variant="caption" color="text.secondary">
              {new Date(entry.timestamp).toLocaleString()}
            </Typography>
          </Box>
          <Typography variant="body2">By: {entry.performedByEmail || entry.performedBy}</Typography>
          {entry.details?.reason && (
            <Typography variant="body2" color="text.secondary">
              Reason: {entry.details.reason as string}
            </Typography>
          )}
        </Box>
        {hasDetails && (
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        )}
      </Box>

      {hasDetails && (
        <Collapse in={expanded}>
          <Box sx={{mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1}}>
            {entry.details?.previousValues && (
              <Box sx={{mb: 1}}>
                <Typography variant="caption" fontWeight="bold">
                  Previous Values:
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{fontSize: '0.75rem', whiteSpace: 'pre-wrap'}}
                >
                  {JSON.stringify(entry.details.previousValues, null, 2)}
                </Typography>
              </Box>
            )}
            {entry.details?.newValues && (
              <Box>
                <Typography variant="caption" fontWeight="bold">
                  New Values:
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{fontSize: '0.75rem', whiteSpace: 'pre-wrap'}}
                >
                  {JSON.stringify(entry.details.newValues, null, 2)}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}

export function MemberAuditLog({open, userId, memberName, onClose}: MemberAuditLogProps) {
  const auditQuery = useQuery({
    queryKey: ['admin', 'audit', userId],
    queryFn: () => (userId ? Effect.runPromise(getMemberAuditLog(userId)) : Promise.resolve([])),
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Audit Log
        {memberName && (
          <Typography variant="subtitle2" color="text.secondary">
            {memberName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{pt: 1}}>
          {auditQuery.isLoading && (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
              <CircularProgress />
            </Box>
          )}

          {auditQuery.error && (
            <Alert severity="error">{auditQuery.error.message || 'Failed to load audit log'}</Alert>
          )}

          {auditQuery.data && auditQuery.data.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{py: 4}}>
              No audit entries found
            </Typography>
          )}

          {auditQuery.data && auditQuery.data.length > 0 && (
            <Box sx={{maxHeight: 500, overflow: 'auto'}}>
              {auditQuery.data.map((entry) => (
                <AuditEntryItem key={entry.id} entry={entry} />
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
