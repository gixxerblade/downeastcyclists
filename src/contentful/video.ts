import { client, getAssetCached } from "./contentfulClient";

export const getHeroVideo = async () => {
  const video = await getAssetCached("5wZuRU3hRNL2PPzaH6NB70");
  // console.log(JSON.stringify(video, null, 2))
  return video;
};
