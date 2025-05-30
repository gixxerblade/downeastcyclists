import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin'; // Assuming @ points to src

interface UserContext {
  params: {
    uid: string;
  };
}

// GET Handler: Fetches a user by UID
export async function GET(req: NextRequest, { params }: UserContext) {
  try {
    const { uid } = params;

    if (!uid) {
      // This case should ideally be caught by Next.js routing if the path is /api/users/
      // but good to have a check if uid somehow is undefined.
      return NextResponse.json({ error: 'UID parameter is missing' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: userDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`Error fetching user ${params.uid}:`, error);
    // It's good practice to avoid sending back raw error messages to the client in production
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT Handler: Updates a user by UID
export async function PUT(req: NextRequest, { params }: UserContext) {
  try {
    const { uid } = params;
    const body = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID parameter is missing' }, { status: 400 });
    }

    // Validate that body is not empty
    if (Object.keys(body).length === 0) {
        return NextResponse.json({ error: 'Request body cannot be empty' }, { status: 400 });
    }

    // Prevent UID from being updated
    if (body.uid) {
        return NextResponse.json({ error: 'UID cannot be updated' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Perform a merge update. For nested objects like 'membership',
    // Firestore's set with merge: true handles partial updates correctly.
    // If specific fields within membership need finer control,
    // you might need to read the document first and merge manually or use FieldValue.update.
    // However, for most cases, { merge: true } is sufficient.
    await userRef.set(body, { merge: true });

    // Fetch the updated document to return it
    const updatedDoc = await userRef.get();

    return NextResponse.json({ message: 'User updated successfully', data: updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`Error updating user ${params.uid}:`, error);
    if (error.name === 'SyntaxError') { // JSON parsing error
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
