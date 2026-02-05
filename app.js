const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const recipeTemplate = document.getElementById("recipeTemplate");

searchBtn.addEventListener("click", () => loadRecipes(searchInput.value.trim()));
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadRecipes(searchInput.value.trim());
  }
});

loadRecipes("chicken");

async function loadRecipes(query) {
  const term = query || "dinner";
  setStatus(`Loading recipe ideas for “${term}”…`);
  resultsEl.innerHTML = "";

  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const allMeals = data.meals || [];

    const mealsWithLinks = allMeals.filter((meal) => meal.strSource || meal.strYoutube);

    if (!mealsWithLinks.length) {
      setStatus(
        "No linked recipes found for that search. Try another ingredient or dish name."
      );
      return;
    }

    mealsWithLinks.slice(0, 6).forEach((meal) => {
      resultsEl.appendChild(renderMeal(meal));
    });

    setStatus(
      `Showing ${Math.min(6, mealsWithLinks.length)} linked recipe idea(s). Ingredient amounts are shown in metric where possible.`
    );
  } catch (error) {
    setStatus(
      "Could not load recipes right now. Please check your connection and try again."
    );
    console.error(error);
  }
}

function renderMeal(meal) {
  const clone = recipeTemplate.content.cloneNode(true);

  clone.querySelector(".recipe-image").src = meal.strMealThumb;
  clone.querySelector(".recipe-image").alt = meal.strMeal;
  clone.querySelector(".recipe-title").textContent = meal.strMeal;
  clone.querySelector(
    ".recipe-meta"
  ).textContent = `${meal.strCategory} • ${meal.strArea}`;

  const ingredientList = clone.querySelector(".ingredients");
  getIngredients(meal).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    ingredientList.appendChild(li);
  });

  const stepsList = clone.querySelector(".steps");
  splitInstructions(meal.strInstructions).forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    stepsList.appendChild(li);
  });

  const sourceLink = clone.querySelector(".source-link");
  sourceLink.href = meal.strSource || meal.strYoutube;

  return clone;
}

function getIngredients(meal) {
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

function splitInstructions(instructionsText = "") {
  return instructionsText
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 12);
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

  if (!conversion) {
    return measure;
  }

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

function setStatus(message) {
  statusEl.textContent = message;
}
