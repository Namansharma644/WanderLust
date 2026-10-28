# Search and price filters without changing the existing design

> This documents the earlier search-only stage. The subsequent, explicitly requested UI polish retains this search implementation and is described in [UI_POLISH.md](UI_POLISH.md). Its presentation changes supersede the appearance comparisons recorded below.

> [DISCOVERY_FEATURES.md](DISCOVERY_FEATURES.md) documents the current pagination and saved-stay extensions. Search and price semantics remain unchanged; results now have 12 items per page with stable ordering.

Base: GitHub `main` commit `1adf914a4ffdb2b374abedd018443fa51991b0ee` (`polised ui`).
Working branch: `feature/search-filters-preserve-ui`.

## Changes

- `controler/listing.js`: only the index action now validates search parameters and uses MongoDB search/price predicates and optional price sorting. Other controller actions are unchanged.
- `util/listingSearch.js`: allowlisted scalar query parsing, literal regex escaping, inclusive price bounds, reversed-range rejection, and optional deterministic sorting.
- `views/includes/nav.ejs`: retains the current search term and active prices/sort when using the existing navbar search box. Other navigation markup and styling remain unchanged.
- `views/listings/index.ejs`: connects the existing hero search; adds minimum/maximum price and sort inputs using the existing `wl-form-label`, `wl-form-input`, `wl-btn`, and Bootstrap grid classes; retains values and provides clear-filter/no-result feedback. Existing hero, cards, category buttons, wishlist behavior, tax toggle and footer are retained.
- `tests/listing-search.test.js`: six database-independent unit tests.
- `tests/listing-search.readonly.cjs`: explicit, local-only, read-only HTTP verification against existing data, with in-memory sessions and database-write guards.
- This file.

CSS, client JavaScript, images, models, database configuration, application startup, middleware, route definitions, authentication, upload logic, package.json and package-lock.json are unchanged. No dependencies were added. No records were seeded, updated, overwritten or deleted.

The repository did not previously paginate its listing results, so this patch retains that behavior and the original default card order. It does not introduce pagination or silently truncate results.

The existing category buttons are visual controls and the model has no category field. This search-only patch leaves them unchanged; it does not claim to implement category filtering. Country is searchable through the existing country field.

## Queries

- `/listings?q=Manali` searches title, location and country, case-insensitively.
- `/listings?minPrice=1000&maxPrice=3000` applies inclusive INR-per-night bounds.
- `/listings?q=Manali&minPrice=1000&maxPrice=3000&sort=price_asc` combines the controls.
- Supported sorting: `default`, `price_asc`, `price_desc`. `default` preserves the existing unsorted query behavior.
- Empty search and price values act as unset values. Clear filters returns to `/listings`.
- Invalid/repeated/nested values, unsupported sort values, negative or non-finite prices, a search over 100 characters, and reversed price ranges return HTTP 400 through the existing error template.

## Run

Use your existing private `.env` and database settings. Do not replace them with another machine's settings or commit them.

```sh
npm ci --legacy-peer-deps
node app.js
```

The legacy peer-dependency installation option is needed by the existing Cloudinary package combination; dependencies and the lockfile were not changed.

## Verify

```sh
node --test tests/listing-search.test.js
```

For an already populated **local development** database, run explicitly:

```sh
node tests/listing-search.readonly.cjs --development-only
```

The HTTP verifier reads ATLASDB_URL privately, refuses production mode and remote databases, disables automatic collection/index creation in its own test process, blocks model record-write operations, uses in-memory sessions, and intercepts the unchanged app's listening port only in the verifier to choose an available local port. It does not alter application/database configuration files or create test users or listings. Authenticated form rendering uses a temporary in-memory test session for an existing development owner; it does not validate a real password login. Listing document hashes are checked before and after.

The repository's original `npm test` placeholder was intentionally left unchanged. Use the explicit commands above.

Recorded results:

- Six unit tests passed.
- Seventeen valid search/filter/sort cases passed against 61 pre-existing local development listings, with exact rendered IDs checked against independently computed expectations.
- Ten malformed-input cases returned HTTP 400 as expected.
- Selected values, escaped output, clear-filter links, default listing order and the original homepage redirect passed.
- Listing detail, login/signup, authentication guard and authenticated create/edit form rendering passed.
- Browser comparisons at 375, 768 and 1440 pixels found unchanged computed colors, typography, spacing, navigation, hero, cards and footer styles, unchanged default card IDs/order, and no additional page overflow.
- Browser interactions passed for both search boxes, combined prices/sort, retained values, clearing, mobile navigation, password visibility, and the pre-existing tax/wishlist interactions. No browser JavaScript errors were recorded.
- All existing listing hashes remained identical and no database record-write operation was attempted by the verification harness.

Limitations:

- Successful login with real credentials and successful create/edit/delete submissions were not performed, respecting the instruction against database record writes.
- A separate multipart upload diagnostic reached Cloudinary and returned `Must supply api_key` (HTTP 500) because development credentials are absent. No record was created. The existing upload implementation was left unchanged.
- Some external photos, icons and fonts are blocked by the cloud network policy. Their original URLs and all CSS remain unchanged. During browser comparisons, Bootstrap's original version was served from a byte-identical, checksum-verified local test cache; application asset files were not changed.
- The Windows folder is not directly accessible from this cloud task. Changes are in `/workspace/WanderLust-original-ui`; the earlier `/workspace/WanderLust` checkout and its pre-existing edits are untouched.

## Deployment status

Nothing has been committed, pushed or deployed for this request. The prepared diff contains only the seven files listed above. Review it before approval. Before any push, recheck the current GitHub main tip and reconcile any newer commits without overwriting user work or using a force push.

After approval, commit/push the search-only changes and update the **existing** Render service. A push may deploy automatically only if that service is configured to follow the relevant GitHub branch. Otherwise its existing dashboard/API access is needed for deployment. Do not create another service.

Deployment is not complete until the existing application responds and the deployed search/filter behavior is verified at `https://wanderlusts-kjty.onrender.com/listings`.
