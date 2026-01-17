import {cache} from 'react';

export interface TrailData {
  id: string;
  trail: string;
  open: boolean;
  notes: string;
}

/**
 * Fetches trail data from the API
 * This function is cached to prevent unnecessary API calls
 */
export const getTrails = cache(async (): Promise<TrailData[]> => {
  try {
    // Use relative URL in the browser, absolute URL in SSR
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/trails`, {
      // Ensure we get fresh data
      next: {revalidate: 300}, // Revalidate every 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trails: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching trails:', error);
    return [];
  }
});
