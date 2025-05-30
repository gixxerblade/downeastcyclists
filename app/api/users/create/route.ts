import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin'; // Assuming @ points to src

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, displayName } = body;

    if (!uid || !email) {
      return NextResponse.json({ error: 'UID and email are required' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 }); // 409 Conflict
    }

    const newUser = {
      email,
      displayName: displayName || null,
      membership: {
        status: 'inactive', // or 'pending_payment'
        tier: 'individual',
        startDate: null,
        endDate: null,
      },
      paymentHistory: [],
      createdAt: new Date().toISOString(), // Optional: timestamp for creation
    };

    await userRef.set(newUser);

    return NextResponse.json({ message: 'User created successfully', data: { uid, ...newUser } }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.message.includes('firestore')) {
        return NextResponse.json({ error: 'Error interacting with database' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
