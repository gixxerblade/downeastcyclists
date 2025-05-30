import { useQuery } from '@tanstack/react-query';

// Define a type for our user profile data from Firestore
// This should match the structure returned by your /api/users/[uid] endpoint
export interface UserProfile {
  email: string;
  displayName?: string | null;
  membership: {
    status: string;
    tier: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  createdAt?: string; // Optional, based on what your API returns
  // Add any other fields you expect from your Firestore 'users' collection
}

interface ApiUserProfileResponse {
    data: UserProfile; // Assuming your API wraps the profile in a 'data' object
}

// Asynchronous function to fetch the user profile
const fetchUserProfile = async (uid: string): Promise<UserProfile> => {
  if (!uid) {
    throw new Error('UID is required to fetch user profile.');
  }

  const response = await fetch(`/api/users/${uid}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
    throw new Error(errorData.error || `Error fetching profile: ${response.status} ${response.statusText}`);
  }

  const result: ApiUserProfileResponse = await response.json();
  if (!result.data) {
    throw new Error("User profile data not found in API response.");
  }
  return result.data;
};

// Custom hook to use TanStack Query for fetching user profile
export const useUserProfileQuery = (uid: string | null | undefined) => {
  return useQuery<UserProfile, Error>({ // Explicitly type for data and error
    queryKey: ['userProfile', uid],
    queryFn: () => {
      if (!uid) {
        // This should ideally not be reached if `enabled` is false,
        // but as a safeguard / for type-safety with queryFn:
        return Promise.reject(new Error('UID not available for fetching profile.'));
      }
      return fetchUserProfile(uid);
    },
    enabled: !!uid, // Query will only run if uid is truthy
    // Optional: Add other TanStack Query options here, like staleTime, cacheTime, retry, etc.
    // staleTime: 1000 * 60 * 5, // 5 minutes
    // cacheTime: 1000 * 60 * 30, // 30 minutes
  });
};
