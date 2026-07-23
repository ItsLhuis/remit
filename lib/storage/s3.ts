import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
  type S3ServiceException
} from "@aws-sdk/client-s3"

import { env } from "@/lib/config/env"

const s3 = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

// A second client on the browser-reachable URL, not a duplicate to be collapsed into `s3` above:
// a presigned URL's signature covers its host, so one signed against the internal MINIO_ENDPOINT
// is rejected when the browser replays it against the public origin. Server-side calls use `s3`;
// anything handed to a client must be signed with this one.
export const s3UploadPresigner = new S3Client({
  endpoint: env.MINIO_PUBLIC_URL,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

export const MINIO_BUCKET = env.MINIO_BUCKET

export async function deleteStorageObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }))
}

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))

    // Anonymous `s3:GetObject` on the whole bucket: every stored object is readable by anyone who
    // knows its key, so keys are the only thing standing between an upload and the public. Nothing
    // secret may be stored here under a guessable key, and access control for uploads has to be
    // enforced by key unguessability rather than by this bucket.
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: MINIO_BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${MINIO_BUCKET}/*`
            }
          ]
        })
      })
    )
  }
}
