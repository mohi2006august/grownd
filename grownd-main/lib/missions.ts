// The six missions, the four scientist types, the quiz and the occasion categories.
// The words here appear on the site, in search results and on share images, so edit them here.
// Prices and dates are not here: the team sets them in the dashboard.

export type TypeKey = "bio" | "chem" | "phys" | "eng";

export interface ScientistType {
  slug: string;
  name: string;
  /** "a" or "an", for "You are a Chemist". */
  an: "a" | "an";
  /** CSS colour, using the theme variable so light mode can adjust it. */
  color: string;
  initial: string;
  tag: string;
  desc: string;
  traits: string[];
  /** Mission ids recommended for this type, best first. */
  recs: string[];
}

export type Category = "Birthday" | "Private celebration" | "Workshop" | "School event" | "Coding" | "Seasonal event";

export interface Mission {
  id: string;
  slug: string;
  no: string;
  title: string;
  type: TypeKey;
  cat: Category;
  /** Big word on the mission card. */
  glyph: string;
  ages: string;
  mins: number;
  cap: number;
  /** Price per child, or per class for school events. */
  unit: "child" | "class";
  line: string;
  para: string;
  steps: [string, string][];
  incl: string[];
  worth: string[];
}

export const TYPE_ORDER: TypeKey[] = ["bio","chem","phys","eng"];

export const TYPES: Record<TypeKey, ScientistType> = {
  "bio": {
    "slug": "biologist",
    "name": "Biologist",
    "an": "a",
    "color": "var(--bio,#35D07F)",
    "initial": "B",
    "tag": "You want to know what it is and whether it is alive.",
    "desc": "You are the one who notices the beetle nobody else saw. You will happily spend an hour on one leaf, and you always want to know what something eats. Biologists at GROWND get the missions with the most looking closely, and occasionally the most mud.",
    "traits": [
      "Observant",
      "Patient",
      "Asks what it eats"
    ],
    "recs": [
      "m03",
      "m06"
    ]
  },
  "chem": {
    "slug": "chemist",
    "name": "Chemist",
    "an": "a",
    "color": "var(--chem,#FF5CA8)",
    "initial": "C",
    "tag": "You want to know what happens when two things meet.",
    "desc": "You are not scared of a bit of foam, and you are the reason the kitchen smells like that. You would rather try it and find out than read about it first. Chemists at GROWND get the loudest reactions and by far the most colours.",
    "traits": [
      "Curious",
      "Fearless",
      "Messy on purpose"
    ],
    "recs": [
      "m01",
      "m06"
    ]
  },
  "phys": {
    "slug": "physicist",
    "name": "Physicist",
    "an": "a",
    "color": "var(--phys,#38BDF8)",
    "initial": "P",
    "tag": "You want to know why it moved like that.",
    "desc": "You drop things to see how they fall and you have opinions about which paper aeroplane is best. You like a rule you can test. Physicists at GROWND get the missions with light, speed and things that should not balance but do.",
    "traits": [
      "Precise",
      "Testing everything",
      "Likes a rule"
    ],
    "recs": [
      "m04",
      "m02"
    ]
  },
  "eng": {
    "slug": "engineer",
    "name": "Engineer",
    "an": "an",
    "color": "var(--eng,#FFA03B)",
    "initial": "E",
    "tag": "You want to know how to make a better one.",
    "desc": "You take things apart, and roughly half of them go back together improved. A failed design does not bother you because version two is already in your head. Engineers at GROWND get the missions where something has to be built and then tested to destruction.",
    "traits": [
      "Builder",
      "Unbothered by failure",
      "Already on version two"
    ],
    "recs": [
      "m02",
      "m05"
    ]
  }
};

