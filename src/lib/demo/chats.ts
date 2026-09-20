// Past conversations for the demo account. Written in the agent's voice from
// PERSONA.md: plain, specific, under-promising. Times are fixed so the seed
// is repeatable. `trip` names the seeded trip the thread belongs to, if any.

type Turn = { role: "user" | "agent"; body: string; at: string };

export type ChatSeed = {
  title: string;
  trip: "Lisbon" | "Tokyo" | null;
  turns: Turn[];
};

export const CHATS: ChatSeed[] = [
  {
    title: "Long weekend under $3,000",
    trip: null,
    turns: [
      {
        role: "user",
        at: "2026-08-28T14:02:00Z",
        body: "I have a long weekend coming up, what are some trips I can take that are under 4 hours away and I can do all in for less than $3,000?",
      },
      {
        role: "agent",
        at: "2026-08-28T14:02:41Z",
        body: "Assuming Columbus Day weekend, Oct 9 to 12, two people, out of Newark. Three that fit:\n\n1. Bermuda. 2h05 nonstop. Flights about $520 each, three nights at a mid-range hotel around $1,100. All in roughly $2,400 with food.\n2. Charleston. 2h10 nonstop. Flights about $310 each, three nights downtown around $780. Roughly $1,700.\n3. Montréal. 1h25 nonstop. Flights about $260 each, three nights in the Plateau around $620. Roughly $1,350, and the food is the point.\n\nFares are today's. Say which one and I will hold flights for 24 hours at no cost while you decide.",
      },
      {
        role: "user",
        at: "2026-08-28T14:10:12Z",
        body: "Bermuda sounds good but is the weather ok in October?",
      },
      {
        role: "agent",
        at: "2026-08-28T14:10:33Z",
        body: "Usually. Highs around 78°F, water still warm enough to swim. It is the tail of hurricane season, so there is a small chance of a washout. If you want, I can book the flights as refundable for about $90 more each so a storm does not cost you the trip.",
      },
    ],
  },
  {
    title: "Squeeze Hokkaido into this trip",
    trip: "Tokyo",
    turns: [
      {
        role: "user",
        at: "2026-09-08T02:15:00Z",
        body: "Can we squeeze in a trip to hokkaido on this trip?",
      },
      {
        role: "agent",
        at: "2026-09-08T02:15:38Z",
        body: "Yes, two nights fits without touching your flights home. Haneda to Sapporo is 1h35.\n\nOut Sep 22 at 07:45 (JL 503), back Sep 24 at 18:10 (JL 522). About ¥38,000 round trip today. Hotel Niwa will release Sep 22 and 23 for ¥42,000 back, or you can keep the room and leave your big bag there.\n\nThe Shinkansen day trip on Sep 21 is unaffected. Want me to hold the flights? Holds are free for 24 hours.",
      },
      { role: "user", at: "2026-09-08T02:19:04Z", body: "Hold them. Keep the Tokyo room." },
      {
        role: "agent",
        at: "2026-09-08T02:19:20Z",
        body: "Held. Two seats on JL 503 and JL 522, hold reference 7QXK2M, expires Sep 9 at 14:00 JST. I will remind you two hours before it lapses.",
      },
    ],
  },
  {
    title: "Tokyo neighbourhoods off the usual list",
    trip: "Tokyo",
    turns: [
      {
        role: "user",
        at: "2026-09-10T22:40:00Z",
        body: "What are some local out of the ordinary neighborhoods I should explore in Tokyo?",
      },
      {
        role: "agent",
        at: "2026-09-10T22:40:44Z",
        body: "Four that are not on the usual list, all reachable from Hotel Niwa in under 40 minutes:\n\n- Yanaka. Old temple district that survived the war. Yanaka Ginza shopping street, the cemetery walk, cats. Go late afternoon.\n- Shimokitazawa. Secondhand clothes, small record shops, curry. Best on a weekday.\n- Kiyosumi-Shirakawa. Coffee roasters and the Museum of Contemporary Art. Quiet on Sunday mornings.\n- Koenji. Punk bars and vintage, a rougher version of Shimokita. Evenings.\n\nI can slot one of these into a free morning if you tell me which day is open.",
      },
    ],
  },
  {
    title: "Visa for Japan",
    trip: "Tokyo",
    turns: [
      { role: "user", at: "2026-09-01T16:05:00Z", body: "Do I need a visa for Japan?" },
      {
        role: "agent",
        at: "2026-09-01T16:05:19Z",
        body: "No. A US passport gets 90 days visa-free for tourism. Your passport needs to be valid for the whole stay; yours is good until 2031.\n\nOne thing to do before you land: fill in Visit Japan Web for immigration and customs. It gives you a QR code that skips the paper forms. Takes about ten minutes. I will send the link the day before you fly.",
      },
    ],
  },
  {
    title: "Lisbon weather and packing",
    trip: "Lisbon",
    turns: [
      {
        role: "user",
        at: "2026-09-14T19:30:00Z",
        body: "What's the weather looking like in Lisbon mid October? What should I pack?",
      },
      {
        role: "agent",
        at: "2026-09-14T19:30:27Z",
        body: "Mid-October Lisbon runs 64 to 75°F, sunny most days, with a couple of short rain showers likely across your week. Evenings by the river get cool.\n\nPack: layers rather than a coat, one light rain shell, and shoes with grip. The pavements are polished limestone and slippery when wet. Leave the umbrella; the wind eats them.",
      },
    ],
  },
  {
    title: "Aisle seat on the Lisbon flights",
    trip: "Lisbon",
    turns: [
      { role: "user", at: "2026-09-15T13:12:00Z", body: "Can you get me an aisle seat on the Lisbon flight?" },
      {
        role: "agent",
        at: "2026-09-15T13:12:35Z",
        body: "Done on the way out: 14C on TP 202, aisle, no charge on your fare. On the way back TP 201 has 12D free. Want that too?",
      },
      { role: "user", at: "2026-09-15T13:14:02Z", body: "yes" },
      {
        role: "agent",
        at: "2026-09-15T13:14:11Z",
        body: "Confirmed, 12D on TP 201. Both seats are on booking H7K2QF and your boarding passes will show them when they are issued.",
      },
    ],
  },
  {
    title: "Gate change for NH 9",
    trip: "Tokyo",
    turns: [
      {
        role: "agent",
        at: "2026-09-17T20:48:00Z",
        body: "Gate change. NH 9 now boards from gate 101, not 96. Boarding starts 16:25 local, about a ten-minute walk from the lounge. Departure time has not moved.",
      },
      { role: "user", at: "2026-09-17T20:51:30Z", body: "thanks. is it still on time?" },
      {
        role: "agent",
        at: "2026-09-17T20:51:41Z",
        body: "Yes. Aircraft is at the gate and inbound crew is on time. I will tell you if that changes.",
      },
    ],
  },
  {
    title: "Bag did not arrive at Haneda",
    trip: "Tokyo",
    turns: [
      { role: "user", at: "2026-09-18T11:52:00Z", body: "My bag didn't come out at Haneda" },
      {
        role: "agent",
        at: "2026-09-18T11:52:48Z",
        body: "Sorry. I filed the report with ANA: reference NH-HND-88213, tag 0205 614 337. ANA's system shows the bag was loaded on the later NH 105, landing 14:40. They will deliver it to Hotel Niwa tonight, before 21:00.\n\nANA covers up to ¥10,000 of essentials tonight. Keep receipts and I will file the claim. Go to the hotel; there is nothing more to do at the airport.",
      },
      { role: "user", at: "2026-09-18T13:05:10Z", body: "ok. let me know when it's on the way" },
      {
        role: "agent",
        at: "2026-09-18T18:20:00Z",
        body: "Your bag is with the courier, due at the hotel between 19:30 and 20:30. The front desk knows to hold it under your name.",
      },
    ],
  },
  {
    title: "Dinner near the hotel tonight",
    trip: "Tokyo",
    turns: [
      {
        role: "user",
        at: "2026-09-19T08:10:00Z",
        body: "Find me a restaurant near the hotel tonight, nothing fancy, we're 3 people",
      },
      {
        role: "agent",
        at: "2026-09-19T08:10:36Z",
        body: "Two within a ten-minute walk of Hotel Niwa:\n\n- Bondy, Jimbocho. European-style Japanese curry, the reason people go to Jimbocho. No reservations; the line moves fast. About ¥1,800 a head.\n- Isomaru Suisan, Suidobashi. Grill-your-own seafood izakaya, loud, open late. Takes bookings. About ¥3,500 a head with drinks.\n\nSay which and a time and I will book the izakaya or tell you when the curry line is shortest.",
      },
      { role: "user", at: "2026-09-19T08:12:50Z", body: "izakaya at 7:30" },
      {
        role: "agent",
        at: "2026-09-19T08:13:20Z",
        body: "Booked. Isomaru Suisan Suidobashi, 19:30, three people, under your name. Show the confirmation on your phone; it is in your trip.",
      },
    ],
  },
  {
    title: "Rain tomorrow, what instead of the garden",
    trip: "Tokyo",
    turns: [
      {
        role: "user",
        at: "2026-09-19T12:30:00Z",
        body: "It's raining tomorrow in Tokyo, what should I do instead of the garden?",
      },
      {
        role: "agent",
        at: "2026-09-19T12:30:41Z",
        body: "Rain is forecast from about 10:00 to 17:00 tomorrow. Three indoor options, and Rikugien moves to Thursday morning when it is clear:\n\n- teamLab Planets, Toyosu. Book a slot; 11:00 has space. About 90 minutes.\n- Kappabashi kitchen street. Covered arcades, knives and ceramics. Good for two hours.\n- Nezu Museum. Small, calm, and the garden is fine in light rain under the trees.\n\nI have not booked anything. Say the word and I will grab the teamLab slot.",
      },
    ],
  },
  {
    title: "Extend Lisbon by two days",
    trip: "Lisbon",
    turns: [
      { role: "user", at: "2026-09-16T21:04:00Z", body: "Can I extend the Lisbon trip by two days?" },
      {
        role: "agent",
        at: "2026-09-16T21:04:39Z",
        body: "Yes. Moving TP 201 from Oct 21 to Oct 23 costs $84 in fare difference and no change fee on your ticket. Memmo Alfama has your room for the two extra nights at €310 a night. Total about $766.\n\nNothing is booked. Want me to do it?",
      },
      { role: "user", at: "2026-09-16T21:08:15Z", body: "not yet, need to check work" },
      {
        role: "agent",
        at: "2026-09-16T21:08:24Z",
        body: "OK. The fare difference tends to hold until about two weeks out. I will tell you if it moves more than $50.",
      },
    ],
  },
  {
    title: "Day trip from Lisbon",
    trip: "Lisbon",
    turns: [
      { role: "user", at: "2026-09-18T01:15:00Z", body: "Plan a day trip from Lisbon for one of the days" },
      {
        role: "agent",
        at: "2026-09-18T01:15:52Z",
        body: "Sintra, on Oct 17, a Saturday, which is the busiest day, so the plan is to be early.\n\n08:11 train from Rossio, 40 minutes, about €5 return, no booking needed. Pena Palace ticket for the 09:30 entry so you are inside before the coaches arrive. Bus 434 up, walk down through the park to the town for lunch. Quinta da Regaleira mid-afternoon. Back in Lisbon by 18:00.\n\nI can buy the Pena tickets now; they sell out for Saturdays. About €20 each.",
      },
    ],
  },
];
