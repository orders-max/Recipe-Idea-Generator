# Dinner/Supper Recipe Idea Generator (Mobile-Friendly)

This app gives you **dinner/supper recipe ideas on your phone** using real recipes from existing sources via [TheMealDB](https://www.themealdb.com/).

## What this app guarantees

- ✅ It **does not invent recipes**.
- ✅ It only shows recipe results that include an **external source link** (website or video).
- ✅ Ingredient measurements are shown in **metric where possible** (e.g., cups/tbsp/oz converted to ml/g).
- ✅ It is responsive and easy to use on a phone screen.

## Search improvements

The app now uses an expanded search strategy so queries such as:
- `pasta with chicken`
- `ground beef`

work better by trying:
1. direct full-text search,
2. keyword and phrase variations,
3. ingredient-based matching with fallback lookups.

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

- Recipe data comes from TheMealDB API and includes source links from their dataset.
- If a search has no linked results, try broader ingredient names (for example `beef`, `chicken`, `pasta`, `curry`).
