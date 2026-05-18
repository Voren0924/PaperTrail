import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";

export type OwnedRecord = {
  userId: string;
};

export type OwnershipFailureMode = "forbidden" | "notFound";

export function ensureOwnedRecord<TRecord extends OwnedRecord>(
  record: TRecord | null | undefined,
  currentUserId: string,
  options: {
    resourceName?: string;
    failureMode?: OwnershipFailureMode;
  } = {}
): TRecord {
  const resourceName = options.resourceName ?? "Resource";
  const failureMode = options.failureMode ?? "notFound";

  if (!record) {
    throw new NotFoundError(`${resourceName} not found.`);
  }

  if (record.userId !== currentUserId) {
    if (failureMode === "forbidden") {
      throw new ForbiddenError(`You do not have permission to access this ${resourceName.toLowerCase()}.`);
    }

    throw new NotFoundError(`${resourceName} not found.`);
  }

  return record;
}
