import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT!,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!
  },
  forcePathStyle: true
})

export const MINIO_BUCKET = process.env.MINIO_BUCKET!

export const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL!
