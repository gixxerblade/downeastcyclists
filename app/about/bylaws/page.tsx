import React from "react";
import {
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { fetchBylaws } from "@/src/contentful/bylaws";

// Force static generation since bylaws rarely change
export const dynamic = "force-static";

export default async function Bylaws() {
  const bylaws = await fetchBylaws();

  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Club Bylaws
      </Typography>

      {bylaws.length > 0 ? (
        bylaws.map((bylaw) => (
          <Accordion key={bylaw.id} sx={{ marginBottom: 2 }}>
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
    </Container>
  );
}
