# Breathe Woods transactional email setup

## What is sent

Only two automatic emails are used initially:

1. **New reservation request → owner.** Sent to `farazdakh@gmail.com` during UAT, then changed to `breathewoods@gmail.com` for production.
2. **Confirmed booking → guest.** Sent only after the reservation status becomes `confirmed` following payment confirmation.

There are deliberately no automated cancellation, change-request or owner-confirmation emails in this first release.

## Why Make is in the middle

Supabase creates a secure `notification_outbox` row after each relevant booking event. A Supabase Database Webhook forwards that row to a Make custom webhook. Make formats the correct email, sends it through Gmail, and updates the row to `sent`. No Gmail credential or email-sending secret is ever placed in the website.

## UAT settings

Use these Make scenario variables while testing:

| Variable | UAT value |
| --- | --- |
| `OWNER_EMAIL` | `farazdakh@gmail.com` |
| Gmail sender | The connected test Gmail account |

The local dashboard link works only on the computer running the booking app. That is expected during UAT.

## Make scenario

1. Create a new scenario with **Webhooks → Custom webhook** as the trigger.
2. In Supabase, create a Database Webhook for `INSERT` events on `notification_outbox`, pointing to that Make webhook URL.
3. Add a router using `record.event_type`:
   - `owner_request_received`: Gmail **Send an email** to `OWNER_EMAIL`.
   - `guest_booking_confirmed`: Gmail **Send an email** to `record.recipient_email`.
4. After a successful Gmail send, update the matching `notification_outbox` row through the Supabase module: set `delivery_state` to `sent`, `sent_at` to the current time, and record the Gmail message ID when available.
5. On a failed send, update that row to `failed` and save the error text. Do not silently discard it.

## Email content

The database generates both polished HTML emails. In Make, map only these two fields:

| Route | Gmail subject | Gmail HTML content |
| --- | --- | --- |
| `owner_request_received` | `record.payload.email.owner.subject` | `record.payload.email.owner.html` |
| `guest_booking_confirmed` | `record.payload.email.guest.subject` | `record.payload.email.guest.html` |

Set the Gmail module's content type to **HTML**. The templates include the reservation reference, guest/stay details, formatted total and, for the owner, a dashboard button.

## Production switch: no code changes

Before launch, update only the Make scenario variables and Gmail connection:

| Setting | Production value |
| --- | --- |
| `OWNER_EMAIL` | `breathewoods@gmail.com` |
| Gmail sender | `breathewoods@gmail.com` connected to Make |

The dashboard URL comes from the Supabase `booking_app_url` setting. Update that one value from the local URL to the final public booking-app URL before launch; the templates do not need editing. Test both email routes after the switch.
