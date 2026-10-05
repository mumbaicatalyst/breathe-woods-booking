# Breathe Woods production launch checklist

This checklist is for the first public launch with manual payment confirmation. Complete it before enabling the public booking links.

## 1. Existing bookings reconciliation — launch blocker

- [ ] Get Prashant's current booking source: Google Calendar export, sheet, screenshots, or a combination.
- [ ] Copy every active or future stay into [`existing-bookings-import-template.csv`](./existing-bookings-import-template.csv).
- [ ] Mark each record as `confirmed_guest`, `tentative_guest`, or `owner_use`.
- [ ] Map each stay to `zen`, `bougan`, or `entire_property`; record the number of rooms whenever known.
- [ ] Treat unclear room allocation as `needs_review`; do not guess.
- [ ] Reconcile check-in/check-out dates with Prashant. Check-out must not block the following night's arrival.
- [ ] Import confirmed guest stays without guest-facing notification emails.
- [ ] Import owner use and unresolved records as availability blocks until room allocation is confirmed.
- [ ] Compare the resulting owner calendar to Prashant's source calendar and obtain his sign-off.

## 2. Production configuration — launch blocker

- [ ] Create or confirm a separate production Supabase project. Do not reuse UAT data or credentials.
- [ ] Apply the reviewed database migrations and production daily-rate calendar.
- [ ] Create Prashant's production owner profile and test owner sign-in with a non-owner account as a negative test.
- [ ] Configure the final production website and owner dashboard URLs in Supabase Auth redirect settings.
- [ ] In Netlify, set only `VITE_APP_ENV=production`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Never add a service-role key.
- [ ] Build the booking app with `VITE_APP_BASE_PATH=/book/` and serve it under `breathewoods.com/book/`.
- [ ] Add a Netlify redirect so `/book/*` serves the booking application's `index.html`, including `/book/owner`.

## 3. Guest and owner workflow — launch blocker

- [ ] Test request submission from desktop and mobile.
- [ ] Test unavailable rooms, room blocks, overlapping dates, full villas, and full-property bookings.
- [ ] Test owner request review, alternative dates/stays, 12-hour manual payment hold, confirmation, expiry, and cancellation.
- [ ] Confirm pricing remains frozen for submitted requests and payment holds after an owner changes rates or campaigns.
- [ ] Confirm the cancellation guidance is correct for ordinary, long-weekend, festive, full-villa, and group stays.
- [ ] Confirm privacy, marketing-consent, and cancellation links open without losing booking progress.

## 4. Notifications and operating process — launch blocker

- [ ] Switch Make.com owner notification recipient and sender to `breathewoods@gmail.com`.
- [ ] Update the dashboard URL in Supabase `booking_app_url` to the live `/book/owner` address.
- [ ] Test the owner request email and guest confirmation email from production-style data.
- [ ] Confirm Make failures are visible and that queued notification rows can be retried.
- [ ] Agree a daily owner routine: review requests, action holds, confirm manual payments, and process cancellations/refunds.

## 5. Security and resilience — launch blocker

- [ ] Add public-request rate limiting and a bot-control challenge such as Turnstile before sharing the booking form widely.
- [ ] Configure HTTPS, security headers/CSP, and a restrictive production Supabase CORS/Auth configuration.
- [ ] Re-run dependency audit with working network access and resolve high-severity findings.
- [ ] Verify no production secret is present in the website repository, browser configuration, screenshots, or Make webhook URLs.
- [ ] Run the final Security Review before deploying.

## 6. First-week follow-up

- [ ] Add Google Analytics and booking-funnel analytics.
- [ ] Confirm Google Calendar view-only sync once the production calendar connection is ready.
- [ ] Review conversion, abandoned requests, pending payments, and owner response times after the first week.
