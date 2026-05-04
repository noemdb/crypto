import { Receiver } from "@upstash/qstash";

let receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });
  }
  return receiver;
}

export async function verifyQStashSignature(
  request: Request,
): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await request.text();
    await getReceiver().verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}
