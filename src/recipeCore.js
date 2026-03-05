import {
  API_BASE,
  CANDIDATE_POOL_SIZE,
  INGREDIENT_LOOKUP_LIMIT,
  RANKING_CONFIG,
  RECIPE_FILTER_CONFIG,
  TERM_ALIASES,
  TERM_SYNONYMS,
} from "./config.js";

export async function getRecommendationPool() {
  const seedIngredients = ["chicken", "beef", "pork", "turkey", "sausage", "pasta", "rice"];
  const filterResults = await Promise.allSettled(
    seedIngredients.map((ingredient) =>
      fetchJson(`${API_BASE}/filter.php?i=${encodeURIComponent(ingredient)}`)
    )
  );

  const idSet = new Set();
  filterResults
    .filter((result) => result.status === "fulfilled")
    .forEach((result) => {
      const matches = result.value?.meals || [];
      matches.slice(0, 10).forEach((meal) => idSet.add(meal.idMeal));
    });

  const ids = [...idSet].slice(0, 70);
  const detailResults = await Promise.allSettled(
    ids.map((idMeal) => fetchJson(`${API_BASE}/lookup.php?i=${encodeURIComponent(idMeal)}`))
  );

  const meals = [];
  detailResults
    .filter((result) => result.status === "fulfilled")
    .forEach((result) => {
      const meal = result.value?.meals?.[0];
      if (meal) meals.push(meal);
    });

  return meals;
}

export async function findMeals(rawQuery) {
  const normalized = rawQuery.toLowerCase().trim();
  const searchTerms = buildSearchTerms(normalized);
  const ingredientIntent = extractIngredientIntent(normalized);

  const mealById = new Map();

  if (ingredientIntent.length >= 2) {
    try {
      await addMealsMatchingAllIngredients(ingredientIntent, mealById);
    } catch (_error) {}
  }

  await addMealsFromNameSearch(normalized, mealById);

  for (const term of searchTerms) {
    if (mealById.size >= CANDIDATE_POOL_SIZE) break;
    await addMealsFromNameSearch(term, mealById);
  }

  for (const ingredient of searchTerms) {
    if (mealById.size >= CANDIDATE_POOL_SIZE) break;
    await addMealsFromIngredientSearch(ingredient, mealById);
  }

  return [...mealById.values()];
}

export function applyStrictPreFilters(meals, rawQuery) {
  const querySignals = buildQuerySignals(rawQuery);
  const userRequestedTerms = buildUserRequestedSet(querySignals);

  const strictMatches = meals.filter((meal) => {
    const text = getMealSearchText(meal);

    const hasAllowedProtein = RECIPE_FILTER_CONFIG.allowedProteinTerms.some((term) =>
      termMatches(text, term)
    );
    if (!hasAllowedProtein) return false;

    const hasBlockedExpensive = RECIPE_FILTER_CONFIG.blockedExpensiveTerms.some(
      (term) => termMatches(text, term) && !userRequestedTerms.has(term)
    );
    if (hasBlockedExpensive) return false;

    const hasBlockedNiche = RECIPE_FILTER_CONFIG.blockedNicheTerms.some(
      (term) => termMatches(text, term) && !userRequestedTerms.has(term)
    );

    return !hasBlockedNiche;
  });

  if (!strictMatches.length) return [];

  const preferredFormatMatches = strictMatches.filter((meal) => {
    const text = getMealSearchText(meal);
    return RECIPE_FILTER_CONFIG.preferredDinnerFormats.some((term) =>
      termMatches(text, term)
    );
  });

  return preferredFormatMatches.length ? preferredFormatMatches : strictMatches;
}

