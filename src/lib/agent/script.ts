// The scripted agent. It is not intelligent: it recognises a handful of
// intents from the person's words and the shape of the conversation so far,
// and answers with canned text in the agent's voice. Good enough to read
// convincingly for a couple of minutes, which is what Stage 1 needs.

export type Intent =
  | "plan"
  | "book"
  | "standby"
  | "change"
  | "confirm"
  | "delay"
  | "inspire"
  | "unknown";

export type Turn = { role: "user" | "agent"; body: string };

// When the agent acts on money, the reply carries what it did so the caller
// can record it. Standby listings are free and carry nothing.
export type AgentAction = {
  kind: "booking" | "rebooking";
  amountCents: number;
  description: string;
};

export type Reply = { intent: Intent; body: string; action?: AgentAction };

const YES = /^(yes|yep|yeah|ok|okay|sure|do it|book it|go ahead|confirm(ed)?|please do)\b/i;

export function detectIntent(message: string, history: Turn[]): Intent {
  const text = message.trim().toLowerCase();
  const lastAgent = [...history].reverse().find((t) => t.role === "agent");

  // A short "yes" right after an offer is a confirmation of that offer.
  if (YES.test(text) && lastAgent && /want me to book|say yes/i.test(lastAgent.body)) {
    return "confirm";
  }
  if (/\b(standby|earlier flight|earlier flights|get home earlier|earlier)\b/.test(text)) {
    return "standby";
  }
  if (/\b(day later|come home later|extend|change my flight|change my flights|stay longer|one more night)\b/.test(text)) {
    return "change";
  }
  if (/\b(delay|delayed|late|cancel|cancelled|gate|on time|status|rebook)\b/.test(text)) {
    return "delay";
  }
  if (/\b(book|flight|flights|hold|reserve|seat|fare)\b/.test(text)) {
    return "book";
  }
  if (/\b(plan|weekend|trip|ideas|where should|options|under \$|budget)\b/.test(text)) {
    return "plan";
  }
  if (/\b(do|see|eat|restaurant|neighbou?rhood|explore|visit|worth|tonight|tomorrow|rain)\b/.test(text)) {
    return "inspire";
  }
  return "unknown";
}

export function reply(message: string, history: Turn[]): Reply {
  const intent = detectIntent(message, history);
  const result = SCRIPT[intent](message, history);
  return typeof result === "string" ? { intent, body: result } : { intent, ...result };
}

type ScriptResult = string | { body: string; action: AgentAction };

