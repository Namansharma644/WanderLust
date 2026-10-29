# Bulk demo listings for WanderLust

This package contains 32 realistic **fictional demonstration** stays for the college project. Destinations include Manali, Shimla, Mussoorie, Nainital, Goa, Jaipur, Udaipur, Jaisalmer, Rishikesh, Varanasi, Darjeeling, Munnar, Mumbai, Delhi, Bengaluru, Hyderabad, Bali, Kyoto, Interlaken and Lisbon. Nightly prices range from INR 800 to INR 25,000.

Each description identifies the accommodation as project demo data with illustrative photos. No users, reviews, ratings, bookings or availability are fabricated. Only existing schema fields are used. The owner is an actual existing account; the requested live owner is **rohit**.

The existing application uses `ATLASDB_URL` in its private environment configuration. This script reads the same value and never prints the URI or changes configuration. The target must be the same Atlas database used by the existing Render service for these listings to appear on the live website. Adding records to an unrelated local database will not populate Render.

## Install the files

The files are included in the original GitHub repository. Update your original project with a normal fast-forward pull; no ZIP download is needed. Preserve unrelated local changes and resolve any Git warning before proceeding. These are new files only; no existing UI, routes, controllers, models, search logic, CSS, dependencies or configuration need changing.

```powershell
cd "C:\Users\Lenovo\OneDrive\web development sigma\Major Project 1"
git pull --ff-only origin main
```

Do not copy a connection string into chat or into these scripts. Use the original project's existing private `.env`. If dependencies are missing, install the project's existing dependencies with `npm ci --legacy-peer-deps`.

## Preview first: zero writes

The user has explicitly approved a live demo import. The live mode remains an explicit command-line choice and never runs on normal startup or deployment.

```powershell
node scripts/seed-demo-listings.cjs --live-demo --owner-username=rohit
```

The output identifies only the database name, owner and counts. It checks that `rohit` exists in that database. Review that the database is the one used by the live Render app. No connection URI/password is displayed. Preview performs no record writes.

## Insert the missing demo records

Replace `NAME_FROM_PREVIEW` below with the database name printed by the preview. It is the database name only, not a connection string.

```powershell
node scripts/seed-demo-listings.cjs --live-demo --owner-username=rohit --confirm-database=NAME_FROM_PREVIEW --insert
```

An empty target should report **Inserted 32 demo listings**. Existing records are kept. Fixed `_id` values in `demo-listings.json` make reruns idempotent: already present IDs are skipped, including records edited after an earlier import. There are no updates, upserts, replacements, deletes or resets. The script refuses system databases, mismatched confirmations and missing owners. The default is preview; no write occurs without `--insert`.

After a partial failure, the output reports the number inserted. Resolve connectivity privately and rerun the exact command; already inserted IDs will be skipped. The script does not roll back by deleting records.

No code deployment is needed to make new database records visible when the script connects to the same Atlas database as Render. Refresh the listings page after insertion. Do not run the original `init/index.js`, which deletes listings.

For an isolated development database, substitute `--development-only` for `--live-demo`. That mode refuses a production environment and production-labelled databases; remote development names must contain a dev/test/sandbox token.

## Verify in the live browser

The following counts are **seed contributions only**; existing listings may add matches. Listings paginate at 12 per page.

| Check | URL | Expected demo matches |
| --- | --- | ---: |
| Full title | https://wanderlusts-kjty.onrender.com/listings?q=Mountain%20View%20Cabin%20in%20Old%20Manali | 1 |
| Partial title | https://wanderlusts-kjty.onrender.com/listings?q=Mountain%20View%20Cabin | 2 |
| Location | https://wanderlusts-kjty.onrender.com/listings?q=Manali | 4 |
| Location | https://wanderlusts-kjty.onrender.com/listings?q=Goa | 3 |
| Search + price range | https://wanderlusts-kjty.onrender.com/listings?q=Manali&minPrice=1000&maxPrice=3000 | 2: INR 1,200 and INR 2,800 |
| Inclusive lower boundary | https://wanderlusts-kjty.onrender.com/listings?minPrice=800&maxPrice=800 | 1 |
| Inclusive upper boundary | https://wanderlusts-kjty.onrender.com/listings?minPrice=25000&maxPrice=25000 | 1 |
| No matching demo title/location | https://wanderlusts-kjty.onrender.com/listings?q=__no_match_demo_2026__ | 0 |
| Ascending price | https://wanderlusts-kjty.onrender.com/listings?sort=price_asc | Nondecreasing nightly prices across pages |
| Clear filters | https://wanderlusts-kjty.onrender.com/listings | All existing + inserted records across pages |

Also open a detail page, try saving a stay and inspect related stays. Reviews correctly remain “No reviews yet” until genuine reviews exist.

## Validation and safety tests

```powershell
node scripts/seed-demo-listings.cjs --validate-only
node --test tests/demo-seed.test.js
```

All 32 fixtures pass the unchanged Mongoose model and Joi form validation offline. Six tests pass for fixture validation, strict options/explicit write confirmation, database safeguards, zero-write preview, add-only idempotency/preservation and duplicate-race/failure handling. In-memory model doubles verify inserts without writing test records into any database.

A real preview against the pre-existing local onboarding database found all 32 stable IDs already present and performed zero writes. That is not a live import or a live verification. Production insertion has not been performed from this cloud workspace because no live database credentials or Render shell access are available here. The Windows folder is not accessible to this agent.

Photo URLs use HTTPS Unsplash accommodation images. The cloud environment blocks those hosts, so current external-photo availability could not be confirmed. No stored photos on existing listings are replaced. Existing application fallbacks handle failed image requests.
