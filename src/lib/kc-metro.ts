export type ServiceAreaInput = {
  zip: string;
  city: string;
  state: string;
};

export type ServiceAreaResult =
  | { ok: true; city: string; state: "MO" | "KS"; zip: string }
  | { ok: false; code: "invalid" | "out_of_area"; message: string };

const METRO_CITIES = new Set(
  [
    "kansas city",
    "north kansas city",
    "overland park",
    "olathe",
    "independence",
    "lee's summit",
    "lees summit",
    "shawnee",
    "lenexa",
    "leawood",
    "blue springs",
    "liberty",
    "raytown",
    "grandview",
    "gladstone",
    "prairie village",
    "mission",
    "merriam",
    "parkville",
    "belton",
    "raymore",
    "grain valley",
    "oak grove",
    "excelsior springs",
    "smithville",
    "riverside",
    "sugar creek",
    "mission hills",
    "fairway",
    "roeland park",
    "westwood",
    "westwood hills",
    "lake quivira",
    "bonner springs",
    "edwardsville",
    "basehor",
    "lansing",
    "leavenworth",
    "gardner",
    "spring hill",
    "de soto",
    "desoto",
    "stilwell",
    "edgerton",
    "tonganoxie",
    "platte city",
    "kearney",
    "pleasant hill",
    "harrisonville",
    "peculiar",
    "greenwood",
    "lone jack",
    "lake lotawana",
    "lake tapawingo",
    "unity village",
    "weatherby lake",
    "buckner",
    "sibley",
    "mosby",
    "holt",
    "lawson",
    "camden point",
    "weston",
    "riverside",
    "gladstone",
    "randolph",
    "avondale",
    "claycomo",
    "gladstone",
    "mission woods",
    "countryside",
    "westwood hills",
    "lake waukomis",
    "houston lake",
    "northmoor",
    "oaks",
    "oakview",
    "oakwood",
    "oakwood park",
    "pleasant valley",
    "birmingham",
    "missouri city",
    "prathersville",
    "missouri city",
    "glenaire",
    "minaville",
    "lake lotawana",
    "lake winnebago",
    "lee's summit",
    "raymore",
    "archie's",
    "freeman",
    "cleveland",
    "drexel",
    "east lynne",
    "strasburg",
    "garden city",
    "kck",
  ].map((city) => normalizeCity(city)),
);

const CITY_ALIASES: Record<string, string> = {
  kc: "kansas city",
  kcmo: "kansas city",
  kck: "kansas city",
  nkc: "north kansas city",
  "lees summit": "lee's summit",
  "lee summit": "lee's summit",
  desoto: "de soto",
  "overland pk": "overland park",
  opks: "overland park",
};

const EXPLICIT_ZIPS = new Set([
  // Eastern Jackson / Cass / Clay / Platte / Ray suburbs (640xx)
  "64012",
  "64014",
  "64015",
  "64016",
  "64018",
  "64024",
  "64029",
  "64030",
  "64034",
  "64048",
  "64050",
  "64051",
  "64052",
  "64053",
  "64054",
  "64055",
  "64056",
  "64057",
  "64058",
  "64060",
  "64062",
  "64063",
  "64064",
  "64065",
  "64066",
  "64068",
  "64069",
  "64070",
  "64073",
  "64074",
  "64075",
  "64076",
  "64078",
  "64079",
  "64080",
  "64081",
  "64082",
  "64083",
  "64085",
  "64086",
  "64088",
  "64089",
  "64092",
  "64097",
  "64098",
  // Johnson / Leavenworth / Miami-adjacent KS (660xx)
  "66007",
  "66012",
  "66018",
  "66021",
  "66030",
  "66031",
  "66043",
  "66048",
  "66051",
  "66061",
  "66062",
  "66063",
  "66083",
  "66085",
  "66086",
  // Cass County seat
  "64701",
]);

const OUT_OF_AREA_MESSAGE =
  "Trades on Demand only dispatches in the Kansas City metro — Missouri and Kansas sides. We cover Kansas City, Overland Park, Olathe, Independence, Lee's Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby KC neighborhoods. If you're in the metro, double-check the city and ZIP. We don't book jobs outside this area.";

export function normalizeCity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeZip(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function normalizeState(value: string): "MO" | "KS" | "" {
  const raw = value.trim().toUpperCase();
  if (raw === "MO" || raw === "MISSOURI") return "MO";
  if (raw === "KS" || raw === "KANSAS") return "KS";
  return "";
}

export function isMetroZip(zip: string): boolean {
  const z = normalizeZip(zip);
  if (z.length !== 5) return false;
  if (z.startsWith("641") || z.startsWith("661") || z.startsWith("662")) {
    return true;
  }
  return EXPLICIT_ZIPS.has(z);
}

export function isMetroCity(city: string): boolean {
  const normalized = normalizeCity(city);
  const aliased = normalizeCity(CITY_ALIASES[normalized] ?? normalized);
  if (!aliased) return false;
  if (METRO_CITIES.has(aliased)) return true;

  for (const allowed of METRO_CITIES) {
    if (aliased.includes(allowed) && allowed.length >= 6) return true;
    if (allowed.includes(aliased) && aliased.length >= 6) return true;
  }
  return false;
}

export function evaluateServiceArea(input: ServiceAreaInput): ServiceAreaResult {
  const zip = normalizeZip(input.zip);
  const state = normalizeState(input.state);
  const city = input.city.trim();

  if (zip.length !== 5 || !city || !state) {
    return {
      ok: false,
      code: "invalid",
      message:
        "Enter a street city, MO or KS, and a 5-digit ZIP so we can confirm you're in the Kansas City metro.",
    };
  }

  const zipOk = isMetroZip(zip);
  const cityOk = isMetroCity(city);

  if (!zipOk || !cityOk) {
    return { ok: false, code: "out_of_area", message: OUT_OF_AREA_MESSAGE };
  }

  return { ok: true, city, state, zip };
}

export const KC_METRO_CITIES = [
  "Kansas City",
  "Overland Park",
  "Olathe",
  "Independence",
  "Lee's Summit",
  "Shawnee",
  "Lenexa",
  "Leawood",
  "Blue Springs",
  "Liberty",
  "Raytown",
  "Grandview",
  "Gladstone",
  "North Kansas City",
  "Prairie Village",
  "Mission",
  "Merriam",
  "Parkville",
  "Belton",
  "Raymore",
] as const;
