import type { PrismaClient } from "@papertrail/db";

export const LOCAL_USER_ID = "local";
export const LOCAL_USER_EMAIL = "local@papertrail.local";

export async function ensureLocalUser(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: {
      id: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      name: "Local user"
    }
  });
}