export function applyUiToggles(meals, uiFilters) {
  let filtered = [...meals];

  if (uiFilters.excludeSeafood) {
    filtered = filtered.filter((meal) => {
      const text = getMealSearchText(meal);
      return ![
        "fish",
        "salmon",
        "shrimp",
        "prawn",
        "tuna",
        "cod",
        "seafood",
        "crab",
        "lobster",
      ].some((term) => termMatches(text, term));
    });
  }

  if (uiFilters.onePot) {
    filtered = filtered.filter((meal) => termMatches(getMealSearchText(meal), "onepot"));
  }

  if (uiFilters.comfortClassicsOnly) {
    filtered = filtered.filter((meal) =>
      RECIPE_FILTER_CONFIG.preferredDinnerFormats.some((term) =>
        termMatches(getMealSearchText(meal), term)
      )
    );
  }

  const activeProteins = Object.entries(uiFilters.proteins)
    .filter(([, enabled]) => enabled)
    .map(([protein]) => protein);

  if (activeProteins.length) {
    filtered = filtered.filter((meal) =>
      activeProteins.some((protein) => termMatches(getMealSearchText(meal), protein))
    );
  }

  if (uiFilters.under30) {
    filtered = filtered.filter((meal) => estimateCookTimeMinutes(meal) <= 30);
  }

  if (uiFilters.budgetMode) {
    filtered = filtered.filter((meal) => scoreBudgetProxy(getMealSearchText(meal)) >= 55);
  }

  return filtered;
}

export function rankMealsForQuery(meals, rawQuery) {
  const signals = buildQuerySignals(rawQuery);

  const scoredMeals = meals.map((meal, index) => {
    const breakdown = buildMealScoreBreakdown(meal, signals);
    return {
      meal,
      index,
      breakdown,
      weightedScore: calculateWeightedScore(breakdown),
      matchedCount: countMatchedRequiredTerms(meal, signals),
      allTermsMatch: hasAllRequiredTerms(meal, signals),
      specialMatch: hasAllSpecialMatches(meal, signals),
    };
  });

  scoredMeals.sort((a, b) => {
    if (b.specialMatch !== a.specialMatch) return Number(b.specialMatch) - Number(a.specialMatch);
    if (b.allTermsMatch !== a.allTermsMatch) return Number(b.allTermsMatch) - Number(a.allTermsMatch);
    if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;

    const titleA = (a.meal.strMeal || "").toLowerCase();
    const titleB = (b.meal.strMeal || "").toLowerCase();
    if (titleA !== titleB) return titleA.localeCompare(titleB);

    const idA = Number(a.meal.idMeal || 0);
    const idB = Number(b.meal.idMeal || 0);
    if (idA !== idB) return idA - idB;

    return a.index - b.index;
  });

  if (RANKING_CONFIG.debugScoreBreakdown) {
    console.table(
      scoredMeals.slice(0, 12).map((item) => ({
        meal: item.meal.strMeal,
        weighted: item.weightedScore.toFixed(2),
        familiarity: item.breakdown.familiarity,
        budgetProxy: item.breakdown.budgetProxy,
        simplicity: item.breakdown.simplicity,
        queryIntent: item.breakdown.queryIntent,
      }))
    );
  }

  return scoredMeals.map((item) => item.meal);
}

export function selectMealsForDisplay(meals, rawQuery) {
  const signals = buildQuerySignals(rawQuery);

  if (signals.requiredTerms.length < 2 && !signals.specialMatchers.length) {
    return meals;
  }

  const strongMatches = meals.filter((meal) =>
    hasAllRequiredTerms(meal, signals) && hasAllSpecialMatches(meal, signals)
  );

  if (strongMatches.length) return strongMatches;

  const allTermMatches = meals.filter((meal) => hasAllRequiredTerms(meal, signals));
  if (allTermMatches.length) return allTermMatches;

  return [];
}

export function pickVariedRecommendations(meals, limit) {
  const ranked = rankMealsForQuery(meals, "dinner");
  const pools = new Map();

  ranked.forEach((meal) => {
    const key = `${getPrimaryProteinLabel(meal)}|${getPrimaryFormatLabel(meal)}`;
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(meal);
  });

  const keys = [...pools.keys()].sort();
  const selected = [];
  let roundsWithoutProgress = 0;

  while (selected.length < limit && roundsWithoutProgress <= keys.length) {
    let progressed = false;
    for (const key of keys) {
      if (selected.length >= limit) break;
      const queue = pools.get(key);
      if (!queue || !queue.length) continue;
      const candidate = queue.shift();
      if (!selected.some((meal) => meal.idMeal === candidate.idMeal)) {
        selected.push(candidate);
        progressed = true;
      }
    }
    roundsWithoutProgress = progressed ? 0 : roundsWithoutProgress + 1;
    if (!progressed) break;
  }

  return selected.slice(0, limit);
}

