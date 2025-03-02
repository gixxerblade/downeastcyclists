import { Asset, AssetLink } from 'contentful';

export interface ContentImage {
	src: string
	alt: string
	width: number
	height: number
}

export const parseContentfulContentImage = (
	asset?: Asset<undefined, string> | { sys: AssetLink }
): ContentImage | null => {
	if (!asset) {
		return null
	}

	if (!('fields' in asset)) {
		return null
	}

	return {
		src: `https:${asset.fields.file?.url}` || '',
		alt: asset.fields.description || '',
		width: asset.fields.file?.details.image?.width || 0,
		height: asset.fields.file?.details.image?.height || 0,
	}
}
