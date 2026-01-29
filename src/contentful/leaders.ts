import {Entry} from 'contentful';

import {TypeLeadersSkeleton} from '@/src/contentful/types';

import {getEntriesCached} from './contentfulClient';
import {ContentImage, parseContentfulContentImage} from './contentImage';

type LeaderEntry = Entry<TypeLeadersSkeleton, undefined, string>;

type Link = {url: string} | null | undefined;

export interface Leader {
  image: ContentImage | null;
  link: Link;
  name: string | undefined;
  order: number | undefined;
  position: string | undefined;
}

const parseContentfulLeaders = (leader: LeaderEntry): Leader => ({
  image: parseContentfulContentImage(leader.fields.image),
  link: leader.fields.link,
  name: leader.fields.name,
  order: leader.fields.order,
  position: leader.fields.position,
});

export const fetchLeaders = async (): Promise<Leader[]> => {
  const leaders = await getEntriesCached<TypeLeadersSkeleton>({
    content_type: 'leaders',
    order: ['fields.order'], // Sort by order field
  });
  if (leaders.items.length) {
    return leaders.items.map(parseContentfulLeaders);
  }
  return [];
};
