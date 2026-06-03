// Rock im Park 2026 – Kompletter Timetable
// Quelle: Offizieller Timetable 2026 (static10.rock-im-park.com)

const FESTIVAL_DATA = {
  name: "Rock im Park 2026",
  dates: "5.–7. Juni 2026",
  location: "Zeppelinfeld, Nürnberg",
  stages: ["Utopia", "Mandora", "Orbit"],
  stageColors: {
    Utopia: "#ff4d00",
    Mandora: "#8b5cf6",
    Orbit: "#06b6d4"
  },
  userColors: [
    "#ff4d00", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981",
    "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#14b8a6"
  ],
  days: [
    {
      id: "friday",
      name: "Freitag",
      date: "5. Juni",
      acts: [
        // === UTOPIA STAGE ===
        { band: "Ecca Vandal", stage: "Utopia", start: "12:45", end: "13:30" },
        { band: "The Pretty Reckless", stage: "Utopia", start: "14:00", end: "15:00" },
        { band: "Tom Morello", stage: "Utopia", start: "15:30", end: "16:30" },
        { band: "Three Days Grace", stage: "Utopia", start: "17:00", end: "18:15" },
        { band: "Electric Callboy", stage: "Utopia", start: "18:55", end: "20:25" },
        { band: "Volbeat", stage: "Utopia", start: "21:10", end: "22:55", headliner: true },

        // === MANDORA STAGE ===
        { band: "Paleface Swiss", stage: "Mandora", start: "14:15", end: "14:50" },
        { band: "Bilmuri", stage: "Mandora", start: "15:10", end: "15:55" },
        { band: "Bury Tomorrow", stage: "Mandora", start: "16:20", end: "17:15" },
        { band: "LANDMVRKS", stage: "Mandora", start: "17:45", end: "18:45" },
        { band: "Ice Nine Kills", stage: "Mandora", start: "19:15", end: "20:25" },
        { band: "Marteria", stage: "Mandora", start: "21:05", end: "22:20" },
        { band: "Bad Omens", stage: "Mandora", start: "23:30", end: "01:00", headliner: true },

        // === ORBIT STAGE ===
        { band: "Max Grimm", stage: "Orbit", start: "13:20", end: "14:00" },
        { band: "Letlive.", stage: "Orbit", start: "14:25", end: "15:05" },
        { band: "Anna Grey", stage: "Orbit", start: "15:30", end: "16:10" },
        { band: "The Subways", stage: "Orbit", start: "16:35", end: "17:15" },
        { band: "Wargasm", stage: "Orbit", start: "17:40", end: "18:20" },
        { band: "Dying Wish", stage: "Orbit", start: "18:45", end: "19:30" },
        { band: "High Vis", stage: "Orbit", start: "19:55", end: "20:40" },
        { band: "Thornhill", stage: "Orbit", start: "21:05", end: "21:55" },
        { band: "Basement", stage: "Orbit", start: "22:20", end: "23:05" },
        { band: "Palaye Royale", stage: "Orbit", start: "23:30", end: "00:30" },
        { band: "H-Blockx", stage: "Orbit", start: "01:00", end: "02:00" }
      ]
    },
    {
      id: "saturday",
      name: "Samstag",
      date: "6. Juni",
      acts: [
        // === UTOPIA STAGE ===
        { band: "Bad Nerves", stage: "Utopia", start: "12:35", end: "13:20" },
        { band: "Black Veil Brides", stage: "Utopia", start: "13:50", end: "14:45" },
        { band: "Hollywood Undead", stage: "Utopia", start: "15:15", end: "16:15" },
        { band: "Finch", stage: "Utopia", start: "16:45", end: "17:55" },
        { band: "The Offspring", stage: "Utopia", start: "18:40", end: "19:55" },
        { band: "Iron Maiden", stage: "Utopia", start: "20:40", end: "23:00", headliner: true },

        // === MANDORA STAGE ===
        { band: "Return to Dust", stage: "Mandora", start: "13:35", end: "14:05" },
        { band: "Blood Incantation", stage: "Mandora", start: "14:25", end: "15:10" },
        { band: "Bloodywood", stage: "Mandora", start: "15:35", end: "16:20" },
        { band: "Breaking Benjamin", stage: "Mandora", start: "16:45", end: "17:40" },
        { band: "Social Distortion", stage: "Mandora", start: "18:10", end: "19:10" },
        { band: "Alter Bridge", stage: "Mandora", start: "19:40", end: "20:40" },
        { band: "A Perfect Circle", stage: "Mandora", start: "21:20", end: "22:35" },
        { band: "Sabaton", stage: "Mandora", start: "23:20", end: "01:00", headliner: true },

        // === ORBIT STAGE ===
        { band: "Mouth Culture", stage: "Orbit", start: "12:50", end: "13:30" },
        { band: "Ego Kill Talent", stage: "Orbit", start: "13:55", end: "14:35" },
        { band: "Boundaries", stage: "Orbit", start: "15:00", end: "15:40" },
        { band: "Gatecreeper", stage: "Orbit", start: "16:05", end: "16:45" },
        { band: "Catch Your Breath", stage: "Orbit", start: "17:10", end: "17:50" },
        { band: "TesseracT", stage: "Orbit", start: "18:15", end: "19:00" },
        { band: "President", stage: "Orbit", start: "19:25", end: "20:15" },
        { band: "The Story So Far", stage: "Orbit", start: "20:40", end: "21:25" },
        { band: "Set It Off", stage: "Orbit", start: "21:50", end: "22:50" },
        { band: "Kublai Khan TX", stage: "Orbit", start: "23:20", end: "00:20" },
        { band: "Sondaschule", stage: "Orbit", start: "00:50", end: "02:00" }
      ]
    },
    {
      id: "sunday",
      name: "Sonntag",
      date: "7. Juni",
      acts: [
        // === UTOPIA STAGE ===
        { band: "Mehnersmoos", stage: "Utopia", start: "13:25", end: "14:20" },
        { band: "Bush", stage: "Utopia", start: "14:50", end: "15:50" },
        { band: "The Hives", stage: "Utopia", start: "16:20", end: "17:20" },
        { band: "Architects", stage: "Utopia", start: "17:50", end: "18:50" },
        { band: "Papa Roach", stage: "Utopia", start: "19:30", end: "20:45" },
        { band: "Linkin Park", stage: "Utopia", start: "21:30", end: "23:00", headliner: true },

        // === MANDORA STAGE ===
        { band: "Loathe", stage: "Mandora", start: "12:50", end: "13:35" },
        { band: "We Came As Romans", stage: "Mandora", start: "14:05", end: "14:50" },
        { band: "Mastodon", stage: "Mandora", start: "15:20", end: "16:10" },
        { band: "The Plot In You", stage: "Mandora", start: "16:40", end: "17:40" },
        { band: "Within Temptation", stage: "Mandora", start: "18:10", end: "19:10" },
        { band: "Trivium", stage: "Mandora", start: "19:40", end: "20:50" },
        { band: "Babymetal", stage: "Mandora", start: "21:30", end: "22:45" },
        { band: "Limp Bizkit", stage: "Mandora", start: "23:45", end: "01:00", headliner: true },

        // === ORBIT STAGE ===
        { band: "Slay Squad", stage: "Orbit", start: "13:55", end: "14:35" },
        { band: "Ankor", stage: "Orbit", start: "15:00", end: "15:40" },
        { band: "Magnolia Park", stage: "Orbit", start: "16:05", end: "16:45" },
        { band: "TX2", stage: "Orbit", start: "17:10", end: "17:50" },
        { band: "Don Broco", stage: "Orbit", start: "18:15", end: "19:00" },
        { band: "Drain", stage: "Orbit", start: "19:25", end: "20:10" },
        { band: "Malevolence", stage: "Orbit", start: "20:35", end: "21:25" },
        { band: "The Funeral Portrait", stage: "Orbit", start: "21:50", end: "22:50" },
        { band: "Danko Jones", stage: "Orbit", start: "23:20", end: "00:20" },
        { band: "The Butcher Sisters", stage: "Orbit", start: "00:50", end: "02:00" }
      ]
    }
  ]
};
