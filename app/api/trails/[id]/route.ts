import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';

import {getFirestoreClient} from '@/src/lib/firestore-client';

interface TrailUpdateData {
  trail?: string;
  open?: boolean;
  notes?: string;
}

export async function PATCH(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const authToken = cookieStore.get('session');

    if (!authToken) {
      return NextResponse.json({error: 'Authentication required'}, {status: 401});
    }

    // Get the trail ID from the URL params
    const {id} = await params;
    if (!id) {
      return NextResponse.json({error: 'Trail ID is required'}, {status: 400});
    }

    // Parse the request body
    const trailData: TrailUpdateData = await request.json();

    const db = getFirestoreClient();

    // Reference to the trail document
    const trailRef = db.collection('trails').doc(id);

    // Update the trail document
    // Convert to a plain object to avoid TypeScript issues with Firestore
    await trailRef.update(trailData as {[key: string]: any});

    // Return success response
    return NextResponse.json({success: true});
  } catch (error) {
    console.error('Error updating trail:', error);
    return NextResponse.json(
      {
        error: 'Failed to update trail',
        details: error instanceof Error ? error.message : String(error),
      },
      {status: 500},
    );
  }
}
