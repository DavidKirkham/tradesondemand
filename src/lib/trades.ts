export type Trade = {
  slug: string;
  name: string;
  short: string;
  description: string;
  emergencyExamples: string[];
  routineExamples: string[];
};

export const TRADES: Trade[] = [
  {
    slug: "plumbing",
    name: "Plumbing",
    short: "Leaks, drains, water heaters",
    description:
      "Burst pipes, sewer backups, water heaters, and fixture work across KCMO and Johnson County.",
    emergencyExamples: ["Burst pipe", "Sewage backup", "No water"],
    routineExamples: ["Faucet swap", "Slow drain", "Water heater tune-up"],
  },
  {
    slug: "electrical",
    name: "Electrical",
    short: "Outlets, panels, no-power",
    description:
      "Outages, sparking outlets, panel issues, and lighting — licensed electrical partners only.",
    emergencyExamples: ["No power", "Burning smell", "Sparking outlet"],
    routineExamples: ["Add outlet", "Ceiling fan", "Panel upgrade quote"],
  },
  {
    slug: "hvac",
    name: "HVAC",
    short: "Heat, A/C, furnaces",
    description:
      "No heat in January, no A/C in July, or a seasonal tune-up before the next KC swing.",
    emergencyExamples: ["No heat", "No A/C", "Gas smell — call 911 first"],
    routineExamples: ["Filter / tune-up", "Thermostat", "Duct work"],
  },
  {
    slug: "roofing",
    name: "Roofing",
    short: "Leaks, storms, shingles",
    description:
      "Storm-season leaks, missing shingles, and tarp-now / replace-later decisions after hail.",
    emergencyExamples: ["Active roof leak", "Storm damage tarp"],
    routineExamples: ["Shingle repair", "Inspection", "Gutter tie-in"],
  },
  {
    slug: "handyman",
    name: "Handyman / carpentry",
    short: "Repairs, trim, odds and ends",
    description:
      "The 'someone who can just fix it' list — doors, trim, drywall patches, and punch lists.",
    emergencyExamples: ["Unsafe railing", "Door won't secure"],
    routineExamples: ["Shelving", "Trim", "Drywall patch"],
  },
  {
    slug: "painting",
    name: "Painting",
    short: "Interior, exterior, cabinets",
    description:
      "Interior refresh, exterior after hail season, cabinets, and stain — scheduled, not a 2 a.m. call.",
    emergencyExamples: ["Water-stained ceiling after a leak"],
    routineExamples: ["Room repaint", "Exterior", "Cabinets"],
  },
  {
    slug: "flooring",
    name: "Flooring",
    short: "LVP, hardwood, tile",
    description:
      "Water-damaged floors, transitions, and full-room LVP or hardwood in KC homes and rentals.",
    emergencyExamples: ["Flooring after a flood"],
    routineExamples: ["LVP install", "Hardwood repair", "Tile"],
  },
  {
    slug: "appliance",
    name: "Appliance repair",
    short: "Washer, fridge, oven",
    description:
      "Washers, dryers, refrigerators, dishwashers, and ranges — diagnose before you replace.",
    emergencyExamples: ["Fridge not cooling", "Washer leaking"],
    routineExamples: ["Dryer not heating", "Oven error code"],
  },
  {
    slug: "locksmith",
    name: "Locksmith",
    short: "Lockouts, rekeys, hardware",
    description:
      "Car and home lockouts, rekeys after a roommate change, and deadbolt upgrades.",
    emergencyExamples: ["Locked out", "Broken key in lock"],
    routineExamples: ["Rekey", "Smart lock", "Deadbolt"],
  },
  {
    slug: "pest",
    name: "Pest control",
    short: "Bugs, rodents, wasps",
    description:
      "Wasps on the deck, mice in a Brookside bungalow, or a seasonal perimeter treatment.",
    emergencyExamples: ["Wasp nest at the door", "Rodents in kitchen"],
    routineExamples: ["Quarterly treatment", "Ants", "Wildlife exclusion"],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    short: "Mow, trees, drainage",
    description:
      "Storm cleanup, drainage that dumps toward the foundation, mowing, and small hardscape.",
    emergencyExamples: ["Downed limb on the house", "Blocked drainage"],
    routineExamples: ["Mow / trim", "Mulch", "Grading"],
  },
  {
    slug: "cleaning",
    name: "Cleaning",
    short: "Move-out, deep clean",
    description:
      "Move-out cleans, post-renovation dust, and recurring house cleans — KC rentals included.",
    emergencyExamples: ["Bio / water-loss cleanup (with restoration)"],
    routineExamples: ["Deep clean", "Move-out", "Recurring"],
  },
  {
    slug: "garage-door",
    name: "Garage door",
    short: "Openers, springs, off-track",
    description:
      "Off-track doors, snapped springs, and openers that died the morning you needed to leave.",
    emergencyExamples: ["Door stuck open/closed", "Snapped spring"],
    routineExamples: ["Opener", "Weather seal", "Sensors"],
  },
  {
    slug: "concrete",
    name: "Concrete / masonry",
    short: "Driveways, steps, tuckpoint",
    description:
      "Heaved sidewalks, crumbling steps, and tuckpointing on brick KC bungalows.",
    emergencyExamples: ["Unsafe steps", "Trip hazard after a freeze"],
    routineExamples: ["Driveway", "Patio", "Tuckpointing"],
  },
  {
    slug: "fencing",
    name: "Fencing",
    short: "Wood, vinyl, storm repair",
    description:
      "Privacy fence blow-downs after a derecho, gate repairs, and new runs on a property line.",
    emergencyExamples: ["Fence on a neighbor's car", "Open backyard"],
    routineExamples: ["New fence", "Gate", "Stain"],
  },
  {
    slug: "windows-doors",
    name: "Windows & doors",
    short: "Glass, entries, storms",
    description:
      "Broken glass, swollen entry doors, and storm windows that no longer lock.",
    emergencyExamples: ["Broken glass", "Door won't lock"],
    routineExamples: ["Replacement windows", "Storm door", "Weatherstrip"],
  },
  {
    slug: "water-damage",
    name: "Water damage / restoration",
    short: "Extract, dry, remediate",
    description:
      "Finished-basement floods, supply-line bursts, and dry-out before mold gets a vote.",
    emergencyExamples: ["Standing water", "Ceiling sag after a leak"],
    routineExamples: ["Moisture check", "Rebuild after dry-out"],
  },
  {
    slug: "other",
    name: "General contractor / Other",
    short: "Not sure? Start here",
    description:
      "Multi-trade jobs, something we didn't list, or you just need a general contractor to sort it.",
    emergencyExamples: ["Unsafe structure", "Unknown leak / smell"],
    routineExamples: ["Remodel bid", "Not sure which trade"],
  },
];

export const OTHER_TRADE_SLUG = "other";

export function getTrade(slug: string): Trade | undefined {
  return TRADES.find((trade) => trade.slug === slug);
}

export function isKnownTrade(slug: string): boolean {
  return TRADES.some((trade) => trade.slug === slug);
}
