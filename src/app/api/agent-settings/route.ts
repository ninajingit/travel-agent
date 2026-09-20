import { NextResponse } from "next/server";
import { signedInUser } from "@/lib/auth";
import { badRequest, readJsonObject, unauthorized } from "@/lib/api";
import {
  getAgentSettings,
  saveAgentSettings,
  type AgentSettingsInput,
} from "@/db/queries/agent-settings";
import { getEntitlement } from "@/lib/billing/entitlement";

const CHANNELS = ["web", "whatsapp", "imessage"] as const;
type Channel = (typeof CHANNELS)[number];

export async function GET() {
  const user = await signedInUser();
  if (!user) return unauthorized();

  return NextResponse.json(await getAgentSettings(user.id));
}

// PUT replaces the whole settings row; the form always sends every field.
export async function PUT(request: Request) {
  const user = await signedInUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return badRequest("Body must be a JSON object.");

  if (typeof body.autoRebook !== "boolean") {
    return badRequest("autoRebook must be true or false.");
  }
  const perBooking = centsField(body.perBookingCapCents);
  if (perBooking === null) {
    return badRequest("perBookingCapCents must be a whole number of cents, 0 or more.");
  }
  const perTrip = centsField(body.perTripCapCents);
  if (perTrip === null) {
    return badRequest("perTripCapCents must be a whole number of cents, 0 or more.");
  }
  const monthly = centsField(body.monthlyCapCents);
  if (monthly === null) {
    return badRequest("monthlyCapCents must be a whole number of cents, 0 or more.");
  }
  const channels = channelsField(body.allowedChannels);
  if (channels === null) {
    return badRequest(`allowedChannels must be a list drawn from ${CHANNELS.join(", ")}.`);
  }

  // The form disables this toggle without Pro; this is the same rule on the
  // server, for anything that does not come through the form. Flat rather
  // than clever: an earlier version exempted a value that was already true,
  // which meant anyone whose settings started that way could keep asserting
  // it, and the guard never fired.
  if (body.autoRebook) {
    const entitlement = await getEntitlement(user.id);
    if (entitlement.plan !== "pro") {
      return NextResponse.json(
        {
          error:
            "Rebooking without asking is a Pro feature. A Concierge Pass turns it on for one trip.",
        },
        { status: 403 },
      );
    }
  }

  const input: AgentSettingsInput = {
    autoRebook: body.autoRebook,
    perBookingCapCents: perBooking,
    perTripCapCents: perTrip,
    monthlyCapCents: monthly,
    allowedChannels: channels,
  };
  return NextResponse.json(await saveAgentSettings(user.id, input));
}

function centsField(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function channelsField(value: unknown): Channel[] | null {
  if (!Array.isArray(value)) return null;
  const out: Channel[] = [];
  for (const item of value) {
    if (!CHANNELS.includes(item as Channel) || out.includes(item as Channel)) {
      return null;
    }
    out.push(item as Channel);
  }
  return out;
}