export const MISSIONS: Mission[] = [
  {
    "id": "m01",
    "slug": "slime-chemistry",
    "no": "01",
    "title": "Slime Chemistry",
    "type": "chem",
    "cat": "Birthday",
    "glyph": "SLIME",
    "ages": "5-8",
    "mins": 90,
    "cap": 20,
    "unit": "child",
    "line": "Polymers, cross-links and a colour they choose themselves. Everyone goes home with a pot.",
    "para": "Ninety minutes of genuine polymer chemistry, disguised as the best mess of their life. Everyone mixes their own, picks their own colour, and takes a pot home with the recipe card that made it.",
    "steps": [
      [
        "Meet the polymer.",
        "Two liquids go in. Something that is neither liquid nor solid comes out. We explain why, badly, then properly."
      ],
      [
        "Break it on purpose.",
        "Pull it slowly, pull it fast. Same slime, completely different behaviour. This is the bit they remember."
      ],
      [
        "Run the variable.",
        "Each child changes one thing: more cross-linker, glitter, foam beads. They compare results as a group."
      ],
      [
        "Take it home.",
        "Labelled pot, their name, their recipe card. The recipe card is the bit parents thank us for."
      ]
    ],
    "incl": [
      "Two GROWND scientists for the full session",
      "All equipment, materials and protective kit",
      "A take-home pot and recipe card per child",
      "Setup and full clean-up, including the ceiling"
    ],
    "worth": [
      "We need a table per six children and a tap nearby",
      "Old clothes. We provide aprons, they are not magic",
      "Tell us about allergies when you book",
      "[INSURANCE AND DBS DETAILS]"
    ]
  },
  {
    "id": "m02",
    "slug": "rocket-engineering",
    "no": "02",
    "title": "Rocket Engineering",
    "type": "eng",
    "cat": "Workshop",
    "glyph": "LAUNCH",
    "ages": "7-11",
    "mins": 120,
    "cap": 24,
    "unit": "child",
    "line": "Design it, launch it, argue about why it went sideways, build a better one.",
    "para": "Two hours of design, launch and redesign. Every child builds a rocket, launches it properly, and then works out what to change. Nobody gets it right first time, which is the entire point.",
    "steps": [
      [
        "Draw the thing.",
        "Fins, nose cone, mass. We give them the constraints and let them argue about the rest."
      ],
      [
        "Build it.",
        "Cutting, taping, weighing. The first build is always too heavy and they find that out themselves."
      ],
      [
        "Launch it.",
        "Outside, pressure launcher, measured heights. Everyone gets two launches on the board."
      ],
      [
        "Version two.",
        "One change each, relaunch, compare. The improvement is the result, not the height."
      ]
    ],
    "incl": [
      "Two GROWND scientists and a pressure launcher",
      "All build materials and safety kit",
      "Their rocket to take home",
      "A launch log with every height recorded"
    ],
    "worth": [
      "This one needs outdoor space, roughly 15 metres clear",
      "Wet weather: we run the build indoors and launch another day",
      "Ear defenders available for children who want them",
      "[INSURANCE AND DBS DETAILS]"
    ]
  },
  {
    "id": "m03",
    "slug": "crime-scene-biology",
    "no": "03",
    "title": "Crime Scene Biology",
    "type": "bio",
    "cat": "School event",
    "glyph": "CASE 01",
    "ages": "8-12",
    "mins": 90,
    "cap": 32,
    "unit": "class",
    "line": "Fingerprints, fibres and one very suspicious sandwich. The class solves it together.",
    "para": "A staged scene, real forensic technique and a class that has to agree on an answer. They lift prints, compare fibres, and work through the evidence until only one suspect is left.",
    "steps": [
      [
        "Walk the scene.",
        "They see it before we say anything. First job is writing down what they noticed."
      ],
      [
        "Lift the prints.",
        "Powder, tape, card. Then match against the suspect set, which is harder than it looks."
      ],
      [
        "Compare fibres.",
        "Hand lenses and a fibre board. This is where the confident answer usually falls apart."
      ],
      [
        "Make the case.",
        "The class has to agree, out loud, on who did it and which evidence proves it."
      ]
    ],
    "incl": [
      "Two GROWND scientists and a full staged scene",
      "Evidence kits for the whole class",
      "Suspect files and a fibre board",
      "A follow-up sheet for the teacher"
    ],
    "worth": [
      "Works best in a hall or a cleared classroom",
      "Up to 32 children in one sitting",
      "We can run it twice in a morning for two classes",
      "[INSURANCE AND DBS DETAILS]"
    ]
  },
  {
    "id": "m04",
    "slug": "light-and-lasers",
    "no": "04",
    "title": "Light and Lasers",
    "type": "phys",
    "cat": "Workshop",
    "glyph": "PRISM",
    "ages": "7-12",
    "mins": 90,
    "cap": 20,
    "unit": "child",
    "line": "Bend light, split it, bounce it round a maze and make something glow in the dark.",
    "para": "A dark room, a lot of mirrors and one laser maze that gets harder every round. They split white light, bend a beam through water, and finish by making something glow that should not.",
    "steps": [
      [
        "Split the light.",
        "Prisms and a white beam. Everyone gets a rainbow on a wall and then has to explain it."
      ],
      [
        "Bend the beam.",
        "A laser through water, then through sugar water. Same laser, different bend, no explanation given yet."
      ],
      [
        "Build the maze.",
        "Mirrors on a board, target at the far end. In teams, against the clock."
      ],
      [
        "Make it glow.",
        "UV and fluorescence. They take home something that stores light and gives it back."
      ]
    ],
    "incl": [
      "Two GROWND scientists and all optical kit",
      "Class-1 safe lasers only, fully supervised",
      "A take-home glow item per child",
      "Blackout kit if the room needs it"
    ],
    "worth": [
      "We need a room we can make properly dark",
      "Not suitable alongside a disco or strobe lighting",
      "Tell us about photosensitivity when you book",
      "[INSURANCE AND DBS DETAILS]"
    ]
  },
  {
    "id": "m05",
    "slug": "build-a-game-in-scratch",
    "no": "05",
    "title": "Build a Game in Scratch",
    "type": "eng",
    "cat": "Coding",
    "glyph": "RUN()",
    "ages": "8-12",
    "mins": 120,
    "cap": 16,
    "unit": "child",
    "line": "From blank screen to a game they can actually play, in one session.",
    "para": "Two hours from empty project to a working game with a score, a losing condition and at least one sound effect they regret. They leave with a link so they can keep building at home.",
    "steps": [
      [
        "Make something move.",
        "Sprite, arrow keys, movement. Five minutes in, everyone has something responding to them."
      ],
      [
        "Add a reason to care.",
        "A score, a timer, something to collect. This is where it stops being a demo and starts being a game."
      ],
      [
        "Break it deliberately.",
        "They swap machines and try to break each other's game. Then they fix their own."
      ],
      [
        "Ship it.",
        "A shareable link each. They keep the project and can carry on the same evening."
      ]
    ],
    "incl": [
      "One GROWND scientist per eight children",
      "Laptops if the venue has none",
      "A shareable project link per child",
      "A what-to-build-next sheet"
    ],
    "worth": [
      "Needs wifi that will take sixteen devices",
      "Sixteen children maximum, so everyone gets help",
      "No previous coding needed, genuinely",
      "[INSURANCE AND DBS DETAILS]"
    ]
  },
  {
    "id": "m06",
    "slug": "glow-lab",
    "no": "06",
    "title": "Glow Lab",
    "type": "chem",
    "cat": "Seasonal event",
    "glyph": "GLOW",
    "ages": "5-10",
    "mins": 90,
    "cap": 24,
    "unit": "child",
    "line": "Dry ice, UV paint and reactions that look far more dangerous than they are.",
    "para": "Our seasonal mission. Dry ice fog, UV-reactive paint and a set of colour-change reactions built for a dark room and a crowd. Loud, bright and genuinely chemistry the whole way through.",
    "steps": [
      [
        "Fog the room.",
        "Dry ice in warm water. We explain sublimation while they cannot see each other."
      ],
      [
        "Paint under UV.",
        "Invisible in daylight, loud under the lamp. Everyone makes a badge for themselves."
      ],
      [
        "Change the colour.",
        "Indicator chemistry with red cabbage. It goes through four colours and they call each one."
      ],
      [
        "The last reaction.",
        "One big finale reaction, done by us, watched by them, from a sensible distance."
      ]
    ],
    "incl": [
      "Two GROWND scientists and all dry ice handling",
      "UV lamps, paint and badges",
      "A take-home glow badge per child",
      "Full clean-up"
    ],
    "worth": [
      "Needs ventilation and a room we can darken",
      "Dry ice is handled only by GROWND staff",
      "Loud finale: ear defenders available on request",
      "[INSURANCE AND DBS DETAILS]"
    ]
  }
];

