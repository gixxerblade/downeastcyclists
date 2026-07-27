'use client';

import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import MapIcon from '@mui/icons-material/Map';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useMemo, useState} from 'react';

import {
  trailIssuePriorities,
  trailIssuePriorityLabels,
  trailIssueStatuses,
  trailIssueStatusLabels,
  type TrailIssuePriority,
  type TrailIssueStatus,
} from '@/src/lib/trail-maintenance/constants';
import type {
  TrailMaintenanceListResult,
  TrailMaintenanceReportDetail,
} from '@/src/lib/trail-maintenance/repository';

interface CountyEmailDraft {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly mailto: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data: unknown = body && isJson ? JSON.parse(body) : null;

  if (!response.ok) {
    const fallback =
      body && !body.trimStart().startsWith('<')
        ? body.slice(0, 240)
        : `Request failed with status ${response.status}`;
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : fallback;
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error('Server returned a non-JSON response');
  }

  return data as T;
}

function statusColor(
  status: TrailIssueStatus,
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  if (status === 'resolved') return 'success';
  if (status === 'county_needed' || status === 'county_contacted') return 'warning';
  if (status === 'new') return 'info';
  return 'default';
}

const trailIssueStatusShortLabels: Record<TrailIssueStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  assigned: 'Assigned',
  county_needed: 'County',
  county_contacted: 'Contacted',
  in_progress: 'Active',
  resolved: 'Resolved',
  closed_no_action: 'Closed',
  duplicate: 'Duplicate',
};

const trailIssueStatusDefinitions: Record<TrailIssueStatus, string> = {
  new: 'New report that has not been reviewed yet.',
  triaged: 'Reviewed and categorized, but work has not been assigned.',
  assigned: 'Assigned to an organizer or volunteer for follow-up.',
  county_needed: 'Needs Onslow County Parks and Recreation help.',
  county_contacted: 'County has been contacted and the report is waiting on follow-up.',
  in_progress: 'Maintenance work is underway.',
  resolved: 'Issue was addressed and the trail report is complete.',
  closed_no_action: 'Reviewed and closed without maintenance work needed.',
  duplicate: 'Same issue is already being tracked on another report.',
};

