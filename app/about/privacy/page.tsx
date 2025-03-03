import React from 'react';
import { Container, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fetchPrivacy } from '@/src/contentful/privacy';

// Force static generation since bylaws rarely change
export const dynamic = 'force-static';

export default async function Privacy() {
  const privacy = await fetchPrivacy();
  
  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Privacy Policy
      </Typography>
      
      {privacy.length > 0 ? (
        privacy.map((privacy) => (
          <Accordion key={privacy.id} sx={{ marginBottom: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${privacy.id}-content`}
              id={`${privacy.id}-header`}
            >
              <Typography variant="h6">{privacy.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {privacy.body}
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        // Fallback to local data if no Contentful data is available
        <Typography variant="body1" align="center">
          PRivacy content is currently being updated. Please check back later.
        </Typography>
      )}
    </Container>
  );
}
