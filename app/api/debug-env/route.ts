import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const missingRequiredEnv = process.env.DATABASE_URL ? [] : ['DATABASE_URL'];

  const snapshot = {
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      nextRuntime: process.env.NEXT_RUNTIME ?? null
    },
    envStatus: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL)
    },
    missingRequiredEnv
  };

  console.info('[debug-env] runtime snapshot', snapshot);

  return NextResponse.json(snapshot, { status: 200 });
}