function mapsEmbedUrl(report: TrailMaintenanceReportDetail): string | null {
  if (report.latitude === null || report.longitude === null) return null;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${report.longitude - 0.002}%2C${
    report.latitude - 0.002
  }%2C${report.longitude + 0.002}%2C${report.latitude + 0.002}&layer=mapnik&marker=${
    report.latitude
  }%2C${report.longitude}`;
}

export function TrailMaintenanceManagement() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [note, setNote] = useState('');
  const [countyDraft, setCountyDraft] = useState<CountyEmailDraft | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({pageSize: '50'});
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [statusFilter]);

  const reportsQuery = useQuery({
    queryKey: ['admin', 'trail-maintenance', 'reports', queryParams],
    queryFn: () =>
      fetchJson<TrailMaintenanceListResult>(`/api/admin/trail-maintenance/reports?${queryParams}`),
  });

  const reportId = selectedId || reportsQuery.data?.reports[0]?.id || null;
  const detailQuery = useQuery({
    queryKey: ['admin', 'trail-maintenance', 'report', reportId],
    queryFn: () =>
      fetchJson<TrailMaintenanceReportDetail>(`/api/admin/trail-maintenance/reports/${reportId}`),
    enabled: Boolean(reportId),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      status?: TrailIssueStatus;
      priority?: TrailIssuePriority;
      internalNote?: string;
    }) =>
      fetchJson<{ok: true}>(`/api/admin/trail-maintenance/reports/${reportId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['admin', 'trail-maintenance', 'reports']}),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'trail-maintenance', 'report', reportId],
        }),
      ]);
    },
  });

  const countyEmailMutation = useMutation({
    mutationFn: () =>
      fetchJson<CountyEmailDraft>(`/api/admin/trail-maintenance/reports/${reportId}/county-email`, {
        method: 'POST',
      }),
    onSuccess: (draft) => setCountyDraft(draft),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/trail-maintenance/reports/export');
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Failed to export trail maintenance reports';
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filename =
        disposition?.match(/filename="([^"]+)"/)?.[1] ?? 'trail-maintenance-reports.csv';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });

  const selected = detailQuery.data;
  const mapUrl = selected ? mapsEmbedUrl(selected) : null;

  return (
    <Box sx={{display: 'grid', gap: 3}}>
      <Paper className="dec-card" sx={{p: 3}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center'}}>
          <Box>
            <Typography variant="h4" component="h2">
              Trail maintenance reports
            </Typography>
            <Typography color="text.secondary">
              Review rider reports, add notes, update progress, and prepare county escalation
              emails.
            </Typography>
          </Box>
          <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || reportsQuery.isLoading}
            >
              {exportMutation.isPending ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => reportsQuery.refetch()}
              disabled={reportsQuery.isFetching}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </Paper>

      {(reportsQuery.error ||
        detailQuery.error ||
        updateMutation.error ||
        countyEmailMutation.error ||
        exportMutation.error) && (
        <Alert severity="error">
          {reportsQuery.error?.message ||
            detailQuery.error?.message ||
            updateMutation.error?.message ||
            countyEmailMutation.error?.message ||
            exportMutation.error?.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{xs: 12, lg: 4}}>
          <Paper className="dec-card" sx={{p: 2, display: 'grid', gap: 2}}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <MenuItem value="">All open and closed</MenuItem>
                {trailIssueStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {trailIssueStatusLabels[status]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{display: 'grid'}}>
              {reportsQuery.data?.reports.map((report) => (
                <Button
                  key={report.id}
                  onClick={() => {
                    setSelectedId(report.id);
                    setCountyDraft(null);
                  }}
                  sx={{
                    justifyContent: 'stretch',
                    textAlign: 'left',
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: reportId === report.id ? 'rgba(242,14,2,.08)' : 'transparent',
                    borderBottom: '1px solid var(--dec-border)',
                  }}
                >
                  <Box sx={{width: '100%', display: 'grid', gap: 0.75}}>
                    <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                      <Typography sx={{fontWeight: 900, minWidth: 0, flex: 1}} noWrap>
                        {report.publicId}
                      </Typography>
                      <Tooltip
                        title={`${report.statusLabel}: ${trailIssueStatusDefinitions[report.status]}`}
                        arrow
                      >
                        <Chip
                          size="small"
                          label={trailIssueStatusShortLabels[report.status]}
                          color={statusColor(report.status)}
                          aria-label={`Status: ${report.statusLabel}. ${
                            trailIssueStatusDefinitions[report.status]
                          }`}
                          sx={{
                            maxWidth: 96,
                            flexShrink: 0,
                            '& .MuiChip-label': {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            },
                          }}
                        />
                      </Tooltip>
                    </Box>
                    <Typography sx={{fontWeight: 800}}>{report.issueTypeLabel}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {report.trailSegmentName || report.trailSystemName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(report.createdAt).toLocaleString()} · {report.photoCount} photo
                      {report.photoCount === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                </Button>
              ))}
              {!reportsQuery.isLoading && reportsQuery.data?.reports.length === 0 && (
                <Typography align="center" color="text.secondary" sx={{py: 5}}>
                  No trail reports found.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{xs: 12, lg: 8}}>
          {selected ? (
            <Box sx={{display: 'grid', gap: 3}}>
              <Paper className="dec-card" sx={{p: 3}}>
                <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2}}>
                  <Box>
                    <Typography variant="h4" component="h2">
                      {selected.issueTypeLabel}
                    </Typography>
                    <Typography color="text.secondary">
                      {selected.publicId} · {selected.trailSystemName}
                      {selected.trailSegmentName ? ` · ${selected.trailSegmentName}` : ''}
                    </Typography>
                  </Box>
                  <Chip label={selected.priorityLabel} />
                </Box>

                <Grid container spacing={2}>
                  <Grid size={{xs: 12, md: 6}}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={selected.status}
                        label="Status"
                        onChange={(event) =>
                          updateMutation.mutate({status: event.target.value as TrailIssueStatus})
                        }
                      >
                        {trailIssueStatuses.map((status) => (
                          <MenuItem key={status} value={status}>
                            {trailIssueStatusLabels[status]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{xs: 12, md: 6}}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={selected.priority}
                        label="Priority"
                        onChange={(event) =>
                          updateMutation.mutate({
                            priority: event.target.value as TrailIssuePriority,
                          })
                        }
                      >
                        {trailIssuePriorities.map((priority) => (
                          <MenuItem key={priority} value={priority}>
                            {trailIssuePriorityLabels[priority]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box sx={{mt: 3, display: 'grid', gap: 1}}>
                  <Typography sx={{fontWeight: 900}}>Reporter notes</Typography>
                  <Typography color="text.secondary">
                    {selected.description || selected.locationNotes || 'No notes provided.'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Observed {new Date(selected.observedAt).toLocaleString()}
                  </Typography>
                </Box>
              </Paper>

              <Grid container spacing={3}>
                <Grid size={{xs: 12, md: 6}}>
                  <Paper className="dec-card" sx={{p: 2}}>
                    <Typography sx={{fontWeight: 900, mb: 1}}>Photos</Typography>
                    <Box sx={{display: 'grid', gap: 1.5}}>
                      {selected.photos.map((photo) =>
                        photo.url ? (
                          <Box
                            key={photo.id}
                            component="img"
                            src={photo.url}
                            alt={photo.originalFilename || 'Trail issue'}
                            sx={{
                              width: '100%',
                              borderRadius: 1,
                              border: '1px solid var(--dec-border)',
                            }}
                          />
                        ) : (
                          <Alert key={photo.id} severity="warning">
                            R2 is not configured, so this image cannot be viewed.
                          </Alert>
                        ),
                      )}
                      {selected.photos.length === 0 && (
                        <Typography color="text.secondary">No photos submitted.</Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                <Grid size={{xs: 12, md: 6}}>
                  <Paper className="dec-card" sx={{p: 2}}>
                    <Typography sx={{fontWeight: 900, mb: 1}}>Location</Typography>
                    {mapUrl ? (
                      <Box
                        component="iframe"
                        title="Trail issue location"
                        src={mapUrl}
                        sx={{
                          width: '100%',
                          height: 280,
                          border: '1px solid var(--dec-border)',
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Typography color="text.secondary">
                        {selected.locationNotes || 'No mapped location was submitted.'}
                      </Typography>
                    )}
                    {selected.latitude !== null && selected.longitude !== null && (
                      <Button
                        href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        startIcon={<MapIcon />}
                        sx={{mt: 1}}
                      >
                        Open in maps
                      </Button>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              <Paper className="dec-card" sx={{p: 3, display: 'grid', gap: 2}}>
                <Typography sx={{fontWeight: 900}}>Internal notes</Typography>
                <TextField
                  label="Add note"
                  multiline
                  minRows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  variant="outlined"
                  startIcon={<NoteAddIcon />}
                  disabled={!note.trim() || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({internalNote: note})}
                  sx={{justifySelf: 'start'}}
                >
                  Add note
                </Button>
                {selected.notes.map((item) => (
                  <Box key={item.id} sx={{borderTop: '1px solid var(--dec-border)', pt: 1.5}}>
                    <Typography>{item.note}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.authorEmail || 'Organizer'} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Paper>

              <Paper className="dec-card" sx={{p: 3, display: 'grid', gap: 2}}>
                <Typography sx={{fontWeight: 900}}>County escalation</Typography>
                <Button
                  variant="contained"
                  startIcon={<EmailIcon />}
                  disabled={countyEmailMutation.isPending}
                  onClick={() => countyEmailMutation.mutate()}
                  sx={{justifySelf: 'start'}}
                >
                  Generate county email
                </Button>
                {countyDraft && (
                  <Box sx={{display: 'grid', gap: 1}}>
                    <TextField label="To" value={countyDraft.to} size="small" />
                    <TextField label="Subject" value={countyDraft.subject} size="small" />
                    <TextField label="Body" value={countyDraft.body} multiline minRows={10} />
                    <Button
                      href={countyDraft.mailto}
                      variant="outlined"
                      sx={{justifySelf: 'start'}}
                    >
                      Open email
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
          ) : (
            <Paper className="dec-card" sx={{p: 5}}>
              <Typography align="center" color="text.secondary">
                Select a trail report.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
