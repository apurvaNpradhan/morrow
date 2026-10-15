import {
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  type S3Client,
} from "@aws-sdk/client-s3";

const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000];

type StorageErrorShape = {
  name?: unknown;
  code?: unknown;
  Code?: unknown;
  cause?: { code?: unknown };
  $metadata?: { httpStatusCode?: unknown };
  $response?: { statusCode?: unknown };
};

function storageStatus(error: unknown) {
  return error instanceof Error && "$metadata" in error
    ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
    : undefined;
}

export function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      storageStatus(error) === 404)
  );
}

/** Name, status and code only: provider messages can carry endpoints or signed URLs. */
export function describeStorageError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }
  const shape = error as StorageErrorShape;
  const status = shape.$metadata?.httpStatusCode ?? shape.$response?.statusCode;
  const code = shape.Code ?? shape.code ?? shape.cause?.code;
  return {
    name: typeof shape.name === "string" ? shape.name : "Error",
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof code === "string" ? { code } : {}),
  };
}

/**
 * Some S3-compatible stores (SeaweedFS) answer HEAD with 403 for a moment after
 * a presigned PUT. Retry on 403 only so a missing object still fails at once.
 */
export async function headUploadedObject(
  client: Pick<S3Client, "send">,
  bucket: string,
  key: string,
  abortSignal: AbortSignal,
): Promise<HeadObjectCommandOutput> {
  const head = () =>
    client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal,
    });
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await head();
    } catch (error) {
      if (storageStatus(error) !== 403 || abortSignal.aborted) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return head();
}
