import {client, getAssetCached} from './contentfulClient';

export async function getB3Assets() {
  const assets = ['7kyEOS1dsbBjsag1FiN5iK', '4nGfC80BPGaEa2KDhE09ST', '1qzDU1ZDpWfCfjwD4lU6lk'];
  const response = await Promise.all(assets.map((asset) => getAssetCached(asset)));
  // console.log(JSON.stringify(response, null, 2))
  return response;
}
/**
 * logo: 7kyEOS1dsbBjsag1FiN5iK
 * trail map: 4nGfC80BPGaEa2KDhE09ST
 * future map: 1qzDU1ZDpWfCfjwD4lU6lk
 */