const SCRIPT: Record<Intent, (message: string, history: Turn[]) => ScriptResult> = {
  plan: () =>
    [
      "Three ways to do it, assuming two people out of Newark:",
      "",
      "1. Lisbon, seven nights, Oct 14 to 21. Nonstop on TAP, about $684 each round trip today. Your saved notes say TAP nonstop, so this is the one I would hold.",
      "2. Mexico City, five nights. Nonstop on United, about $410 each. Cheaper, closer, and the food is the point.",
      "3. Tokyo, ten nights in late March for the blossoms. About $1,240 each, and fares for March usually drop once more in December.",
      "",
      "Say which one and I will hold flights for 24 hours at no cost while you decide.",
    ].join("\n"),

  book: () =>
    [
      "TAP TP 202, Newark to Lisbon, Oct 14 at 22:55, landing 10:35. Back on TP 201, Oct 21 at 13:10. Two seats, $684 each, $1,368 total. Refundable for $92 more each.",
      "",
      "That is under your per-booking cap, so I can do it without a second check. Want me to book it? Say yes and it is done.",
    ].join("\n"),

  standby: () =>
    [
      "Two earlier options home from Tokyo on Sep 25, both nonstop to Chicago:",
      "",
      "- NH 12 at 06:35, landing 04:20 the same morning local time. Standby is free on your fare; you would know by 05:30 at the gate, and the flight is showing 9 open seats.",
      "- JL 10 at 11:05, landing 08:55. A confirmed seat, not standby, is $180 as a same-day change.",
      "",
      "Nothing is changed yet. Want me to list you for standby on NH 12? Say yes and you keep your NH 10 seat as the fallback.",
    ].join("\n"),

  change: () =>
    [
      "To come home Sep 26 instead of Sep 25:",
      "",
      "- Flight: NH 10 on Sep 26 has seats. Fare difference $142, no change fee on your ticket.",
      "- Hotel: Hotel Niwa has your room for one more night at ¥31,000, about $208. Late checkout on the 26th is included.",
      "",
      "Total about $350. That is under your per-booking cap. Nothing is changed yet. Want me to book it? Say yes and it is done.",
    ].join("\n"),

  confirm: (_message, history) => {
    const offer = [...history].reverse().find((t) => t.role === "agent")?.body ?? "";
    if (/standby/i.test(offer)) {
      return [
        "You are listed for standby on NH 12 at 06:35, priority group 2. Your NH 10 seat stays confirmed as the fallback.",
        "",
        "Be at gate 62 by 05:30. I will message you the moment ANA clears the list, either way.",
      ].join("\n");
    }
    if (/Sep 26/i.test(offer)) {
      return {
        body: [
          "Done. You fly home on NH 10 on Sep 26, same seat class, new confirmation R4TX8L-2. Hotel Niwa is extended to Sep 26 with late checkout.",
          "",
          "$350 to your card on file: $142 fare difference and $208 for the room. It will show in your activity within a minute.",
        ].join("\n"),
        action: {
          kind: "rebooking",
          amountCents: 35_000,
          description: "NH 10 moved to Sep 26 and Hotel Niwa extended one night",
        },
      };
    }
    return {
      body: [
        "Booked. TP 202 out on Oct 14, TP 201 back on Oct 21, two seats, confirmation K3M9PL. $1,368 to your card on file, and it will show in your activity within a minute.",
        "",
        "Seats 14C and 14D on the way out. I will watch the fare; if it drops on a refundable ticket I rebook and tell you.",
      ].join("\n"),
      action: {
        kind: "booking",
        amountCents: 136_800,
        description: "TAP TP 202 and TP 201, Newark to Lisbon, two seats, K3M9PL",
      },
    };
  },

  delay: () =>
    [
      "One thing is off right now: ANA NH 10, your flight home from Tokyo on Sep 25, is showing a 2h40 delay. New departure 10:45, landing 21:30 in Chicago, which misses nothing since you have no connection.",
      "",
      "If it slips past 12:00 I have a seat held on JL 10 at 11:05 as a fallback. You do not need to do anything. I will tell you if it moves again.",
    ].join("\n"),

  inspire: () =>
    [
      "Near Hotel Niwa, tonight or tomorrow:",
      "",
      "- Jimbocho for secondhand books and curry at Bondy. Ten minutes on foot.",
      "- Yanaka at dusk: Yanaka Ginza street, the cemetery walk, the cats. Twenty minutes by train.",
      "- Kagurazaka for dinner. Old geisha district, small French and Japanese places up the hill. Book anything with under ten seats.",
      "",
      "Say one and I will book a table or put it in your trip.",
    ].join("\n"),

  unknown: () =>
    [
      "I can help with three things: planning a trip, booking a flight or a room, or something happening on a trip right now, like getting home earlier or later.",
      "",
      'Try "plan a long weekend under $3,000", "book the Lisbon flights", or "are there earlier flights I can get on standby?"',
    ].join("\n"),
};

// What the agent says when it is not allowed to act. The words live here with
// the rest of the agent's voice; the decision is made by the caller, which is
// the only side that can see the database.

/**
 * Descriptions are written for the activity log, after the fact, so they end
 * with a confirmation code. Nothing has been booked here, so quoting one
 * would be a lie dressed up as a detail.
 */
function withoutConfirmation(description: string) {
  return description.replace(/,\s*[A-Z0-9][A-Z0-9-]{4,}$/, "");
}

/** Free asked to book: hand over the details and say what Plus would do. */
export function actionNeedsMembership(action: AgentAction): string {
  const money = `$${(action.amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return [
    "I cannot book on the free plan, so here is exactly what to book, and you can do it in a couple of minutes:",
    "",
    `${withoutConfirmation(action.description)}, ${money}.`,
    "",
    "Compare the same itinerary here: https://www.google.com/travel/flights",
    "",
    "Nothing is held and fares move, so sooner is better.",
    "",
    "If you would rather I did it, Plus is $29 a month. I book it, watch it, and move you when it slips. The Pricing page in your account menu has the button.",
  ].join("\n");
}

/** A member who has spent the period's actions. Say the count and the date. */
export function actionsSpent(options: {
  used: number;
  allowed: number;
  resetsOn: string;
  plan: "plus" | "pro";
}): string {
  const { used, allowed, resetsOn, plan } = options;
  const more =
    plan === "plus"
      ? "Pro includes fifty a month, or a Concierge Pass covers one trip outright and its actions never count."
      : "A Concierge Pass covers one trip outright, and its actions never count against this.";
  return [
    `That would be action ${used + 1} this period, and your plan includes ${allowed}. So I have stopped rather than run you past it.`,
    "",
    `The count resets on ${resetsOn}.`,
    "",
    `I can still plan, watch your trips, and answer anything. ${more}`,
  ].join("\n");
}
