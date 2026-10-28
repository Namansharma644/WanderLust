# WanderLust discovery features

The existing polished Express/EJS application now has database pagination, device-local saved stays, computed review summaries, location links, related listings and native-form submission feedback. The existing terracotta palette, typography, page layouts and base stylesheet are retained. No models, database configuration, credentials, dependencies or existing records were changed.

The cloud working copy is `/workspace/WanderLust-original-ui`, based on `Namansharma644/WanderLust` main commit `1adf914a4ffdb2b374abedd018443fa51991b0ee`. The Windows directory is not accessible from this environment. Existing uncommitted search and UI work was preserved; the unrelated reference repository was not used. Nothing has been pushed or deployed.

## Behavior

- **Pagination:** `/listings` returns at most 12 results using MongoDB `countDocuments`, `skip` and `limit`. Pagination links preserve validated `q`, `minPrice`, `maxPrice` and `sort`. New searches/filters reset to the first page. `page` accepts positive scalar whole numbers up to 1,000,000; invalid/repeated/nested values return 400. Requests past the last page redirect to the last available page, or page one for an empty result. Default order is now stable `_id` ascending, with `_id` also breaking price-sort ties, to avoid pagination gaps caused by an unspecified database order.
- **Saved on this device:** real save/unsave buttons are siblings of card links, not nested interactive controls. `/listings/saved` reads up to 100 valid IDs from the browser's `wanderlust.savedStays.v1` localStorage key. It reloads current listing information through a bounded read-only endpoint, `/listings/saved/data?ids=...`, and renders values as text. Saves persist across reloads and update between tabs of the same browser. They do not sync across accounts, devices, browsers or different site origins. Clearing browser storage removes them.
- **Unavailable saves:** successfully confirmed missing IDs are removed from this device's collection with an explanatory message. Failed/timed-out requests preserve saves and provide a retry. Blocked/quota-limited storage is handled honestly; a failed write never marks a stay as saved. Invalid storage contents do not crash the page. The endpoint validates/deduplicates at most 100 hexadecimal ObjectIds and returns only public listing fields and summaries, with `Cache-Control: private, no-store`.
- **Reviews:** cards, saved cards and details use actual populated review documents. Averages use finite numeric ratings in the 1–5 range; dangling/null entries are ignored. Review count and rated-review count are tracked separately. No reviews shows “No reviews yet”; existing unrated reviews show “Not yet rated.” Averages are computed on reads, not saved as new database fields. Existing review submissions, deletion actions and authorization remain intact.
- **Maps:** detail pages open Google Maps with an encoded query from the existing location/country. The UI explicitly says the link shows an area, not a precise property address. No API key, paid service or embedded tracker is added.
- **Related stays:** detail pages show at most four other listings, prioritizing the same stored location before filling from the same country. Both queries are bounded; the current ID and already selected stays are excluded. The section is omitted when there are no matches. Invalid or unavailable detail IDs now return a useful 404 rather than rendering a missing document.
- **Submission feedback:** native POST form actions/encoding remain unchanged. A valid attempt displays “Please wait…” and blocks duplicate submit events. Cancelled attempts restore their controls, and browser-history return restores controls through `pageshow`. Invalid forms remain retryable and focus the invalid field. No fabricated success message or booking/payment flow is added.

## Files changed in this stage

| Area | Files |
| --- | --- |
| Backend | `controler/listing.js` (index/read-only saved/detail actions), `router/listing.js` (two GET routes before `/:id`), new `util/listingDiscovery.js` |
| Browser behavior | new `public/js/saved-stays.js`, additive submission guard in `public/js/script.js` |
| Presentation | additive styles in `public/css/style.css`; updates to `views/listings/index.ejs`, `show.ejs`, `views/includes/nav.ejs`, `icon.ejs`, `views/layouts/boilerplate.ejs` |
| New templates | `views/listings/saved.ejs`, `views/includes/listingCard.ejs`, `saveButton.ejs`, `reviewSummary.ejs`, `pagination.ejs` |
| Verification/docs | `tests/listing-discovery.test.js`, `tests/listing-discovery.readonly.cjs`, pagination-aware expectations in `tests/listing-search.readonly.cjs`, this file, stage notes in `UI_POLISH.md` and `SEARCH_FILTERS.md` |

