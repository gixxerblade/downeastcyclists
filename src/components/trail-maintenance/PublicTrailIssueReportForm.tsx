'use client';

import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useRouter, useSearchParams} from 'next/navigation';
import Script from 'next/script';
import {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {
  TRAIL_MAINTENANCE_PHOTO_LIMIT,
  TRAIL_MAINTENANCE_PHOTO_MAX_BYTES,
  TRAIL_MAINTENANCE_TURNSTILE_ACTION,
  TRAIL_SYSTEM_BIG_BRANCH,
  trailMaintenancePhotoContentTypes,
  trailIssueTypeLabels,
  trailIssueTypes,
} from '@/src/lib/trail-maintenance/constants';
import type {TrailMaintenanceOption} from '@/src/lib/trail-maintenance/repository';

type TurnstileWidgetId = string;
type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TrailPhotoUploadTarget {
  readonly uploadUrl: string;
  readonly contentType: string;
  readonly sortOrder: number;
}

interface TrailPhotoUploadSessionResponse {
  readonly uploadToken: string;
  readonly uploads: readonly TrailPhotoUploadTarget[];
}

interface TrailReportResponse {
  readonly publicId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === 'string' ? value.error : fallback;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function decodeUploadSession(value: unknown): TrailPhotoUploadSessionResponse | null {
  if (!isRecord(value) || typeof value.uploadToken !== 'string' || !Array.isArray(value.uploads)) {
    return null;
  }

  const uploads: TrailPhotoUploadTarget[] = [];
  for (const upload of value.uploads) {
    if (
      !isRecord(upload) ||
      typeof upload.uploadUrl !== 'string' ||
      typeof upload.contentType !== 'string' ||
      typeof upload.sortOrder !== 'number'
    ) {
      return null;
    }
    uploads.push({
      uploadUrl: upload.uploadUrl,
      contentType: upload.contentType,
      sortOrder: upload.sortOrder,
    });
  }

  return {uploadToken: value.uploadToken, uploads};
}

function decodeTrailReport(value: unknown): TrailReportResponse | null {
  return isRecord(value) && typeof value.publicId === 'string' ? {publicId: value.publicId} : null;
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function localDateTimeValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function PublicTrailIssueReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<TurnstileWidgetId | null>(null);
  const [options, setOptions] = useState<TrailMaintenanceOption[]>([]);
  const [trailSystemSlug, setTrailSystemSlug] = useState(
    searchParams?.get('system') || TRAIL_SYSTEM_BIG_BRANCH,
  );
  const [trailSegmentSlug, setTrailSegmentSlug] = useState(searchParams?.get('trail') || '');
  const [issueType, setIssueType] = useState('');
  const [photoInputs, setPhotoInputs] = useState(1);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [accuracy, setAccuracy] = useState('');
  const [locationSource, setLocationSource] = useState<'manual' | 'browser_geolocation'>('manual');
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<
    {type: 'success' | 'error'; message: string} | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const selectedSystem = useMemo(
    () => options.find((option) => option.slug === trailSystemSlug),
    [options, trailSystemSlug],
  );
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  const renderTurnstile = useCallback(() => {
    if (
      !siteKey ||
      !turnstileContainer.current ||
      turnstileWidgetId.current !== null ||
      !window.turnstile
    ) {
      return;
    }

    turnstileWidgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      action: TRAIL_MAINTENANCE_TURNSTILE_ACTION,
      callback: setTurnstileToken,
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    });
  }, [siteKey]);

  const resetTurnstile = useCallback(() => {
    if (turnstileWidgetId.current !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
    setTurnstileToken('');
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/trail-maintenance/options')
      .then((response) => response.json())
      .then((data: {trailSystems?: TrailMaintenanceOption[]}) => {
        if (!isMounted) return;
        const loaded = data.trailSystems ?? [];
        setOptions(loaded);
        const system = loaded.find((item) => item.slug === trailSystemSlug) ?? loaded[0];
        if (system) {
          setTrailSystemSlug(system.slug);
          if (!trailSegmentSlug) {
            setTrailSegmentSlug(system.segments[0]?.slug ?? '');
          }
        }
      })
      .catch(() => setSubmitStatus({type: 'error', message: 'Trail choices failed to load'}));
    return () => {
      isMounted = false;
    };
  }, [trailSegmentSlug, trailSystemSlug]);

  const useCurrentLocation = () => {
    setLocationStatus('Requesting location...');
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setAccuracy(String(Math.round(position.coords.accuracy)));
        setLocationSource('browser_geolocation');
        setLocationStatus(
          `Location added, accuracy about ${Math.round(position.coords.accuracy)}m.`,
        );
      },
      () =>
        setLocationStatus('Location permission was not granted. Add a landmark or sign instead.'),
      {enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000},
    );
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitStatus(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.set('trailSystemSlug', trailSystemSlug);
    formData.set('trailSegmentSlug', trailSegmentSlug);
    formData.set('issueType', issueType);
    formData.set('locationSource', locationSource);
    formData.set('latitude', latitude);
    formData.set('longitude', longitude);
    formData.set('locationAccuracyMeters', accuracy);

    if (siteKey && turnstileToken.length === 0) {
      setSubmitStatus({
        type: 'error',
        message:
          'Bot check did not complete. Reload the page and try again. If you are testing locally, use the Cloudflare Turnstile test keys.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const photos = formData
        .getAll('photos')
        .filter((value): value is File => value instanceof File && value.size > 0);
      if (photos.length > TRAIL_MAINTENANCE_PHOTO_LIMIT) {
        throw new Error(`Upload up to ${TRAIL_MAINTENANCE_PHOTO_LIMIT} photos`);
      }
      for (const photo of photos) {
        if (photo.size > TRAIL_MAINTENANCE_PHOTO_MAX_BYTES) {
          throw new Error('Photos must be no larger than 10 MB');
        }
        if (!trailMaintenancePhotoContentTypes.includes(photo.type)) {
          throw new Error('Photos must be JPEG, PNG, or WebP images');
        }
      }

      const uploadSessionResponse = await fetch('/api/trail-maintenance/reports/uploads', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          turnstileToken: turnstileToken || undefined,
          files: photos.map((photo) => ({
            originalFilename: photo.name,
            contentType: photo.type,
            byteSize: photo.size,
          })),
        }),
      });
      const uploadSessionBody = await readResponseBody(uploadSessionResponse);
      if (!uploadSessionResponse.ok) {
        throw new Error(errorMessage(uploadSessionBody, 'Photo uploads could not be prepared'));
      }
      const uploadSession = decodeUploadSession(uploadSessionBody);
      if (!uploadSession || uploadSession.uploads.length !== photos.length) {
        throw new Error('Photo upload service returned an invalid response');
      }

      await Promise.all(
        uploadSession.uploads.map(async (upload, index) => {
          const photo = photos[index];
          if (!photo || upload.sortOrder !== index || upload.contentType !== photo.type) {
            throw new Error('Photo upload mapping is invalid');
          }
          const uploadResponse = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: {'Content-Type': upload.contentType},
            body: photo,
          });
          if (!uploadResponse.ok) {
            throw new Error(`Photo ${index + 1} could not be uploaded`);
          }
        }),
      );

      const reportResponse = await fetch('/api/trail-maintenance/reports', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          issueType,
          issueTypeOther: formString(formData, 'issueTypeOther'),
          observedAt: formString(formData, 'observedAt'),
          trailSystemSlug,
          trailSegmentSlug,
          locationSource,
          locationNotes: formString(formData, 'locationNotes'),
          latitude,
          longitude,
          locationAccuracyMeters: accuracy,
          description: formString(formData, 'description'),
          reporterName: formString(formData, 'reporterName'),
          reporterContact: formString(formData, 'reporterContact'),
          uploadToken: uploadSession.uploadToken,
        }),
      });
      const reportBody = await readResponseBody(reportResponse);
      if (!reportResponse.ok) {
        throw new Error(errorMessage(reportBody, 'Report could not be submitted'));
      }
      const report = decodeTrailReport(reportBody);
      if (!report) {
        throw new Error('Report service returned an invalid response');
      }
      router.push(`/report-trail-issue/${encodeURIComponent(report.publicId)}`);
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Report could not be submitted',
      });
    } finally {
      if (siteKey) {
        resetTurnstile();
      }
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{py: {xs: 4, md: 7}}}>
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderTurnstile}
        />
      )}

      <Paper className="dec-card" sx={{p: {xs: 2.5, md: 4}}}>
        <Box sx={{display: 'flex', gap: 1.5, alignItems: 'center', mb: 2}}>
          <ReportProblemIcon color="primary" />
          <Typography variant="h2" sx={{fontSize: {xs: 32, md: 44}, lineHeight: 1}}>
            Report a Big Branch Trail Issue
          </Typography>
        </Box>
        <Alert severity="warning" sx={{mb: 3}}>
          This form is not for emergencies. Call 911 for medical emergencies or immediate
          life-safety hazards.
        </Alert>

        {submitStatus && (
          <Alert severity={submitStatus.type} sx={{mb: 3}}>
            {submitStatus.message}
          </Alert>
        )}

        <Box component="form" onSubmit={submitReport} sx={{display: 'grid', gap: 3}}>
          <Grid container spacing={2}>
            <Grid size={{xs: 12, md: 6}}>
              <FormControl fullWidth required>
                <InputLabel>Issue</InputLabel>
                <Select
                  value={issueType}
                  label="Issue"
                  onChange={(event) => setIssueType(event.target.value)}
                >
                  {trailIssueTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {trailIssueTypeLabels[type]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{xs: 12, md: 6}}>
              <TextField
                fullWidth
                required
                name="observedAt"
                label="Observed"
                type="datetime-local"
                defaultValue={localDateTimeValue(new Date())}
                slotProps={{inputLabel: {shrink: true}}}
              />
            </Grid>
            {issueType === 'other' && (
              <Grid size={{xs: 12}}>
                <TextField fullWidth required name="issueTypeOther" label="Issue type" />
              </Grid>
            )}
            <Grid size={{xs: 12, md: 6}}>
              <FormControl fullWidth required>
                <InputLabel>Trail system</InputLabel>
                <Select
                  value={trailSystemSlug}
                  label="Trail system"
                  onChange={(event) => {
                    const nextSystem = options.find((option) => option.slug === event.target.value);
                    setTrailSystemSlug(event.target.value);
                    setTrailSegmentSlug(nextSystem?.segments[0]?.slug ?? '');
                  }}
                >
                  {options.map((option) => (
                    <MenuItem key={option.slug} value={option.slug}>
                      {option.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{xs: 12, md: 6}}>
              <FormControl fullWidth required>
                <InputLabel>Trail</InputLabel>
                <Select
                  value={trailSegmentSlug}
                  label="Trail"
                  onChange={(event) => setTrailSegmentSlug(event.target.value)}
                >
                  {(selectedSystem?.segments ?? []).map((segment) => (
                    <MenuItem key={segment.slug} value={segment.slug}>
                      {segment.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{display: 'grid', gap: 1.5}}>
            <Button
              type="button"
              variant="outlined"
              startIcon={<GpsFixedIcon />}
              onClick={useCurrentLocation}
              sx={{justifySelf: 'start'}}
            >
              Use my location
            </Button>
            {locationStatus && <Typography color="text.secondary">{locationStatus}</Typography>}
            <TextField
              name="locationNotes"
              label="Trail sign, landmark, or location notes"
              multiline
              minRows={3}
              helperText="Use current location or describe the closest sign, feature, or landmark."
            />
          </Box>

          <TextField
            name="description"
            label="Details"
            multiline
            minRows={3}
            helperText="Add anything that will help organizers understand the issue."
          />

          <Box sx={{display: 'grid', gap: 1}}>
            <Typography sx={{fontWeight: 800}}>Photo of the issue</Typography>
            <Typography variant="body2" color="text.secondary">
              Upload one clear photo if you can. Add more only if it helps locate or explain the
              issue. JPEG, PNG, and WebP photos up to 10 MB each are supported.
            </Typography>
            {Array.from({length: photoInputs}).map((_, index) => (
              <Button
                key={index}
                component="label"
                variant="outlined"
                startIcon={<AddPhotoAlternateIcon />}
                sx={{justifySelf: 'start'}}
              >
                {index === 0 ? 'Choose photo' : `Choose photo ${index + 1}`}
                <input hidden name="photos" type="file" accept="image/jpeg,image/png,image/webp" />
              </Button>
            ))}
            {photoInputs < TRAIL_MAINTENANCE_PHOTO_LIMIT && (
              <Button
                type="button"
                variant="text"
                onClick={() =>
                  setPhotoInputs((count) => Math.min(count + 1, TRAIL_MAINTENANCE_PHOTO_LIMIT))
                }
                sx={{justifySelf: 'start'}}
              >
                Add another photo
              </Button>
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid size={{xs: 12, md: 6}}>
              <TextField fullWidth name="reporterName" label="Name (optional)" />
            </Grid>
            <Grid size={{xs: 12, md: 6}}>
              <TextField
                fullWidth
                name="reporterContact"
                label="Phone or email (optional)"
                helperText="Only used if organizers need help locating the issue."
              />
            </Grid>
          </Grid>

          {siteKey && <Box ref={turnstileContainer} />}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={
              isSubmitting || !issueType || !trailSegmentSlug || Boolean(siteKey && !turnstileToken)
            }
            startIcon={isSubmitting ? <CircularProgress size={18} /> : undefined}
            sx={{justifySelf: 'start'}}
          >
            Submit report
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
