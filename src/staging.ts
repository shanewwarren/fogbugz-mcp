import { randomUUID } from 'crypto';
import axios from 'axios';
import { AwsClient } from 'aws4fetch';

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Under uploads/ so the bucket's 1-day expire-uploads rule sweeps anything never attached.
export const STAGING_PREFIX = 'uploads/wiki/';
export const UPLOAD_TTL_SECONDS = 1800;

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config | undefined {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return undefined;
  return { accountId: R2_ACCOUNT_ID, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };
}

/**
 * Stages files in R2 so a remote client can hand the MCP server a file without
 * holding any credential: it only ever sees a short-lived presigned PUT URL.
 */
export class R2Staging {
  private client: AwsClient;

  constructor(private config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'auto',
      service: 's3',
    });
  }

  // The original file name rides in the key so the attach step can recover it without server state.
  newKey(fileName: string): string {
    const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'upload';
    return `${STAGING_PREFIX}${randomUUID()}/${safe}`;
  }

  assertStagingKey(key: string): void {
    if (!key.startsWith(STAGING_PREFIX) || key.includes('..')) {
      throw new Error(`uploadId must come from fogbugz_start_wiki_upload (expected "${STAGING_PREFIX}...").`);
    }
  }

  presignPut(key: string, ttlSeconds = UPLOAD_TTL_SECONDS): Promise<string> {
    return this.presign(key, 'PUT', ttlSeconds);
  }

  // Requests go through axios, not fetch: ToolHive only lets the container out via its
  // HTTP(S)_PROXY egress proxy, which Node's built-in fetch ignores (ENETUNREACH).
  async get(key: string): Promise<{ data: Buffer; contentType?: string }> {
    const res = await axios.get(await this.presign(key, 'GET', 300), {
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    if (res.status === 404) throw new Error(`Nothing uploaded at ${key} yet; run the upload command first (links expire after 30 minutes).`);
    if (res.status >= 300) throw new Error(`R2 GET ${key} failed: ${res.status} ${Buffer.from(res.data).toString().slice(0, 300)}`);
    return { data: Buffer.from(res.data), contentType: String(res.headers?.['content-type'] || '') || undefined };
  }

  async delete(key: string): Promise<void> {
    await axios.delete(await this.presign(key, 'DELETE', 300));
  }

  private async presign(key: string, method: 'GET' | 'PUT' | 'DELETE', ttlSeconds: number): Promise<string> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await this.client.sign(new Request(url, { method }), { aws: { signQuery: true } });
    return signed.url;
  }

  private objectUrl(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `https://${this.config.accountId}.r2.cloudflarestorage.com/${this.config.bucket}/${path}`;
  }
}
