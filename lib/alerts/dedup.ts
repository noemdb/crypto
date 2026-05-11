import { prisma } from "@/lib/db/prisma";

export async function isAlertDuplicate(
  route: string,
  recipient: string,
  dedupeWindowMin: number,
): Promise<boolean> {
  const since = new Date(Date.now() - dedupeWindowMin * 60_000);

  const existing = await prisma.alert.findFirst({
    where: {
      recipient,
      status: "sent",
      sentAt: { gte: since },
      opportunity: { route },
    },
  });

  return existing !== null;
}

export async function recordAlert(
  opportunityId: string,
  channel: string,
  recipient: string,
  status: "sent" | "failed" | "deduped",
): Promise<void> {
  await prisma.alert.create({
    data: { opportunityId, channel, recipient, status },
  });
}
