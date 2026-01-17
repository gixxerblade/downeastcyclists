import {Firestore} from '@google-cloud/firestore';
import {NextResponse} from 'next/server';

interface TrailData {
  id: string;
  trail: string;
  open: boolean;
  notes: string;
  shouldShow: boolean;
}

let cachedTrails: TrailData[] | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET() {
  const now = Date.now();
  if (cachedTrails && now - cachedAt < CACHE_TTL) {
    return NextResponse.json(cachedTrails);
  }

  try {
    const db = new Firestore({
      projectId: process.env.GOOGLE_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
      },
    });

    const snapshot = await db.collection('trails').get();
    const result: TrailData[] = snapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}) as TrailData)
      .filter((item): item is TrailData => item.shouldShow);

    cachedTrails = result;
    cachedAt = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching trails:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trails data',
        details: error instanceof Error ? error.message : String(error),
      },
      {status: 500},
    );
  }
}
