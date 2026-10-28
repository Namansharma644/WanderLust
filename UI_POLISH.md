# WanderLust UI polish

> The subsequent [discovery features stage](DISCOVERY_FEATURES.md) builds on this design. It adds pagination, device-local saved stays, review summaries, location links and related stays; its behavior supersedes the earlier full-list/default-order checks below.

The original `Namansharma644/WanderLust` project now has a cohesive, warm travel-discovery interface. The terracotta brand accent is retained with improved contrast, a quieter neutral palette, consistent controls and responsive page layouts. This is an Express/EJS/Bootstrap presentation update, not a framework migration.

Work is in `/workspace/WanderLust-original-ui`, based on GitHub main `1adf914a4ffdb2b374abedd018443fa51991b0ee`. The Windows folder was not accessible from the cloud environment. The separate reference repository was not used. The older redesigned checkout in `/workspace/WanderLust` was preserved.

## What changed

- A new editorial hero with original local coastal artwork, a working destination search and an anchor to the stays section.
- Cleaner, responsive navigation and genuine footer links to existing pages.
- A single price/sort toolbar, retained query values, accurate result counts, clear filters and useful empty/no-result states.
- Consistent listing image proportions, destination/title/price hierarchy and restrained card interactions. Stored photo URLs are preserved; failed requests receive a clearly labelled local fallback.
- Wider property detail layouts, readable descriptions, property facts, actual review ratings and existing owner/review controls.
- Consistent create/edit forms, required-field feedback, cancel links and a browser-only selected-photo preview. Multipart actions, field names and existing validation constraints remain intact.
- Login/signup layouts, accessible password visibility controls and focused invalid-field feedback.
- Accessible local SVG icons, a locally hosted copy of the existing Plus Jakarta Sans family, a skip link, visible keyboard focus and reduced-motion support. The font's SIL Open Font License is included.
- Existing visual-only category selectors and temporary wishlist hearts were removed rather than presented as working features. No category or wishlist backend exists in the original schema/controllers. Existing tax information remains available under the accurately worded “Show tax information” switch.
- Dead privacy/terms/social placeholder links were replaced with navigation to real existing routes. No booking, payment, host-contact or invented rating functionality was added.

## Files in this UI stage

| Area | Files |
| --- | --- |
| Styling and browser behavior | `public/css/style.css`, `public/js/script.js` |
| Shared templates | `views/layouts/boilerplate.ejs`, `views/includes/nav.ejs`, `footer.ejs`, `flash.ejs`, new `icon.ejs` |
| Listing templates | `views/listings/index.ejs`, `show.ejs`, `new.ejs`, `edit.ejs`, `err.ejs` |
| Authentication templates | `views/user/login.ejs`, `views/user/singUp.ejs` |
| Local assets | `public/images/escape-illustration.svg`, `photo-unavailable.svg`, `favicon.svg`, `public/fonts/plus-jakarta-sans.ttf`, `OFL-PlusJakartaSans.txt` |
| Verification and notes | `tests/listing-search.readonly.cjs` (three whitespace-tolerant HTML assertions), `SEARCH_FILTERS.md` (stage note), this file |

There were already seven pending search/filter files when this stage started. They remain part of the complete review package, including the previously prepared controller/helper/unit tests. This UI stage did not change that backend logic. See [SEARCH_FILTERS.md](SEARCH_FILTERS.md) for its query contract and safety checks.

All 20 backend/model/route/configuration/initialization/dependency files present at the start of this UI stage were hash-checked and remained unchanged. No dependencies or lockfile changes were introduced. No records were seeded, created, updated or deleted. Existing startup was inspected before running; the destructive `init/index.js` was **not** executed.

## Run locally

Use Node.js 22 LTS and your project's existing private environment configuration. This original application reads `ATLASDB_URL` (without an underscore between ATLAS and DB), plus its existing session/upload settings. Do not substitute the reference repository's configuration or commit `.env`.

```powershell
cd "C:\Users\Lenovo\OneDrive\web development sigma\Major Project 1"
npm ci --legacy-peer-deps
node app.js
```

The peer-dependency flag accommodates the repository's existing Cloudinary package combination. It does not change the lockfile.

Open `http://localhost:8080/listings`. There is no `dev` or `start` npm script in this original package.json; use `node app.js`.

## Verification

```sh
node --test tests/listing-search.test.js
```

For an **already populated local development** MongoDB instance only:

```sh
node tests/listing-search.readonly.cjs --development-only
```

That verifier refuses remote/production databases, disables automatic collection/index creation in its own process, guards record writes, uses in-memory sessions, and checks listing hashes before and after. It never creates sample listings or test accounts. Run it against an existing safe development configuration.

Recorded results on the completed UI:

- Six query unit tests passed.
- Seventeen valid HTTP search/filter/sort cases passed, including full/partial title, location, country, no matches, combined bounds, inclusive boundaries, empty values, literal regex characters and both price orders. Ten malformed-query cases returned HTTP 400 as expected.
- Retained values, escaped output, clear filters, original default record IDs/order, homepage redirect, detail/authentication pages, authentication guard and authenticated create/edit page rendering passed.
- Thirty-two responsive page checks passed: listings, details, login, signup, create, edit, no results and invalid-query feedback at 320, 375, 768 and 1440 pixels. No horizontal overflow, unnamed buttons, nested interactive elements, dead `#` links or missing local images were found.
- Browser interactions passed for both searches, prices/sorting, clearing, mobile navigation, tax information, keyboard skip navigation, password visibility, invalid-form focus/feedback, selected-photo preview/reset, rating selection and existing owner/review actions. Invalid submissions were blocked; no successful mutation requests were sent.
- Authentication flash feedback displayed and dismissed correctly. The true empty-data template state rendered correctly without changing database contents. Login/signup/create/edit form methods, action URLs, encoding, field names/types and original validation constraints matched the pre-polish templates.
- Reduced-motion behavior passed. No browser JavaScript errors or unexpected failing local assets/pages were recorded.
- Axe-core 4.10.3 WCAG 2/2.1 A/AA scans reported zero automated violations across eight page states at mobile and desktop widths. Some image/gradient/browser-control contrast checks require human review; this is not a claim of complete accessibility certification.
- Every listing document retained its original hash, and no database record write was attempted during verification. Verification used 61 records already present before this UI request.
- All EJS templates compiled, browser JavaScript syntax checked, and the diff passed whitespace checks.

Browser checks used a temporary Playwright/Chromium environment outside the repository; no browser-test dependency was added to the application. Screenshots and JSON results accompany the review package. Bootstrap's existing exact CDN version was served from a verified local test cache because the cloud network blocks some external hosts; application Bootstrap URLs remain unchanged.

## Limits and deployment

- The live Render domain was blocked by this cloud network, so live inspection/deployment verification was unavailable.
- External Unsplash photos were blocked here. Screenshots show the labelled fallback; original valid URLs and database image fields were not replaced. Original local artwork provides a reliable hero independently of those photo requests.
- Real password authentication, successful uploads, and create/edit/delete/review/account submissions were not performed. They require private credentials and would change data. Authenticated page checks used a temporary memory-only session for an existing development owner.
- Nothing from this task has been committed, pushed or deployed. The live service is not claimed to be updated. Review the package before approving a push and an update to the existing Render service.

After approval, recheck GitHub main for intervening changes, preserve any new work and update only the existing service. Verify the deployed pages and search/filter behavior before reporting success at `https://wanderlusts-kjty.onrender.com/listings`.
