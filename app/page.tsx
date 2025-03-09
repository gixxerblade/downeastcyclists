import { getHeroVideo } from '@/src/contentful/video'
import TrailStatus from '@/src/components/TrailStatus'
import { Box, Container, Paper } from '@mui/material'

export default async function Home () {
  const video = await getHeroVideo();
  return (
    <>
      <section className="fixed inset-0 flex flex-col items-center justify-center text-center text-white -mt-[64px]">
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <video
            className="w-full h-full absolute object-cover"
            src={video.fields.file?.url}
            autoPlay
            muted
            loop
            playsInline
          ></video>
        </div>
        <div className="video-content space-y-2 z-10 mt-[64px] select-none">
          <h1 className="text-6xl">Welcome to Down East Cyclists</h1>
          <h3 className="font-light text-3xl">A Recreational Cycling Club in Eastern North Carolina</h3>
          <h3 className="font-light text-3xl">Dedicated to Promoting Safe Cycling in Eastern NC</h3>
        </div>
      </section>

      <Box sx={{ position: 'fixed', bottom: 0, width: '100%', zIndex: 10 }}>
        <Container maxWidth="sm" sx={{ mb: 4 }}>
          <TrailStatus showTitle={false} />
        </Container>
      </Box>
    </>
  );
}
