// app/api/maintenance/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  });
}

export async function POST(request: Request) {
  // Add authentication check here
  // if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // In a real app, you would store this in a database
  // For demo, we'll just return the env value

  console.log(request);

  return NextResponse.json({
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
    message: "Use .env file to change maintenance mode",
  });
}
