import { ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as Minio from 'minio';
import { Kind, LIMITS, objectKey, ownsKey, validateUpload } from './rules';
const TTL = 300;
@Injectable()
export class MediaService implements OnModuleInit {
  private log = new Logger('Media');
  private bucket = process.env.MINIO_BUCKET ?? 'socialpulse-media';
  private publicUrl = (process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000').replace(/\/$/, '');
  private base = { accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin', secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin', region: 'us-east-1' };
  /** internal client: bucket setup + deletes over the docker network */
  private admin = new Minio.Client({ ...this.base, endPoint: process.env.MINIO_ENDPOINT ?? 'localhost', port: +(process.env.MINIO_PORT ?? 9000), useSSL: process.env.MINIO_USE_SSL === 'true' });
  /** signer: built against the browser-facing host so presigned policies are valid there (region fixed => no network call) */
  private signer = (() => { const u = new URL(this.publicUrl); return new Minio.Client({ ...this.base, endPoint: u.hostname, port: +(u.port || (u.protocol === 'https:' ? 443 : 80)), useSSL: u.protocol === 'https:' }); })();

  async onModuleInit() {
    for (let i = 0; i < 10; i++) {
      try {
        if (!(await this.admin.bucketExists(this.bucket))) await this.admin.makeBucket(this.bucket, this.base.region);
        // public read for objects only (uploads/deletes still need signed access)
        await this.admin.setBucketPolicy(this.bucket, JSON.stringify({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${this.bucket}/*`] }] }));
        return;
      } catch (e: any) { this.log.warn(`minio not ready (${e.message}); retry ${i + 1}`); await new Promise((r) => setTimeout(r, 2000)); }
    }
  }

  /** Presigned POST policy: MinIO itself enforces content-type and the size range, so limits can't be bypassed client-side. */
  async presign(userId: string, kind: Kind, contentType: string, size: number) {
    const ext = validateUpload(kind, contentType, size);
    const key = objectKey(kind, userId, randomUUID(), ext);
    const policy = new Minio.PostPolicy();
    policy.setBucket(this.bucket); policy.setKey(key); policy.setContentType(contentType);
    policy.setContentLengthRange(1, LIMITS[kind].maxBytes); policy.setExpires(new Date(Date.now() + TTL * 1000));
    const { postURL, formData } = await this.signer.presignedPostPolicy(policy);
    return { key, uploadUrl: postURL, fields: formData, method: 'POST', expiresIn: TTL, publicUrl: `${this.publicUrl}/${this.bucket}/${key}` };
  }
  async remove(userId: string, key: string) {
    if (!ownsKey(key, userId)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your file' });
    await this.admin.removeObject(this.bucket, key); return { key, deleted: true };
  }
}
