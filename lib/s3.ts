import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
  type S3ServiceException
} from "@aws-sdk/client-s3"

import { env } from "@/lib/env"

export const s3 = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

export const MINIO_BUCKET = env.MINIO_BUCKET

export const MINIO_PUBLIC_URL = env.MINIO_PUBLIC_URL

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))

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
