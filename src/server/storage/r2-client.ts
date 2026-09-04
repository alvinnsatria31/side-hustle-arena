import { getStorageClient } from "./storage-client";

/** @deprecated Use storage-client.ts / getStorageClient instead. */
export function getR2Client() {
  return getStorageClient();
}
