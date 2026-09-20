import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import {
  badRequest,
  notFound,
  readJsonObject,
  requiredText,
  unauthorized,
} from "@/lib/api";
import { getChannel, WebChannel } from "@/lib/channels";
import { actionNeedsMembership, actionsSpent, reply } from "@/lib/agent/script";
import { getEntitlement, refuseAction } from "@/lib/billing/entitlement";
import { recordTransaction } from "@/lib/agent/transactions";
import {
  appendMessage,
  createConversation,
  getConversation,
} from "@/db/queries/conversations";
import { getTrip } from "@/db/queries/trips";

// One turn of chat: store the person's message, work out the agent's reply,
// deliver it over the web channel, store that too. A missing conversationId
// starts a new thread titled after the first message.
export async function POST(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return badRequest("Body must be a JSON object.");

  const message = requiredText(body.message, "message", 2000);
  if (!message.ok) return badRequest(message.error);

  let conversation;
  if (body.conversationId === undefined || body.conversationId === null) {
    let tripId: number | null = null;
    if (typeof body.tripId === "number") {
      const trip = await getTrip(user.id, body.tripId);
      if (!trip) return notFound();
      tripId = trip.id;
    }
    conversation = {
      ...(await createConversation(user.id, titleFrom(message.value), tripId)),
      messages: [],
    };
  } else {
    if (typeof body.conversationId !== "number") {
      return badRequest("conversationId must be a number.");
    }
    conversation = await getConversation(user.id, body.conversationId);
    if (!conversation) return notFound();
  }

  const userMessage = await appendMessage(conversation.id, "user", message.value);

  const agent = reply(
    message.value,
    conversation.messages.map((m) => ({ role: m.role, body: m.body })),
  );

  // The agent decided to spend money. Whether it is allowed to is a question
  // about the account, which the script cannot see, so it is answered here.
  // A refusal replaces the reply rather than appending to it: being told
  // "booked" and "not booked" in one breath is worse than either.
  let replyBody = agent.body;
  let action = agent.action;
  if (action) {
    const entitlement = await getEntitlement(user.id);
    const refusal = refuseAction(entitlement, conversation.tripId ?? null);
    if (refusal) {
      replyBody =
        refusal.reason === "plan"
          ? actionNeedsMembership(action)
          : actionsSpent({
              used: entitlement.actionsUsed,
              allowed: entitlement.actionsAllowed,
              resetsOn: entitlement.periodEnd.toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
              plan: entitlement.plan === "pro" ? "pro" : "plus",
            });
      action = undefined;
    }
  }

  // Through the channel abstraction, even though for web the round trip is
  // this same HTTP response.
  const web = getChannel("web") as WebChannel;
  await web.send({ userId: user.id, body: replyBody });
  const delivered = web.drain(user.id);
  const agentMessages = [];
  for (const out of delivered) {
    agentMessages.push(await appendMessage(conversation.id, "agent", out.body));
  }

  // The agent acted on money: write the record at the moment it happened.
  if (action) {
    await recordTransaction(user.id, {
      tripId: conversation.tripId ?? null,
      ...action,
    });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    messages: [userMessage, ...agentMessages],
  });
}

function titleFrom(message: string) {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57).trimEnd()}…` : oneLine;
}