export function getRecipeSourceUrl(meal) {
  if (meal.strSource) return meal.strSource;
  if (meal.strYoutube) return meal.strYoutube;
  if (meal.idMeal) return `https://www.themealdb.com/meal/${meal.idMeal}`;
  return "";
}

export function getIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim();
    if (!ingredient) continue;
    const metricMeasure = convertToMetric(measure);
    items.push(metricMeasure ? `${metricMeasure} ${ingredient}` : ingredient);
  }
  return items;
}

export function splitInstructions(instructionsText = "") {
  return instructionsText
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function estimateCookTimeMinutes(meal) {
  const steps = splitInstructions(meal.strInstructions).length;
  const ingredients = countIngredients(meal);
  return Math.max(12, steps * 4 + ingredients * 2);
}

function getPrimaryProteinLabel(meal) {
  const text = getMealSearchText(meal);
  for (const term of RECIPE_FILTER_CONFIG.allowedProteinTerms) {
    if (termMatches(text, term)) return term;
  }
  return "other";
}

function getPrimaryFormatLabel(meal) {
  const text = getMealSearchText(meal);
  for (const term of RECIPE_FILTER_CONFIG.preferredDinnerFormats) {
    if (termMatches(text, term)) return term;
  }
  return "general";
}

function buildUserRequestedSet(querySignals) {
  const requested = new Set(querySignals.requiredTerms);
  querySignals.requiredTerms.forEach((term) => {
    const aliases = TERM_ALIASES[term] || [term];
    aliases.forEach((alias) => requested.add(alias));
  });

  if (querySignals.raw.includes("ground") && querySignals.raw.includes("beef")) {
    ["ground beef", "minced beef", "beef mince", "mince"].forEach((term) =>
      requested.add(term)
    );
  }

  return requested;
}

function buildSearchTerms(query) {
  const terms = new Set();
  const cleaned = query
    .replace(/\b(with|and|for|recipe|recipes|idea|ideas|dinner|supper)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned) terms.add(cleaned);

  const words = cleaned.split(" ").filter(Boolean);
  words.forEach((word) => {
    terms.add(word);
    (TERM_SYNONYMS[word] || []).forEach((synonym) => terms.add(synonym));
  });

  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i += 1) {
      terms.add(`${words[i]} ${words[i + 1]}`);
    }
  }

  if (words.includes("ground") && words.includes("beef")) {
    terms.add("beef mince");
    terms.add("mince");
  }

  if (words.includes("pasta") && words.includes("chicken")) {
    terms.add("chicken pasta");
    terms.add("chicken");
    terms.add("pasta");
  }

  return [...terms].filter((term) => term.length > 1);
}

function extractIngredientIntent(rawQuery) {
  const signals = buildQuerySignals(rawQuery);
  return signals.requiredTerms.filter((word) => word.length > 2);
}

async function addMealsMatchingAllIngredients(ingredients, mealById) {
  const ingredientTerms = ingredients.slice(0, 3);
  const filterResults = await Promise.allSettled(
    ingredientTerms.map((ingredient) =>
      fetchJson(`${API_BASE}/filter.php?i=${encodeURIComponent(ingredient)}`)
    )
  );

  const successfulFilters = filterResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (successfulFilters.length < ingredientTerms.length) return;

  const idSets = successfulFilters.map((data) =>
    new Set((data?.meals || []).map((meal) => meal.idMeal))
  );
  if (!idSets.length || idSets.some((set) => set.size === 0)) return;

  const commonIds = [...idSets[0]].filter((id) => idSets.every((set) => set.has(id)));
  const detailResults = await Promise.allSettled(
    commonIds.slice(0, INGREDIENT_LOOKUP_LIMIT).map((idMeal) =>
      fetchJson(`${API_BASE}/lookup.php?i=${encodeURIComponent(idMeal)}`)
    )
  );

  detailResults
    .filter((result) => result.status === "fulfilled")
    .forEach((result) => {
      const meal = result.value?.meals?.[0];
      if (meal) mealById.set(meal.idMeal, meal);
    });
}

