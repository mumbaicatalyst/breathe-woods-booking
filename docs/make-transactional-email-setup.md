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
| `APP_URL` | `http://127.0.0.1:5173` |
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

### Owner: new request

**Subject:** New reservation request — `{{reference}}`

Include guest name, email, phone, dates, stay, party breakdown, meal plan, requested add-ons, estimated total, and a **Review request** link to `{{APP_URL}}{{dashboard_path}}`.

### Guest: booking confirmed

**Subject:** Your Breathe Woods stay is confirmed — `{{reference}}`

Thank the guest, confirm dates/stay/party and paid total, state that payment has been received, include the cancellation terms link, and give the Breathe Woods contact details for arrival questions.

## Production switch: no code changes

Before launch, update only the Make scenario variables and Gmail connection:

| Setting | Production value |
| --- | --- |
| `OWNER_EMAIL` | `breathewoods@gmail.com` |
| `APP_URL` | The final public booking-app URL |
| Gmail sender | `breathewoods@gmail.com` connected to Make |

The dashboard URL is assembled by Make from `APP_URL` and the database-provided path, so the templates do not need editing when moving to Netlify. Test both email routes after the switch.