export const QUIZ: { q: string; a: [string, string, string, string] }[] = [
  {
    "q": "You find a strange box buried in the garden. What do you do first?",
    "a": [
      "Check whether something is living in it",
      "Pour something on it and see what happens",
      "Work out how heavy it is, then drop it",
      "Take it apart and build a better one"
    ]
  },
  {
    "q": "Your experiment goes very wrong. Honestly, how do you feel?",
    "a": [
      "Worried about the woodlice",
      "Delighted, because it changed colour",
      "Curious, because something moved oddly",
      "Already sketching version two"
    ]
  },
  {
    "q": "Which mess is your kind of mess?",
    "a": [
      "Mud, leaves and one escaped frog",
      "Foam everywhere, ceiling included",
      "Marbles rolling off every surface",
      "Cardboard, tape and 400 lolly sticks"
    ]
  },
  {
    "q": "Pick a superpower, but only for one day.",
    "a": [
      "Talk to animals",
      "Turn anything into anything else",
      "Walk through walls",
      "Build anything in ten seconds"
    ]
  },
  {
    "q": "Best thing about a rainy Saturday?",
    "a": [
      "Worms all over the path",
      "Mixing everything in the kitchen",
      "Racing raindrops down the window",
      "Finally finishing the den"
    ]
  },
  {
    "q": "You get one machine for your bedroom. Which one?",
    "a": [
      "A microscope",
      "A fume cupboard, obviously",
      "A laser maze",
      "A 3D printer"
    ]
  }
];