The original polished stylesheet is a byte-for-byte prefix of the current stylesheet; feature styles are appended. Models, schema, app startup/configuration, authentication/review controllers and routes, middleware, upload configuration, packages/lockfile and initialization scripts are unchanged. Existing CRUD controller function bodies and mutation middleware are preserved. No record writes, seeding or migrations were performed. Destructive `init/index.js` was inspected and never executed.

## Run and check

Keep the existing private `.env` configuration. This original project reads `ATLASDB_URL`, not the reference repository's `ATLAS_DB_URL`.

```powershell
cd "C:\Users\Lenovo\OneDrive\web development sigma\Major Project 1"
npm ci --legacy-peer-deps
node app.js
```

Open `http://localhost:8080/listings`. There are no `start` or `dev` scripts in the original package.json.

```sh
node --test tests/listing-search.test.js tests/listing-discovery.test.js
node tests/listing-search.readonly.cjs --development-only
node tests/listing-discovery.readonly.cjs --development-only
```

The HTTP commands require an **already populated local development database**. They refuse remote/production databases, guard database writes, use in-memory sessions and verify listing hashes after testing. They never seed users, reviews or listings. The existing `npm test` placeholder is unchanged.

## Verification results

- Twelve unit tests passed for search/query safety, page validation/URL construction, pagination boundaries, actual-rating arithmetic, saved-ID validation and related filters.
- Existing 17 valid and 10 invalid search/filter cases passed with pagination-aware first-page expectations; auth guards and authenticated create/edit GET rendering passed.
- Fifteen exact-ID result pages across default and combined search/price/sort queries passed without duplicates or omissions. Out-of-range/empty-page redirects and malformed page inputs passed. The actual MongoDB query was observed using `limit(12)` and the correct `skip` offset.
- Saved endpoint ordering, normalization/deduplication, limits, missing IDs, response projection and actual available review summaries passed. Related queries, encoded map destinations and invalid/missing detail 404s passed.
- Forty-five responsive page checks passed across nine page states at 320, 375, 768, 1024 and 1440 pixels, with no horizontal overflow or unnamed/nested interactive controls.
- Browser tests passed for pagination/filter retention, saving without opening the card, save/unsave/reload persistence, same-browser cross-tab updates, unavailable records, malformed/blocked storage, failed writes, retry after request failure, the 100-stay limit, keyboard activation and safe DOM rendering of hostile text/image protocols.
- Submission feedback, duplicate prevention and cancelled-attempt restoration passed on login/signup/create/edit forms without sending successful POSTs. Invalid feedback, password visibility, mobile navigation and reduced-motion behavior remained working.
- Empty related results omit the section. No browser JavaScript errors were recorded. All templates compile and browser/server JavaScript syntax checks pass.
- Twenty mobile/desktop WCAG 2/2.1 A/AA scans reported zero automated violations. Accessibility results and screenshots are included in the review archive. Automated checks do not certify complete accessibility; image/gradient/browser-control contrast still requires human review.
- All 61 listing documents present before this stage retained their hashes, and the test harness recorded no attempted database record writes. The local database currently has **zero review documents**: nonzero/invalid/missing rating arithmetic is covered by isolated unit fixtures, not by inventing reviews or mutating the database.

Temporary Playwright/Chromium/axe tools live outside the application repository. No browser-test dependency was added. Browser checks served the exact existing Bootstrap version from a verified local test cache because some external domains are blocked here; production asset URLs are unchanged.

## Limits and optional schema work

- Successful real-password login, real uploads and successful account/listing/review mutations were not exercised because they require private credentials and would alter data. Read-only authenticated page checks used a temporary memory-only session for an existing development owner.
- External Unsplash hosts are blocked in this environment, so screenshots show labelled photo fallbacks. Stored photo URLs are preserved. No live deployment or live-site verification has been performed.
- Categories remain unimplemented: the current Listing model has no category field. A future version could add an optional allowlisted `category` field, category inputs and an “Uncategorized” fallback, with no automatic reassignment of existing records. That schema change requires separate approval.
- Account-synced saved stays would also require an approved persistence design. The shipped feature is explicitly device-local. Booking, payments, availability calendars, messaging and notifications are outside this change.

Review the source and patch before approving a GitHub push or an update of the **existing** Render service. Recheck upstream main first and preserve intervening changes. Only report a live update after deployment and verification succeed at `https://wanderlusts-kjty.onrender.com/listings`.
