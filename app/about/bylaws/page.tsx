import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Typography, Accordion, AccordionSummary, AccordionDetails} from '@mui/material';
import React from 'react';

import {fetchBylaws} from '@/src/contentful/bylaws';

// Force static generation since bylaws rarely change
export const dynamic = 'force-static';

export default async function Bylaws() {
  const bylaws = await fetchBylaws();

  return (
    <main className="dec-page">
      <section className="dec-container max-w-4xl py-16 md:py-20">
        <div className="mb-4 text-center text-sm font-bold tracking-[.1em] text-[#F20E02]">GOVERNANCE</div>
        <h1 className="dec-display text-center text-6xl md:text-[82px]">Club Bylaws</h1>

      {bylaws.length > 0 ? (
        bylaws.map((bylaw) => (
          <Accordion key={bylaw.id} className="dec-card" sx={{mt: 2, boxShadow: 'none', '&:before': {display: 'none'}}}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${bylaw.id}-content`}
              id={`${bylaw.id}-header`}
            >
              <Typography variant="h6">{bylaw.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>{bylaw.body}</AccordionDetails>
          </Accordion>
        ))
      ) : (
        // Fallback to local data if no Contentful data is available
        <Typography variant="body1" align="center">
          Bylaws content is currently being updated. Please check back later.
        </Typography>
      )}
      </section>
    </main>
  );
}
