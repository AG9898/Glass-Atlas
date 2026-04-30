import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ACCESS_KEY_ID, BUCKET, ENDPOINT, REGION, SECRET_ACCESS_KEY } from '$env/static/private';

export const SUPPORTED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/gif',
  'video/mp4',
] as const;

export type SupportedMediaMimeType = (typeof SUPPORTED_MEDIA_MIME_TYPES)[number];

type UploadUrlInput = {
  contentType: string;
  filename?: string;
};

type UploadUrlResult = {
  key: string;
  uploadUrl: string;
  uploadMethod: 'PUT';
  uploadHeaders: {
    'Content-Type': SupportedMediaMimeType;
  };
  imageUrl: string;
  expiresInSeconds: number;
};

const MIME_TO_EXTENSION: Record<SupportedMediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
};

const UPLOAD_URL_TTL_SECONDS = 300;
const ACCESS_URL_TTL_SECONDS = 300;

let s3Client: S3Client | null = null;

function getBucketClient(): S3Client {
  if (s3Client) return s3Client;

  if (!BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error('Bucket credentials are not configured.');
  }

  s3Client = new S3Client({
    region: REGION || 'auto',
    endpoint: ENDPOINT || 'https://storage.railway.app',
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

function normalizeMimeType(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isSupportedMediaMimeType(value: string): value is SupportedMediaMimeType {
  return SUPPORTED_MEDIA_MIME_TYPES.includes(normalizeMimeType(value) as SupportedMediaMimeType);
}

export function createMediaAccessPath(key: string): string {
  return `/api/admin/media/access-url?key=${encodeURIComponent(key)}`;
}

function extensionForMimeType(value: SupportedMediaMimeType): string {
  return MIME_TO_EXTENSION[value];
}

function createObjectKey(contentType: SupportedMediaMimeType, filename?: string): string {
  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10);
  const ext = extensionForMimeType(contentType);
  const id = randomUUID();

  const normalizedFilename = (filename ?? '').trim().toLowerCase();
  const baseName = normalizedFilename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const fileStem = baseName ? `${baseName}-${id}` : id;
  return `notes/${datePrefix}/${fileStem}.${ext}`;
}

export function isValidObjectKey(key: string): boolean {
  if (key.length === 0 || key.length > 512) return false;
  if (key.includes('..') || key.includes('\\')) return false;
  return /^[a-z0-9/_\-.]+$/.test(key);
}

export async function createPresignedUploadUrl(input: UploadUrlInput): Promise<UploadUrlResult> {
  const contentType = normalizeMimeType(input.contentType);

  if (!isSupportedMediaMimeType(contentType)) {
    throw new Error(`Unsupported media type: ${input.contentType}`);
  }

  const key = createObjectKey(contentType, input.filename);
  const client = getBucketClient();

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  return {
    key,
    uploadUrl,
    uploadMethod: 'PUT',
    uploadHeaders: {
      'Content-Type': contentType,
    },
    imageUrl: createMediaAccessPath(key),
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

export async function createPresignedAccessUrl(key: string): Promise<string> {
  if (!isValidObjectKey(key)) {
    throw new Error('Invalid object key.');
  }

  const client = getBucketClient();

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: ACCESS_URL_TTL_SECONDS });
}
