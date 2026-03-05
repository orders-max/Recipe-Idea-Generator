# Dinner/Supper Recipe Idea Generator (Mobile-Friendly)

This app gives you **dinner/supper recipe ideas on your phone** using real recipes from existing sources via [TheMealDB](https://www.themealdb.com/).

## What this app guarantees

- ✅ It **does not invent recipes**.
- ✅ It only shows recipe results that include a **source link** (original source, YouTube, or TheMealDB recipe page).
- ✅ Ingredient measurements are shown in **metric where possible** (e.g., cups/tbsp/oz converted to ml/g).
- ✅ It is responsive and easy to use on a phone screen.


## Home recommendations

- On first load, the app now shows up to **6 weeknight-friendly recommendations**.
- Recommendations pass strict weeknight pre-filters (protein-focused, budget-aware, niche/specialty exclusions unless explicitly requested).
- Cards are chosen with variety across proteins and meal formats where possible, in a **3 × 2 card grid** for mobile.
- Each card keeps a working source link (original source, YouTube, or TheMealDB page).
- If fewer than 6 strict matches are available, the app shows the best available set and explains that in the status message.

## Mobile filter chips (saved on your phone/browser)

Above results, the app now has quick filter chips:
- Under 30 min
- One-pot
- Budget mode
- Exclude seafood
- Comfort classics only
- Protein quick filters: chicken / beef / pork / turkey / sausage

These filters apply to both first-load recommendations and search results, and are persisted in `localStorage` so your choices stay on refresh.

## Search improvements

The app now uses an expanded search strategy so queries such as:
- `pasta with chicken`
- `ground beef`

work better by trying:
1. direct full-text search,
2. keyword and phrase variations,
3. ingredient-based matching with fallback lookups.
4. ingredient-intent ranking so multi-ingredient searches (e.g. `chicken pasta`, `rice ground beef`) prioritize recipes containing all requested ingredients.
5. strict multi-ingredient intent mode: when multiple ingredients are requested, the app now avoids showing unrelated single-ingredient results; if no exact linked match exists in the source dataset, it tells you clearly instead of showing mismatched recipes.



## Empty-state help

When strict filters remove all matches, the app now shows:
- a short reason
- 2–3 quick suggestions to broaden results
- a one-tap **Show relaxed matches** button to temporarily relax strict filtering

## Weighted ranking + debug toggle

Search ranking now uses weighted scores in `app.js` under `RANKING_CONFIG`:
- familiarity
- budget proxy
- simplicity
- query intent

For development debugging, set `RANKING_CONFIG.debugScoreBreakdown = true` to log score breakdown tables in the browser console.

## Editing allow/block filter lists

The strict weeknight pre-filters live in `app.js` under:

- `RECIPE_FILTER_CONFIG.allowedProteinTerms`
- `RECIPE_FILTER_CONFIG.blockedExpensiveTerms`
- `RECIPE_FILTER_CONFIG.blockedNicheTerms`
- `RECIPE_FILTER_CONFIG.preferredDinnerFormats`

You can edit these arrays directly to tune which recipes are included/excluded.


## If merges break JavaScript

If you see errors like `Uncaught SyntaxError: missing ) after argument list` after merging a PR, it is usually because a manual conflict resolution introduced invalid JavaScript or left partial edits in `app.js`.

Quick checks after resolving conflicts:

```bash
node --check app.js
rg -n "<<<<<<<|=======|>>>>>>>" app.js index.html styles.css README.md
```

If either check fails, fix the conflict result before pushing.

Also, `chrome-extension://...` errors (for example from extensions like intent reporters) are browser-extension errors, not app code errors.

## Quick start (on your computer)

1. Open a terminal in this project folder.
2. Start a local web server:

```bash
python3 -m http.server 8080
```

3. Open in your browser:

```text
http://localhost:8080
```

## Run it on your phone (easy options)

### Option A: Same Wi-Fi (fastest)

1. On your computer, run:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

2. Find your computer's local IP address (example `192.168.1.20`).
3. On your phone (same Wi-Fi), open:

```text
http://YOUR_COMPUTER_IP:8080
```

Example: `http://192.168.1.20:8080`

### Option B: Publish free with GitHub Pages (works anywhere)

1. Push this project to a GitHub repo.
2. In GitHub: **Settings → Pages**.
3. Set source to **Deploy from branch** and choose `main` + `/ (root)`.
4. Save.
5. Open the Pages URL on your phone (e.g. `https://yourname.github.io/your-repo`).

## Notes

- Recipe data comes from TheMealDB API; links are resolved to original source URL, YouTube, or the meal page on TheMealDB when needed so every card has a clickable recipe link.
- If a search has no linked results, try broader ingredient names (for example `beef`, `chicken`, `pasta`, `curry`).