/** Occasion categories: [name, line, icon]. */
export const CATEGORIES: [Category, string, string][] = [
  [
    "Birthday",
    "A party where the cake is the second best bit.",
    "cake"
  ],
  [
    "Private celebration",
    "Your people, your place, one very good experiment.",
    "home"
  ],
  [
    "Workshop",
    "Weekend sessions that go properly deep on one idea.",
    "flask"
  ],
  [
    "School event",
    "A whole class, one staged crime, one agreed answer.",
    "school"
  ],
  [
    "Coding",
    "From a blank screen to a game they can play.",
    "code"
  ],
  [
    "Seasonal event",
    "Dry ice, UV paint and the loudest bit of the year.",
    "star"
  ]
];

export const missionBySlug = (slug: string) => MISSIONS.find(m => m.slug === slug);
export const missionById = (id: string) => MISSIONS.find(m => m.id === id);
export const typeBySlug = (slug: string) => TYPE_ORDER.find(k => TYPES[k].slug === slug);
export const categoryKey = (name: string) => name.toLowerCase().replace(/ /g, "-");

/** The team on the "Who we are" page: role, name, line, the photo still to come, accent colour. */
export const TEAM: { role: string; name: string; line: string; photo: string; color: string }[] = [
  { role: "SCIENCE AND EXPERIENCE", name: "[TEAM LEAD]", line: "Plans every mission and runs most of them. Responsible for the ceiling.", photo: "science lead mid-demo", color: "var(--success,#35D07F)" },
  { role: "TECHNOLOGY", name: "[TECH LEAD]", line: "Builds the coding missions and this website. Owns the pressure launcher.", photo: "tech lead with laptops", color: "var(--phys,#38BDF8)" },
  { role: "CONTENT", name: "[CONTENT LEAD]", line: "Films the reactions, writes the recipe cards, runs the Instagram challenges.", photo: "content lead filming", color: "var(--chem,#FF5CA8)" }
];
