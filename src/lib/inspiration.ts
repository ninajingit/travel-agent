// What is worth knowing about a place, for the "Coming up" cards on the home
// page. Static for Stage 1: the agent would generate this from live sources.
// Copy follows PERSONA.md: specific, short, no hype.

export type Idea = { title: string; detail: string };

export type Inspiration = {
  events: Idea[];
  places: Idea[];
  thingsToDo: Idea[];
};

const BY_DESTINATION: Record<string, Inspiration> = {
  Lisbon: {
    events: [
      { title: "Lisbon Film Festival", detail: "Oct 15 to 25 at Cinema São Jorge. Tickets on the day are fine for weekday screenings." },
      { title: "Feira da Ladra", detail: "Flea market at Campo de Santa Clara, Tuesdays and Saturdays from 9. Go before 11." },
      { title: "Fado at Tasca do Chico", detail: "Most nights from 20:00 in Bairro Alto. No booking, small, arrive early." },
    ],
    places: [
      { title: "Alfama at 7am", detail: "The neighbourhood your hotel is in, before the tour groups. Coffee at Pois Café." },
      { title: "LX Factory", detail: "Industrial site under the bridge turned shops and studios. Sunday market." },
      { title: "Marvila", detail: "Former warehouses, now the breweries and galleries. Twenty minutes east by bus 728." },
    ],
    thingsToDo: [
      { title: "Sintra day trip", detail: "Early train from Rossio, Pena Palace at opening, back by 18:00. Nomi can book the palace tickets." },
      { title: "Tram 28, from the wrong end", detail: "Board at Martim Moniz at 8am, sit on the right, ride to Campo de Ourique." },
      { title: "Swim at Costa da Caparica", detail: "Bus from Areeiro, 35 minutes. Still warm in October on a clear day." },
    ],
  },
  Tokyo: {
    events: [
      { title: "Fukuro Matsuri", detail: "Ikebukuro street festival with mikoshi parades, Sep 26 to 27. Free." },
      { title: "Sumo autumn tournament", detail: "Ryogoku Kokugikan through Sep 27. Same-day upper-deck tickets from 8am." },
      { title: "Tokyo Game Show", detail: "Makuhari Messe, Sep 24 to 27. Public days are the 26th and 27th." },
    ],
    places: [
      { title: "Yanaka", detail: "Old temple district that survived the war. Yanaka Ginza street at dusk, the cemetery walk, cats." },
      { title: "Kiyosumi-Shirakawa", detail: "Coffee roasters and the Museum of Contemporary Art. Quiet on Sunday morning." },
      { title: "Shimokitazawa", detail: "Secondhand clothes, record shops, curry. Weekdays are better." },
    ],
    thingsToDo: [
      { title: "Tsukiji outer market breakfast", detail: "Before 9am. Tamagoyaki on a stick, then coffee at Turret." },
      { title: "teamLab Planets", detail: "Toyosu. Book a slot; mornings are quietest. Wear something you can roll up." },
      { title: "Sento at Kogane-yu", detail: "Renovated bathhouse in Kinshicho with a DJ booth. Tattoos fine." },
    ],
  },
  "Mexico City": {
    events: [
      { title: "Lucha libre at Arena México", detail: "Tuesdays and Fridays. Buy at the box office, not from the street." },
      { title: "Mercado de Jamaica", detail: "Flower market, open all night before major holidays." },
      { title: "Ballet Folklórico", detail: "Palacio de Bellas Artes, Sundays and Wednesdays." },
    ],
    places: [
      { title: "Roma Norte", detail: "Where you will end up anyway. Coffee at Quentin, tacos at Orinoco late." },
      { title: "Coyoacán on a weekday", detail: "The Frida Kahlo house needs a timed ticket; the market does not." },
      { title: "Santa María la Ribera", detail: "The Kiosco Morisco, old cantinas, no tourists yet." },
    ],
    thingsToDo: [
      { title: "Teotihuacán at opening", detail: "Uber before 7am, or the bus from Autobuses del Norte. Back by lunch." },
      { title: "Xochimilco trajinera", detail: "Go on a weekday afternoon with food. Two hours is plenty." },
      { title: "Chapultepec on Sunday", detail: "Museums are free for residents and packed. Go Saturday instead." },
    ],
  },
};

export function inspirationFor(destination: string): Inspiration | null {
  return BY_DESTINATION[destination] ?? null;
}
