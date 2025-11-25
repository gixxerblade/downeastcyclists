import { getB3Assets } from "@/src/contentful/b3";
import { Typography, Container, Box, Paper } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import TrailStatus from "@/src/components/TrailStatus";

export default async function B3() {
  const [logo, trailMap, futureMap] = await getB3Assets();

  return (
    <>
      <Container maxWidth="md" sx={{ paddingTop: 12, paddingBottom: 0 }}>
        <Box sx={{ mb: 4 }}>
          <TrailStatus showTitle={false} />
        </Box>

        <Box sx={{ textAlign: "center", mb: 3, display: "flex", justifyContent: "center" }}>
          {logo.fields.file?.url && (
            <Image
              src={`https:${logo.fields.file.url}`}
              width={600}
              height={400}
              alt="B3 Image"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          )}
        </Box>

        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Link href="https://www.strava.com/segments/28334000" target="_blank" rel="noopener">
            Inner Loop Map
          </Link>
          <br />
          <Link href="https://www.strava.com/segments/28334049" target="_blank" rel="noopener">
            Outer Loop Map
          </Link>
        </Box>
      </Container>

      <Container maxWidth="md" sx={{ paddingTop: 2, paddingBottom: 2 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography sx={{ mb: 2 }}>
            With the help of a NC Parks-Recreational Trails grant, Onslow County completed
            construction of a new mountain bike park named Big Branch Bike Park, located within the
            existing Burton Park area. The park will also feature a cross-country running section.
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Big Branch Bike Park features a 1.6 mile beginner double flow track (Inner Loop) and a
            4.6 mile intermediate single-track (Outer Loop).
          </Typography>
          <Typography sx={{ mb: 2 }}>
            The trail is open from dawn to dusk and the county usually locks the gate before dark.
          </Typography>
          <Typography sx={{ mb: 2, fontWeight: "bold" }}>
            Trail direction switches based on day of week:
          </Typography>
          <Typography>M, W, F, Su : Clockwise</Typography>
          <Typography>T, Th, Sa: Counter Clockwise</Typography>
        </Box>
      </Container>

      <Container maxWidth="md" sx={{ paddingBottom: 8 }}>
        <Paper elevation={1} sx={{ p: 2, pt: 3, mb: 3, bgcolor: "#f5f5f5" }}>
          <Box sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              {trailMap.fields.file?.url && (
                <Image
                  src={`https:${trailMap.fields.file.url}`}
                  width={600}
                  height={400}
                  alt="B3 Map"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              )}
            </Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ pt: 1 }}>
              Current Big Branch Bike Park Configuration
            </Typography>
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ p: 2, pt: 3, bgcolor: "#f5f5f5" }}>
          <Box sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              {futureMap.fields.file?.url && (
                <Image
                  src={`https:${futureMap.fields.file.url}`}
                  width={600}
                  height={400}
                  alt="B3 Future Concept Map"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              )}
            </Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ pt: 1 }}>
              Future Concept of Big Branch Bike Park
            </Typography>
          </Box>
        </Paper>
      </Container>
    </>
  );
}
