import { type StorageConnection } from "@/lib/storage/clientConfig"

// The test stack's object store (`storage_test` in docker-compose.test.yml) with the throwaway
// credentials it starts with.
export const BUNDLED_STORE_CONNECTION: StorageConnection = {
  endpoint: "http://localhost:9020",
  region: "us-east-1",
  accessKeyId: "remit-test",
  secretAccessKey: "remit-test-secret",
  forcePathStyle: true
}
