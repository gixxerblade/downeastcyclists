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
import {FormEvent, useEffect, useMemo, useState} from 'react';

import {
  TRAIL_MAINTENANCE_PHOTO_LIMIT,
  TRAIL_SYSTEM_BIG_BRANCH,
  trailIssueTypeLabels,
  trailIssueTypes,
} from '@/src/lib/trail-maintenance/constants';
import type {TrailMaintenanceOption} from '@/src/lib/trail-maintenance/repository';

function localDateTimeValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function PublicTrailIssueReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const selectedSystem = useMemo(
    () => options.find((option) => option.slug === trailSystemSlug),
    [options, trailSystemSlug],
  );
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

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

    const turnstileToken = formData.get('cf-turnstile-response');
    if (siteKey && (typeof turnstileToken !== 'string' || turnstileToken.length === 0)) {
      setSubmitStatus({
        type: 'error',
        message:
          'Bot check did not complete. Reload the page and try again. If you are testing locally, use the Cloudflare Turnstile test keys.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/trail-maintenance/reports', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Report could not be submitted');
      }
      router.push(`/report-trail-issue/${encodeURIComponent(data.publicId)}`);
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Report could not be submitted',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{py: {xs: 4, md: 7}}}>
      {siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
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
              issue.
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
                <input hidden name="photos" type="file" accept="image/*" />
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

          {siteKey && <Box className="cf-turnstile" data-sitekey={siteKey} />}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || !issueType || !trailSegmentSlug}
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
