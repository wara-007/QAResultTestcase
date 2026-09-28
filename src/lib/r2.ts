import "server-only";

import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  bucket: string;
  publicBaseUrl: string;
  client: S3Client;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;
  return {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function uploadR2Object(key: string, body: Buffer, contentType: string) {
  const config = getR2Config();
  if (!config) return null;
  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${config.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function downloadR2Object(key: string) {
  const config = getR2Config();
  if (!config) throw new Error("ยังไม่ได้ตั้งค่า Cloudflare R2");
  return config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function deleteR2ObjectsByPrefix(prefix: string) {
  const config = getR2Config();
  if (!config) return null;

  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const listed = await config.client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (listed.Contents ?? []).flatMap(({ Key }) => Key ? [{ Key }] : []);
    if (objects.length) {
      const result = await config.client.send(new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: objects, Quiet: true },
      }));
      if (result.Errors?.length) {
        throw new Error(`ลบรูปจาก Cloudflare R2 ไม่ครบ: ${result.Errors.map((item) => item.Key ?? item.Code ?? "unknown").join(", ")}`);
      }
      deleted += objects.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}
