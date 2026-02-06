export const API_BASE = "https://www.themealdb.com/api/json/v1/1";
export const MAX_RESULTS = 8;
export const RECOMMENDED_COUNT = 6;
export const CANDIDATE_POOL_SIZE = 60;
export const INGREDIENT_LOOKUP_LIMIT = 20;

export const TERM_SYNONYMS = {
  ground: ["minced"],
  minced: ["ground"],
  beef: ["beef", "mince"],
  chicken: ["chicken", "chicken_breast"],
  pasta: ["pasta"],
  pork: ["pork"],
  turkey: ["turkey"],
  rice: ["rice"],
  curry: ["curry"],
  tomato: ["tomato"],
  potato: ["potato"],
};

export const TERM_ALIASES = {
  pasta: ["pasta", "spaghetti", "penne", "macaroni", "noodle", "noodles", "fettuccine", "linguine", "tagliatelle"],
  rice: ["rice", "risotto"],
  beef: ["beef", "steak"],
  "ground beef": ["ground beef", "minced beef", "beef mince", "mince"],
  chicken: ["chicken"],
  "ground pork": ["ground pork", "pork mince", "minced pork"],
  pork: ["pork"],
  "ground turkey": ["ground turkey", "turkey mince", "minced turkey"],
  turkey: ["turkey"],
  sausage: ["sausage", "sausages"],
  tacos: ["taco", "tacos"],
  chili: ["chili", "chilli"],
  casserole: ["casserole", "bake"],
  stirfry: ["stir fry", "stir-fry", "stirfried", "stir-fried"],
  onepot: ["one pot", "one-pot", "one pan", "one-pan", "skillet"],
};

// Recipe filter knobs for weeknight-friendly results.
export const RECIPE_FILTER_CONFIG = {
  allowedProteinTerms: ["chicken", "beef", "ground beef", "pork", "ground pork", "turkey", "ground turkey", "sausage"],
  blockedExpensiveTerms: ["prawn", "lobster", "crab", "scallop", "duck", "saffron", "truffle"],
  blockedNicheTerms: ["baba ganoush", "pho", "tagine", "rendang", "yakitori", "sashimi"],
  preferredDinnerFormats: ["pasta", "tacos", "chili", "casserole", "rice", "stirfry", "onepot"],
};

export const RANKING_CONFIG = {
  debugScoreBreakdown: false,
  weights: {
    familiarity: 0.32,
    budgetProxy: 0.24,
    simplicity: 0.2,
    queryIntent: 0.24,
  },
};

export const FILTER_STORAGE_KEY = "weeknightFiltersV1";

export const DEFAULT_UI_FILTERS = {
  under30: false,
  onePot: false,
  budgetMode: false,
  excludeSeafood: true,
  comfortClassicsOnly: false,
  proteins: {
    chicken: false,
    beef: false,
    pork: false,
    turkey: false,
    sausage: false,
  },
};
