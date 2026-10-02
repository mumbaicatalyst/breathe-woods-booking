# UAT database setup

Apply the migrations in this exact order from Supabase **SQL Editor**:

1. `supabase/migrations/202610020001_booking_foundation.sql`
2. `supabase/migrations/202610030001_breathe_woods_uat_configuration.sql`

The second migration adds Breathe Woods’ two villas, five rooms, resource relationships, initial rate plans/rates, add-ons and configurable commercial defaults. It does **not** add fake guest reservations, payment records or owner accounts.

## Important UAT assumptions embedded in the configuration

- Zen 1/Zen 2 and Bougan'villa 1–3 are treated as individual two-person rooms.
- Weekday room rates are seeded Sunday–Thursday at the owner-provided solo rate; the exact final room/occupancy eligibility remains configurable.
- The four-night room-weekend rule is stored as a working assumption, awaiting final owner confirmation.
- Pets carry no fee or deposit.
- Children aged 0–6 are free but all children count toward physical capacity.
- PhonePe-related configuration is not seeded; credentials remain outside the database migration.
