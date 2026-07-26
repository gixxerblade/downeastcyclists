import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {getPublicTrailMaintenanceReport} from '@/src/lib/trail-maintenance/repository';

export const dynamic = 'force-dynamic';

interface ReportTrailIssueDetailPageProps {
  readonly params: Promise<{readonly publicId: string}>;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mapUrl(latitude: number, longitude: number): string {
  const delta = 0.004;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export default async function ReportTrailIssueDetailPage({
  params,
}: ReportTrailIssueDetailPageProps) {
  const {publicId} = await params;
  const report = await getPublicTrailMaintenanceReport(publicId);
  if (!report) notFound();

  const hasCoordinates = report.latitude !== null && report.longitude !== null;

  return (
    <Container maxWidth="md" sx={{py: {xs: 4, md: 7}}}>
      <Paper className="dec-card" sx={{p: {xs: 2.5, md: 4}}}>
        <Stack spacing={3}>
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Report submitted. Organizers can now review and track this issue.
          </Alert>

          <Box>
            <Typography variant="overline" color="text.secondary" sx={{fontWeight: 800}}>
              Report {report.publicId}
            </Typography>
            <Typography variant="h1" sx={{fontSize: {xs: 38, md: 56}, lineHeight: 1.05, mt: 0.5}}>
              {report.issueTypeLabel}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={report.statusLabel} color="primary" />
            <Chip label={`Priority: ${report.priorityLabel}`} variant="outlined" />
            <Chip label={report.trailSystemName} variant="outlined" />
            {report.trailSegmentName && <Chip label={report.trailSegmentName} variant="outlined" />}
          </Stack>

          <Divider />

          <Box sx={{display: 'grid', gap: 2}}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Submitted
              </Typography>
              <Typography>{formatDateTime(report.createdAt)}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Observed
              </Typography>
              <Typography>{formatDateTime(report.observedAt)}</Typography>
            </Box>
            {report.resolvedAt && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Resolved
                </Typography>
                <Typography>{formatDateTime(report.resolvedAt)}</Typography>
              </Box>
            )}
          </Box>

          {report.description && (
            <Box>
              <Typography variant="h2" sx={{fontSize: 24, mb: 1}}>
                Details
              </Typography>
              <Typography sx={{whiteSpace: 'pre-wrap'}}>{report.description}</Typography>
            </Box>
          )}

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1}}>
              <LocationOnIcon color="primary" />
              <Typography variant="h2" sx={{fontSize: 24}}>
                Location
              </Typography>
            </Stack>
            {report.locationNotes && (
              <Typography sx={{whiteSpace: 'pre-wrap', mb: 2}}>{report.locationNotes}</Typography>
            )}
            {hasCoordinates ? (
              <Box
                component="iframe"
                title={`Map for trail issue report ${report.publicId}`}
                src={mapUrl(report.latitude, report.longitude)}
                sx={{
                  width: '100%',
                  height: {xs: 260, md: 360},
                  border: 0,
                  borderRadius: 1,
                }}
              />
            ) : (
              <Typography color="text.secondary">
                No GPS coordinates were submitted for this report.
              </Typography>
            )}
          </Box>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{mb: 1}}>
              <PhotoCameraIcon color="primary" />
              <Typography variant="h2" sx={{fontSize: 24}}>
                Photo
              </Typography>
            </Stack>
            {report.photos.length > 0 ? (
              <Stack spacing={2}>
                {report.photos.map((photo) =>
                  photo.url ? (
                    <Box
                      key={photo.id}
                      component="img"
                      src={photo.url}
                      alt={photo.originalFilename || `Trail issue report ${report.publicId}`}
                      sx={{
                        width: '100%',
                        maxHeight: 520,
                        objectFit: 'contain',
                        bgcolor: 'grey.100',
                        borderRadius: 1,
                      }}
                    />
                  ) : (
                    <Alert key={photo.id} severity="info">
                      Photo preview is not available right now.
                    </Alert>
                  ),
                )}
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No photo was submitted with this report.
              </Typography>
            )}
          </Box>

          <Divider />

          <Stack direction={{xs: 'column', sm: 'row'}} spacing={1.5}>
            <Button
              component={Link}
              href="/report-trail-issue"
              variant="contained"
              startIcon={<ReportProblemIcon />}
            >
              Submit another report
            </Button>
            <Button component={Link} href="/" variant="outlined">
              Return home
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
