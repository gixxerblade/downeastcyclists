import { client } from './contentfulClient'

export const getHeroVideo = async () => {
  const video = await client.getAsset('5wZuRU3hRNL2PPzaH6NB70');
  return video;
}