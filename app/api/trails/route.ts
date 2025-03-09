import { Firestore } from '@google-cloud/firestore';
import { NextResponse } from 'next/server';

interface TrailData {
  id: string;
  trail: string;
  open: boolean;
  notes: string;
  shouldShow: boolean;
}

export async function GET() {
  try {
    // Match the Netlify function implementation exactly
    const db = new Firestore({
      projectId: process.env.GOOGLE_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
      },
    });

    const snapshot = await db.collection('trails').get();

    if (snapshot) {
      const result: TrailData[] = [];
      snapshot.forEach(item => {
        const obj = item.data() as any;
        obj.id = item.id;
        if (obj.shouldShow) {
          result.push(obj);
        }
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ data: 'No data' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching trails:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trails data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
