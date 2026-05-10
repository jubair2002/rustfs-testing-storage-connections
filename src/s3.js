import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let _client;

export function getS3Client() {
  if (_client) return _client;
  const endpoint = requireEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION || "us-east-1";
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || "true") === "true";

  _client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
}

export function getBucket() {
  return requireEnv("S3_BUCKET");
}

export async function ensureBucketReachable() {
  const client = getS3Client();
  const Bucket = getBucket();
  await client.send(new HeadBucketCommand({ Bucket }));
}

export function userPrefix(userId) {
  return `users/${userId}/`;
}

export function sanitizeRelativeKey(rel) {
  if (!rel || typeof rel !== "string") return "unnamed";
  const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = norm.split("/").filter((p) => p && p !== "." && p !== "..");
  if (parts.length === 0) return "unnamed";
  return parts.join("/");
}

export async function putObject(key, body, contentType) {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
}

export async function listUserObjects(userId) {
  const client = getS3Client();
  const Prefix = userPrefix(userId);
  const out = [];
  let ContinuationToken;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix,
        ContinuationToken,
      })
    );
    for (const o of res.Contents || []) {
      if (o.Key && !o.Key.endsWith("/")) out.push({ key: o.Key, size: o.Size, lastModified: o.LastModified });
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export async function deleteObjectKey(key) {
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
