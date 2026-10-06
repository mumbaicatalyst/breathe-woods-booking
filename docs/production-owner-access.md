# Production owner dashboard access

Production uses invite-only Supabase Auth plus an explicit `owner_profiles` allow-list. The role model is:

| Person | Email | Production role | Access |
| --- | --- | --- | --- |
| Prashant | `sanil.prashant@gmail.com` | `owner` | Read and operate the dashboard |
| Faraz | `farazdakh@gmail.com` | `manager` | Read and operate the dashboard |
| Any future read-only user | — | `viewer` | Read-only dashboard access |

Owner and manager have the same operational permissions in the current small-property setup. A viewer can inspect the calendar, requests, rates and management summary but cannot change pricing, blocks, reservations, payment instructions, campaigns or experiences.

## Production setup

1. Create or invite both email accounts in the **production** Supabase project's Authentication → Users section. Do not create these profiles in UAT by accident.
2. After both accounts exist, run this in the production SQL Editor. It is intentionally not a migration because it depends on the Auth user IDs created by that production project:

```sql
insert into public.owner_profiles (user_id, property_id, role)
select u.id, p.id,
  case u.email
    when 'sanil.prashant@gmail.com' then 'owner'::public.dashboard_role
    when 'farazdakh@gmail.com' then 'manager'::public.dashboard_role
  end
from auth.users u
cross join public.properties p
where p.name = 'Breathe Woods'
  and lower(u.email) in ('sanil.prashant@gmail.com', 'farazdakh@gmail.com')
on conflict (user_id) do update
set property_id = excluded.property_id,
    role = excluded.role;
```

3. Verify the result before sharing the dashboard URL:

```sql
select u.email, op.role, p.name as property
from public.owner_profiles op
join auth.users u on u.id = op.user_id
join public.properties p on p.id = op.property_id
where lower(u.email) in ('sanil.prashant@gmail.com', 'farazdakh@gmail.com');
```

4. Add only the production `/book/owner` URL to the production Supabase Auth redirect allow-list. Keep UAT redirects in the UAT project only.

## Role negative test

Create a temporary production `viewer` profile only if a read-only test account is available. Confirm that the account can load the dashboard but receives a permission error when attempting to create a guest booking, save payment instructions, create an availability block, hold a reservation, change rates, publish a campaign or edit an experience. Remove the temporary profile after the test.

The security-definer owner write functions were hardened in the reviewed migration files. For the existing UAT database, re-run these files in this order so the later guest-experience definitions remain authoritative: `202610050020_reservation_request_workflow.sql`, `202610050021_owner_inventory_blocks.sql`, `202610050027_owner_alternative_stay_workflow.sql`, `202610060037_guest_experience_selection.sql`, `202610060038_owner_assisted_bookings.sql`, and `202610060039_owner_payment_instructions.sql`; then apply `202610060041_rpc_hardening.sql`. For a new production database, apply the migrations in filename order, skip the UAT-only payment simulator migration `202610040017_uat_payment_simulation.sql`, apply `202610060040_production_hardening.sql` last, and apply `202610060041_rpc_hardening.sql` as well.
