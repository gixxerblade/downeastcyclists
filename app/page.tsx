import { getHeroVideo } from '@/src/contentful/video'

export default async function Home () {
  const video = await getHeroVideo();
  return (
    <section className="relative h-screen flex flex-col items-center justify-center text-center text-white py-0 px-3">
      <div className="absolute top-50% left-50% w-full h-full overflow-hidden">
        <video className="min-w-full min-h-full absolute object-cover" src={video.fields.file?.url} autoPlay muted loop></video>
      </div>
      <div className="video-content space-y-2 z-10">
        <h1 className="text-6xl">Welcome to Down East Cyclists</h1>
        <h3 className="font-light text-3xl">A Recreational Cycling Club in Eastern North Carolina</h3>
        <h3 className="font-light text-3xl">Dedicated to Promoting Safe Cycling in Eastern NC</h3>
      </div>
    </section>
  );
}
