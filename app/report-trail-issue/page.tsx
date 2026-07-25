import {Box, CircularProgress} from '@mui/material';
import {Suspense} from 'react';

import {PublicTrailIssueReportForm} from '@/src/components/trail-maintenance/PublicTrailIssueReportForm';

export default function ReportTrailIssuePage() {
  return (
    <Suspense
      fallback={
        <Box sx={{display: 'grid', placeItems: 'center', minHeight: 360}}>
          <CircularProgress />
        </Box>
      }
    >
      <PublicTrailIssueReportForm />
    </Suspense>
  );
}