async function addMealsFromNameSearch(term, mealById) {
  const data = await fetchJson(`${API_BASE}/search.php?s=${encodeURIComponent(term)}`);
  const meals = data?.meals || [];
  meals.forEach((meal) => mealById.set(meal.idMeal, meal));
}

async function addMealsFromIngredientSearch(ingredient, mealById) {
  const data = await fetchJson(`${API_BASE}/filter.php?i=${encodeURIComponent(ingredient)}`);
  const matches = data?.meals || [];

  const detailPromises = matches.slice(0, INGREDIENT_LOOKUP_LIMIT).map((match) =>
    fetchJson(`${API_BASE}/lookup.php?i=${encodeURIComponent(match.idMeal)}`)
  );

  const detailResults = await Promise.all(detailPromises);
  detailResults.forEach((detailData) => {
    const meal = detailData?.meals?.[0];
    if (meal) mealById.set(meal.idMeal, meal);
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildQuerySignals(rawQuery) {
  const cleaned = rawQuery
    .toLowerCase()
    .replace(/\b(with|and|for|recipe|recipes|idea|ideas|dinner|supper)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const requiredTerms = cleaned
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !["ground"].includes(word));

  const specialMatchers = [];
  if (
    /\b(ground beef|minced beef|beef mince)\b/.test(cleaned) ||
    (cleaned.includes("ground") && cleaned.includes("beef"))
  ) {
    specialMatchers.push(
      (text) =>
        /\bbeef\b/.test(text) &&
        /\b(mince|minced|ground beef|beef mince|minced beef)\b/.test(text)
    );
  }

  return {
    raw: cleaned,
    requiredTerms: [...new Set(requiredTerms)],
    specialMatchers,
  };
}

function buildMealScoreBreakdown(meal, signals) {
  const text = getMealSearchText(meal);
  const title = (meal.strMeal || "").toLowerCase();

  return {
    familiarity: scoreFamiliarity(text, title),
    budgetProxy: scoreBudgetProxy(text),
    simplicity: scoreSimplicity(meal),
    queryIntent: scoreQueryIntent(meal, signals, text, title),
  };
}

function calculateWeightedScore(breakdown) {
  const weights = RANKING_CONFIG.weights;
  return (
    breakdown.familiarity * weights.familiarity +
    breakdown.budgetProxy * weights.budgetProxy +
    breakdown.simplicity * weights.simplicity +
    breakdown.queryIntent * weights.queryIntent
  );
}

function scoreFamiliarity(text, title) {
  let score = 20;

  RECIPE_FILTER_CONFIG.preferredDinnerFormats.forEach((formatTerm) => {
    if (termMatches(text, formatTerm)) score += 10;
    if (termMatches(title, formatTerm)) score += 4;
  });

  RECIPE_FILTER_CONFIG.allowedProteinTerms.forEach((proteinTerm) => {
    if (termMatches(text, proteinTerm)) score += 4;
  });

  return clampScore(score);
}

export function scoreBudgetProxy(text) {
  let score = 65;

  const expensiveHits = RECIPE_FILTER_CONFIG.blockedExpensiveTerms.filter((term) =>
    termMatches(text, term)
  ).length;
  score -= expensiveHits * 18;

  const budgetStapleTerms = [
    "rice",
    "pasta",
    "potato",
    "onion",
    "garlic",
    "canned tomato",
    "ground beef",
    "ground pork",
    "ground turkey",
  ];

  budgetStapleTerms.forEach((term) => {
    if (termMatches(text, term)) score += 5;
  });

  return clampScore(score);
}

function scoreSimplicity(meal) {
  const ingredientCount = countIngredients(meal);
  const stepCount = splitInstructions(meal.strInstructions).length;

  let score = 100;
  score -= Math.max(0, ingredientCount - 8) * 5;
  score -= Math.max(0, stepCount - 7) * 4;

  return clampScore(score);
}

function scoreQueryIntent(meal, signals, text, title) {
  if (!signals.requiredTerms.length && !signals.specialMatchers.length) {
    return 60;
  }

  let score = 0;
  signals.requiredTerms.forEach((term) => {
    if (termMatches(text, term)) score += 16;
    if (termMatches(title, term)) score += 6;
  });

  if (hasAllRequiredTerms(meal, signals)) score += 25;

  if (signals.specialMatchers.length) {
    score += hasAllSpecialMatches(meal, signals) ? 25 : -18;
  }

  return clampScore(score);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function countMatchedRequiredTerms(meal, signals) {
  const text = getMealSearchText(meal);
  return signals.requiredTerms.filter((term) => termMatches(text, term)).length;
}

function hasAllRequiredTerms(meal, signals) {
  if (!signals.requiredTerms.length) return true;
  const text = getMealSearchText(meal);
  return signals.requiredTerms.every((term) => termMatches(text, term));
}

function hasAllSpecialMatches(meal, signals) {
  if (!signals.specialMatchers.length) return true;
  const text = getMealSearchText(meal);
  return signals.specialMatchers.every((matcher) => matcher(text));
}

export function getMealSearchText(meal) {
  return `${meal.strMeal || ""} ${meal.strCategory || ""} ${collectIngredientText(meal)}`.toLowerCase();
}

export function termMatches(text, term) {
  const options = TERM_ALIASES[term] || [term];
  return options.some((option) => containsWord(text, option));
}

function containsWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function countIngredients(meal) {
  let count = 0;
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = meal[`strIngredient${i}`]?.trim();
    if (ingredient) count += 1;
  }
  return count;
}

function collectIngredientText(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = meal[`strIngredient${i}`]?.trim();
    if (ingredient) ingredients.push(ingredient);
  }
  return ingredients.join(" ");
}

function convertToMetric(measure = "") {
  if (!measure) return "";

  const clean = measure.toLowerCase().replace(/\s+/g, " ").trim();
  if (/\b(g|kg|ml|l|gram|grams|litre|liter|millilitre|milliliter)s?\b/.test(clean)) {
    return measure;
  }

  const parts = clean.match(/^([\d./]+)\s*([a-z]+)?/);
  if (!parts) return measure;

  const amount = parseFraction(parts[1]);
  const unit = (parts[2] || "").toLowerCase();

  if (Number.isNaN(amount)) return measure;

  const conversion = {
    tsp: { factor: 5, unit: "ml" },
    tsps: { factor: 5, unit: "ml" },
    tablespoon: { factor: 15, unit: "ml" },
    tablespoons: { factor: 15, unit: "ml" },
    tbsp: { factor: 15, unit: "ml" },
    tbsps: { factor: 15, unit: "ml" },
    cup: { factor: 240, unit: "ml" },
    cups: { factor: 240, unit: "ml" },
    ounce: { factor: 28.35, unit: "g" },
    ounces: { factor: 28.35, unit: "g" },
    oz: { factor: 28.35, unit: "g" },
    pound: { factor: 453.59, unit: "g" },
    pounds: { factor: 453.59, unit: "g" },
    lb: { factor: 453.59, unit: "g" },
    lbs: { factor: 453.59, unit: "g" },
  }[unit];

  if (!conversion) return measure;

  const convertedValue = Math.round(amount * conversion.factor);
  return `~${convertedValue} ${conversion.unit}`;
}

function parseFraction(value) {
  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map(Number);
    if (!bottom) return Number.NaN;
    return top / bottom;
  }
  return Number(value);
}
