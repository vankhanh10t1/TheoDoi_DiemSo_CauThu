import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let cachedDocumentClient: DynamoDBDocumentClient | undefined;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getTableName(): string {
  return getRequiredEnv('DYNAMODB_TABLE_NAME');
}

export function getAwsRegion(): string {
  return getRequiredEnv('AWS_REGION');
}

export function getDocumentClient(): DynamoDBDocumentClient {
  if (!cachedDocumentClient) {
    cachedDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: getAwsRegion(),
        credentials: {
          accessKeyId: getRequiredEnv('AWS_ACCESS_KEY_ID'),
          secretAccessKey: getRequiredEnv('AWS_SECRET_ACCESS_KEY')
        }
      }),
      {
        marshallOptions: {
          removeUndefinedValues: true
        }
      }
    );
  }

  return cachedDocumentClient;
}

export function formatMatchTimestamp(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

export function createMatchSortKey(date = new Date()): string {
  return `MATCH#${formatMatchTimestamp(date)}`;
}