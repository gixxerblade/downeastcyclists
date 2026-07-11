import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Typography, Accordion, AccordionSummary, AccordionDetails} from '@mui/material';
import React from 'react';

import {fetchPrivacy} from '@/src/contentful/privacy';

// Force static generation since bylaws rarely change
export const dynamic = 'force-static';

export default async function Privacy() {
  const privacy = await fetchPrivacy();

  return (
    <main className="dec-page">
      <section className="dec-container max-w-4xl py-16 md:py-20">
        <div className="mb-4 text-center text-sm font-bold tracking-[.1em] text-[#F20E02]">PRIVACY</div>
        <h1 className="dec-display text-center text-6xl md:text-[82px]">Privacy Policy</h1>

      {privacy.length > 0 ? (
        privacy.map((privacy) => (
          <Accordion key={privacy.id} className="dec-card" sx={{mt: 2, boxShadow: 'none', '&:before': {display: 'none'}}}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${privacy.id}-content`}
              id={`${privacy.id}-header`}
            >
              <Typography variant="h6">{privacy.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>{privacy.body}</AccordionDetails>
          </Accordion>
        ))
      ) : (
        // Fallback to local data if no Contentful data is available
        <Typography variant="body1" align="center">
          Privacy content is currently being updated. Please check back later.
        </Typography>
      )}
      </section>
    </main>
  );
}
