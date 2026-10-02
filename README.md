# Breathe Woods Booking

The production booking application for Breathe Woods. It replaces the static pricing/calendar demo; it does not reuse demo reservations, mock payments or public dashboard controls.

## One application, two protected experiences

- `/` (or `/book`) is the guest booking flow, opened from the marketing website as a full-page fallback or branded overlay.
- `/owner` is the future authenticated owner/manager dashboard.

They share one reservation, inventory, pricing and payment system in Supabase. They are not the same screen and guests never access owner controls.

## Environments and branches

```text
feature/* → develop (UAT) → main (production)
```

Use separate Supabase projects, notification recipients and payment-provider credentials for UAT and production. Never place provider secrets in this repository or a browser environment variable.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add only the UAT Supabase project URL and anon key once available.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Database

The first UAT migration is in `supabase/migrations/202610020001_booking_foundation.sql`. It establishes the shared resource model, reservations, allocations, price snapshots, payments, audit log and database-level allocation conflict guard.

Do not apply it to production until the UAT build and migration have been tested.

## Payment integration

The application will use a provider adapter. PhonePe is the first adapter and Razorpay can be added later without changing booking, inventory, pricing or dashboard code. PhonePe merchant UAT credentials and Payment Links API approval are still required before real integration testing.

## Current build stage

The repository contains a deliberately clean shell, not a fake functional hotel system:

- no seeded bookings or calendar entries;
- no browser-side price calculation presented as authoritative;
- no public owner dashboard;
- no simulated payment success;
- no live Supabase or PhonePe connection yet.

The next implementation milestone is UAT Supabase connection, role/auth setup and server-side availability/pricing services.
