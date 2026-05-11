import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const requiredEnvNames = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'DYNAMODB_TABLE_NAME',
    'DYNAMODB_TABLE'
  ] as const;

  const missingRequiredEnv = requiredEnvNames.filter((name) => !process.env[name]);

  const snapshot = {
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      nextRuntime: process.env.NEXT_RUNTIME ?? null
    },
    envStatus: {
      AWS_ACCESS_KEY_ID: Boolean(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      AWS_REGION: Boolean(process.env.AWS_REGION),
      DYNAMODB_TABLE_NAME: Boolean(process.env.DYNAMODB_TABLE_NAME),
      DYNAMODB_TABLE: Boolean(process.env.DYNAMODB_TABLE)
    },
    missingRequiredEnv,
    tableValues: {
      DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME ?? null,
      DYNAMODB_TABLE: process.env.DYNAMODB_TABLE ?? null
    }
  };

  console.info('[debug-env] runtime snapshot', snapshot);

  return NextResponse.json(snapshot, { status: 200 });
}
