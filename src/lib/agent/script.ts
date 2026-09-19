// The scripted agent. It is not intelligent: it recognises a handful of
// intents from the person's words and the shape of the conversation so far,
// and answers with canned text in the agent's voice. Good enough to read
// convincingly for a couple of minutes, which is what Stage 1 needs.

export type Intent = "plan" | "book" | "confirm" | "delay" | "inspire" | "unknown";

export type Turn = { role: "user" | "agent"; body: string };

export type Reply = { intent: Intent; body: string };

const YES = /^(yes|yep|yeah|ok|okay|sure|do it|book it|go ahead|confirm(ed)?|please do)\b/i;

export function detectIntent(message: string, history: Turn[]): Intent {
  const text = message.trim().toLowerCase();
  const lastAgent = [...history].reverse().find((t) => t.role === "agent");

  // A short "yes" right after an offer is a confirmation of that offer.
  if (YES.test(text) && lastAgent && /want me to book|say yes/i.test(lastAgent.body)) {
    return "confirm";
  }
  if (/\b(delay|delayed|late|cancel|cancelled|gate|on time|status|rebook)\b/.test(text)) {
    return "delay";
  }
  if (/\b(book|flight|flights|hold|reserve|hotel|seat|fare)\b/.test(text)) {
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
  return { intent, body: SCRIPT[intent](message) };
}

const SCRIPT: Record<Intent, (message: string) => string> = {
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

  confirm: () =>
    [
      "Booked. TP 202 out on Oct 14, TP 201 back on Oct 21, two seats, confirmation K3M9PL. $1,368 to your card on file, and it will show in your activity within a minute.",
      "",
      "Seats 14C and 14D on the way out. I will watch the fare; if it drops on a refundable ticket I rebook and tell you.",
    ].join("\n"),

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
      "I can help with three things: planning a trip, booking a flight or a room, or something happening on a trip right now, like a delay.",
      "",
      'Try "plan a long weekend under $3,000", "book the Lisbon flights", or "is my flight delayed?"',
    ].join("\n"),
};
