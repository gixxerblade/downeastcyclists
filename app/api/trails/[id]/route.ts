import { Firestore } from "@google-cloud/firestore";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface TrailUpdateData {
  trail?: string;
  open?: boolean;
  notes?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const cookieStore = cookies();
    const authToken = cookieStore.get("auth-token");

    if (!authToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get the trail ID from the URL params
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Trail ID is required" }, { status: 400 });
    }

    // Parse the request body
    const trailData: TrailUpdateData = await request.json();

    // Initialize Firestore with credentials from environment variables - match the Netlify function implementation
    const db = new Firestore({
      projectId: process.env.GOOGLE_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
      },
    });

    // Reference to the trail document
    const trailRef = db.collection("trails").doc(id);

    // Update the trail document
    // Convert to a plain object to avoid TypeScript issues with Firestore
    await trailRef.update(trailData as { [key: string]: any });

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating trail:", error);
    return NextResponse.json(
      {
        error: "Failed to update trail",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
