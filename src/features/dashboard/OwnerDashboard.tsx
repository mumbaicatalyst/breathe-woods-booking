import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { appConfig, isSupabaseConfigured } from '../../lib/config'
import { supabase } from '../../lib/supabase'
import { OwnerOverview } from './OwnerOverview'
import { getOwnerCalendar, getOwnerOpenReservationRequests, getOwnerReservationAlternatives, getOwnerReservationDetail, offerAlternativeDates, offerAlternativeStay, ownerReservationAction, simulateUatSuccessfulPayment, type CalendarRow, type ReservationAlternative, type ReservationDetail, type ReservationRequestRow } from './calendar'

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
}

function formatInr(paise: number | null) {
  return paise === null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
}

function formatOwnerDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

export function OwnerDashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [dashboardView, setDashboardView] = useState<'overview' | 'reservations'>('overview')
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([])
  const [reservationRequests, setReservationRequests] = useState<ReservationRequestRow[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<ReservationDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)
  const [isUpdatingReservation, setIsUpdatingReservation] = useState(false)
  const [alternativeCheckIn, setAlternativeCheckIn] = useState('')
  const [alternativeCheckOut, setAlternativeCheckOut] = useState('')
  const [stayAlternatives, setStayAlternatives] = useState<ReservationAlternative[]>([])
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false)
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null)
  const [showInventoryLedger, setShowInventoryLedger] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [start, setStart] = useState(isoDate(startOfToday()))
  const [end, setEnd] = useState(isoDate(new Date(startOfToday().getTime() + 7 * 86400000)))

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session && dashboardView === 'reservations') void loadCalendar()
  }, [session, dashboardView])

  async function requestSignIn() {
    if (!supabase) return
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/owner',
        shouldCreateUser: false,
      },
    })
    setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
  }

  async function loadCalendar() {
    setIsLoading(true)
    setCalendarError(null)
    try {
      const [rows, requests] = await Promise.all([getOwnerCalendar(start, end), getOwnerOpenReservationRequests()])
      setCalendarRows(rows); setReservationRequests(requests)
    } catch (error) {
      setCalendarRows([])
      setReservationRequests([])
      setCalendarError(error instanceof Error ? error.message : 'Unable to load the calendar.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadBookingDetail(reservationId: string) {
    setIsLoadingDetail(true)
    setDetailError(null)
    try {
      const booking = await getOwnerReservationDetail(reservationId)
      setSelectedBooking(booking)
      setAlternativeCheckIn(booking.reservation.check_in)
      setAlternativeCheckOut(booking.reservation.check_out)
      void loadStayAlternatives(reservationId)
    } catch (error) {
      setSelectedBooking(null)
      setDetailError(error instanceof Error ? error.message : 'Unable to load booking details.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function loadStayAlternatives(reservationId: string) {
    setIsLoadingAlternatives(true)
    try {
      setStayAlternatives(await getOwnerReservationAlternatives(reservationId))
    } catch {
      setStayAlternatives([])
    } finally {
      setIsLoadingAlternatives(false)
    }
  }

  async function runWorkflowAction(action: 'start_conversation' | 'decline' | 'hold_for_manual_payment' | 'confirm_manual_payment' | 'cancel') {
    if (!selectedBooking) return
    const policy = selectedBooking.cancellation_policy
    const confirmation = action === 'cancel'
      ? `Cancel ${selectedBooking.reservation.reference}? ${policy?.message ?? 'Review the policy before continuing.'} Expected refund: ${formatInr(policy?.refund_paise ?? 0)}. Gateway charges may still be deducted where applicable.`
      : action === 'confirm_manual_payment'
        ? `Mark payment as received and confirm ${selectedBooking.reservation.reference}? This will block the stay inventory.`
        : undefined
    if (confirmation && !window.confirm(confirmation)) return
    setIsUpdatingReservation(true); setDetailError(null); setWorkflowMessage(null)
    try {
      await ownerReservationAction(selectedBooking.reservation.id, action)
      await Promise.all([loadBookingDetail(selectedBooking.reservation.id), loadCalendar()])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'We could not update this reservation.'
      setDetailError(errorMessage)
      if (/no longer available|just booked|rooms were just booked/i.test(errorMessage)) {
        setWorkflowMessage('This requested stay is no longer available. Choose one of the available alternatives below to prepare a clear guest offer.')
        await loadStayAlternatives(selectedBooking.reservation.id)
      }
    }
    finally { setIsUpdatingReservation(false) }
  }

  async function offerSelectedAlternative(alternative: ReservationAlternative) {
    if (!selectedBooking) return
    setIsUpdatingReservation(true); setDetailError(null); setWorkflowMessage(null)
    try {
      await offerAlternativeStay(selectedBooking.reservation.id, alternative.product_id)
      await Promise.all([loadBookingDetail(selectedBooking.reservation.id), loadCalendar()])
      setWorkflowMessage(`Alternative saved: ${alternative.product_name}. Contact the guest for approval, then create the manual-payment hold.`)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'We could not offer that alternative.')
    } finally { setIsUpdatingReservation(false) }
  }

  function guestAlternativeMessage() {
    if (!selectedBooking) return ''
    return `Hello ${selectedBooking.reservation.guest_name ?? ''}, thank you for your Breathe Woods reservation request. Your original stay is no longer available, but we can offer ${selectedBooking.reservation.product_name ?? 'an alternative stay'} for ${selectedBooking.reservation.check_in} to ${selectedBooking.reservation.check_out}, estimated at ${formatInr(selectedBooking.reservation.total_paise)}. If this works for you, please reply here and we will share the payment details to confirm your booking.`
  }

  async function repriceAlternativeDates() {
    if (!selectedBooking) return
    setIsUpdatingReservation(true); setDetailError(null)
    try {
      await offerAlternativeDates(selectedBooking.reservation.id, alternativeCheckIn, alternativeCheckOut)
      await Promise.all([loadBookingDetail(selectedBooking.reservation.id), loadCalendar()])
    } catch (error) { setDetailError(error instanceof Error ? error.message : 'We could not offer those dates.') }
    finally { setIsUpdatingReservation(false) }
  }

  async function simulatePayment() {
    if (!selectedBooking || !window.confirm('Simulate a successful UAT PhonePe payment for ' + selectedBooking.reservation.reference + '? This confirms the booking and blocks its inventory.')) return
    setIsSimulatingPayment(true)
    setDetailError(null)
    try {
      await simulateUatSuccessfulPayment(selectedBooking.reservation.id)
      await Promise.all([loadBookingDetail(selectedBooking.reservation.id), loadCalendar()])
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'We could not simulate the payment.')
    } finally {
      setIsSimulatingPayment(false)
    }
  }

  function openReservations(nextStart: string, nextEnd: string) {
    setStart(nextStart)
    setEnd(nextEnd)
    setDashboardView('reservations')
    setSelectedBooking(null)
  }

  if (!isSupabaseConfigured) {
    return <main className="owner-shell"><section className="owner-callout"><h1>Setup pending</h1><p>The owner dashboard requires the UAT database connection.</p></section></main>
  }

  if (!session) {
    return <main className="owner-shell"><section className="owner-login"><p className="eyebrow">Breathe Woods</p><h1>Owner dashboard</h1><p>Only a pre-authorised owner or manager can sign in. Guest accounts are not created here.</p><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary" onClick={requestSignIn} disabled={!email}>Send secure sign-in link</button>{message && <p className="setup-note">{message}</p>}</section></main>
  }

  const resourceGroups = calendarRows.reduce<Record<string, CalendarRow[]>>((groups, row) => {
    ;(groups[row.resource_kind] ??= []).push(row)
    return groups
  }, {})
  const bookingAgenda = useMemo(() => {
    const groups = new Map<string, { row: CalendarRow; resources: string[] }>()
    for (const row of calendarRows) {
      if (!row.reservation_id || !row.check_in || !row.check_out) continue
      const group = groups.get(row.reservation_id)
      if (group) group.resources.push(row.resource_name)
      else groups.set(row.reservation_id, { row, resources: [row.resource_name] })
    }
    return [...groups.values()].sort((left, right) => left.row.check_in!.localeCompare(right.row.check_in!))
  }, [calendarRows])
  const blockAgenda = useMemo(() => {
    const groups = new Map<string, { row: CalendarRow; resources: string[] }>()
    for (const row of calendarRows) {
      if (row.allocation_state !== 'block' || !row.block_id || !row.check_in || !row.check_out) continue
      const group = groups.get(row.block_id)
      if (group) group.resources.push(row.resource_name)
      else groups.set(row.block_id, { row, resources: [row.resource_name] })
    }
    return [...groups.values()].sort((left, right) => left.row.check_in!.localeCompare(right.row.check_in!))
  }, [calendarRows])

  return <main className="owner-shell">
    <header className="owner-header">
      <div><p className="eyebrow">Breathe Woods</p><h1>Owner dashboard</h1></div>
      <div className="owner-header-actions">
        <nav className="owner-nav" aria-label="Owner dashboard sections">
          <button className={dashboardView === 'overview' ? 'is-active' : ''} onClick={() => setDashboardView('overview')}>Overview</button>
          <button className={dashboardView === 'reservations' ? 'is-active' : ''} onClick={() => setDashboardView('reservations')}>Reservations</button>
        </nav>
        <button className="secondary" onClick={() => void supabase?.auth.signOut()}>Sign out</button>
      </div>
    </header>

    {dashboardView === 'overview' && <OwnerOverview onOpenReservations={openReservations} />}

    {dashboardView === 'reservations' && <>
      <section className="owner-intro"><p>Review each physical room, active payment hold and confirmed booking. Select a booking to see the guest, stay, price and payment summary.</p></section>
      {reservationRequests.length > 0 && <section className="request-queue"><div><p className="eyebrow">Needs attention</p><h2>Reservation requests</h2><p>These dates are not blocked until you create a manual-payment hold.</p></div><div className="request-queue-list">{reservationRequests.map((request) => <button key={request.reservation_id} onClick={() => void loadBookingDetail(request.reservation_id)}><span><strong>{request.guest_name ?? 'Guest request'} · {request.product_name ?? 'Stay'}</strong><small>{request.check_in} → {request.check_out} · {request.reference}</small></span><b>{request.status.replaceAll('_', ' ')}</b></button>)}</div></section>}
      <section className="calendar-toolbar">
        <label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <button className="primary" onClick={() => void loadCalendar()} disabled={isLoading}>{isLoading ? 'Loading…' : 'Refresh calendar'}</button>
      </section>
      {calendarError && <section className="owner-callout"><h2>Dashboard access is not enabled for this account</h2><p>{calendarError}</p></section>}
      {!calendarError && <section className="dashboard-layout">
        <section className="owner-reservations-main">
          <section className="reservation-agenda">
            <header><div><p className="eyebrow">Stay agenda</p><h2>Upcoming stays &amp; payment holds</h2><p>Each booking appears once, even when it occupies multiple rooms.</p></div><b>{bookingAgenda.length}</b></header>
            {bookingAgenda.length === 0 ? <p className="agenda-empty">No confirmed stays or active payment holds in this date range.</p> : <div>{bookingAgenda.map(({ row, resources }) => <button key={row.reservation_id} className="agenda-row" onClick={() => void loadBookingDetail(row.reservation_id!)}><span><strong>{row.guest_name ?? row.reservation_reference ?? 'Guest stay'}</strong><small>{formatOwnerDate(row.check_in!)} → {formatOwnerDate(row.check_out!)} · {resources.length === 1 ? resources[0] : `${resources.length} rooms`}</small></span><b className={row.allocation_state === 'hold' ? 'hold' : ''}>{row.allocation_state === 'hold' ? 'Payment hold' : 'Confirmed'}</b></button>)}</div>}
          </section>
          {blockAgenda.length > 0 && <section className="reservation-block-summary"><header><div><p className="eyebrow">Availability blocks</p><h2>Owner and maintenance use</h2></div><b>{blockAgenda.length}</b></header><div>{blockAgenda.map(({ row, resources }) => <article key={row.block_id}><span><strong>{row.block_reason ?? 'Operational block'}</strong><small>{formatOwnerDate(row.check_in!)} → {formatOwnerDate(row.check_out!)} · {resources.length} {resources.length === 1 ? 'room' : 'rooms'}</small></span></article>)}</div></section>}
          <section className="inventory-ledger">
            <header><div><p className="eyebrow">Detailed inventory</p><h2>Room-by-room allocation</h2><p>Use this audit view only when you need to inspect individual rooms.</p></div><button className="secondary" onClick={() => setShowInventoryLedger((shown) => !shown)}>{showInventoryLedger ? 'Hide room detail' : 'Show room detail'}</button></header>
            {showInventoryLedger && <div className="calendar-list">{Object.entries(resourceGroups).map(([kind, rows]) => <section key={kind}>
              <p className="eyebrow">{kind}s</p>
              {rows.map((row) => <article className="calendar-row" key={row.resource_id + '-' + (row.allocation_id ?? 'empty')}>
                <div><strong>{row.resource_name}</strong><span>{row.allocation_id ? row.check_in + ' → ' + row.check_out : 'Available in selected range'}</span></div>
                {row.allocation_id && <div className={'calendar-status ' + row.allocation_state}>
                  <strong>{row.allocation_state === 'hold' ? 'Payment hold' : row.allocation_state}</strong>
                  <span>{row.reservation_reference ?? row.block_reason ?? 'Operational block'}</span>
                  {row.guest_name && <span>{row.guest_name}</span>}
                  {row.reservation_id && <button className="booking-link" onClick={() => void loadBookingDetail(row.reservation_id as string)}>View booking</button>}
                </div>}
              </article>)}
            </section>)}</div>}
          </section>
        </section>
        <aside className="booking-detail-panel">
          {isLoadingDetail && <p>Loading booking…</p>}
          {detailError && <p className="form-error">{detailError}</p>}
          {!isLoadingDetail && !detailError && !selectedBooking && <><p className="eyebrow">Booking details</p><h2>Select a booking</h2><p>Choose “View booking” beside a reservation to see its full operational summary.</p></>}
          {selectedBooking && <>
            <div className="detail-heading"><div><p className="eyebrow">{selectedBooking.reservation.status.replace('_', ' ')}</p><h2>{selectedBooking.reservation.reference}</h2></div><button className="secondary" onClick={() => setSelectedBooking(null)}>Close</button></div>
            {workflowMessage && <p className="workflow-message">{workflowMessage}</p>}
            {['requested', 'in_conversation', 'alternative_offered'].includes(selectedBooking.reservation.status) && !selectedBooking.reservation.requested_stay_available && <p className="workflow-message">The requested stay is no longer available for these dates. Select an available alternative below before contacting the guest.</p>}
            <div className="detail-section"><strong>{selectedBooking.reservation.product_name ?? 'Stay'}</strong><span>{selectedBooking.reservation.check_in} → {selectedBooking.reservation.check_out}</span></div>
            <div className="detail-section"><strong>{selectedBooking.reservation.guest_name ?? 'Guest details unavailable'}</strong>{selectedBooking.reservation.guest_phone && <span>{selectedBooking.reservation.guest_phone}</span>}{selectedBooking.reservation.guest_email && <span>{selectedBooking.reservation.guest_email}</span>}</div>
            <div className="detail-section"><strong>Guests</strong><span>{selectedBooking.reservation.adults} adults · {selectedBooking.reservation.children_7_to_12} children 7–12 · {selectedBooking.reservation.children_0_to_6} children 0–6 · {selectedBooking.reservation.pets} pets</span></div>
            <div className="detail-section"><strong>Payment</strong><span>{selectedBooking.payment ? selectedBooking.payment.provider + ' · ' + selectedBooking.payment.state + ' · ' + formatInr(selectedBooking.payment.amount_paise) : 'Payment has not been created yet.'}</span></div>
            {['requested', 'in_conversation', 'alternative_offered'].includes(selectedBooking.reservation.status) && <div className="detail-section workflow-actions"><strong>Request actions</strong><span>Requests do not block dates until you create a manual payment hold.</span><div><button className="secondary" onClick={() => void runWorkflowAction('start_conversation')} disabled={isUpdatingReservation}>Mark in conversation</button><button className="primary" onClick={() => void runWorkflowAction('hold_for_manual_payment')} disabled={isUpdatingReservation}>{isUpdatingReservation ? 'Updating…' : 'Hold for manual payment (12h)'}</button><button className="text-button" onClick={() => void runWorkflowAction('decline')} disabled={isUpdatingReservation}>Decline request</button></div></div>}
            {selectedBooking.reservation.status === 'awaiting_manual_payment' && <div className="detail-section workflow-actions"><strong>Manual payment</strong><span>A 12-hour inventory hold is active. Confirm only after you have verified the payment manually.</span><button className="primary" onClick={() => void runWorkflowAction('confirm_manual_payment')} disabled={isUpdatingReservation}>{isUpdatingReservation ? 'Confirming…' : 'Confirm payment received'}</button></div>}
            {['requested', 'in_conversation', 'alternative_offered'].includes(selectedBooking.reservation.status) && <div className="detail-section alternative-dates"><strong>Offer alternative dates</strong><span>Uses the same stay and guest choices, then recalculates the total using the live daily rates.</span><div><label>Check-in<input type="date" value={alternativeCheckIn} onChange={(event) => setAlternativeCheckIn(event.target.value)} /></label><label>Check-out<input type="date" value={alternativeCheckOut} onChange={(event) => setAlternativeCheckOut(event.target.value)} /></label></div><button className="secondary" onClick={() => void repriceAlternativeDates()} disabled={isUpdatingReservation || !alternativeCheckIn || !alternativeCheckOut}>Offer recalculated dates</button></div>}
            {['requested', 'in_conversation', 'alternative_offered'].includes(selectedBooking.reservation.status) && <div className="detail-section stay-alternatives"><strong>Available stays for these dates</strong><span>Use this if the requested stay is no longer available. The total below retains the guest’s party and meal choices.</span>{isLoadingAlternatives ? <span>Checking alternatives…</span> : stayAlternatives.length ? <div>{stayAlternatives.map((alternative) => <article key={alternative.product_id}><span><b>{alternative.product_name}</b><small>{alternative.sellable_kind.replace('_', ' ')} · {formatInr(alternative.total_paise)}</small></span><button className="secondary" onClick={() => void offerSelectedAlternative(alternative)} disabled={isUpdatingReservation}>Offer this stay</button></article>)}</div> : <span>No alternative stay is currently available for these exact dates.</span>}</div>}
            {selectedBooking.reservation.status === 'alternative_offered' && (selectedBooking.reservation.guest_phone || selectedBooking.reservation.guest_email) && <div className="detail-section guest-message-actions"><strong>Send the guest the alternative</strong><span>The alternative is saved but not held. Send this message, wait for approval, then create the payment hold.</span><div>{selectedBooking.reservation.guest_phone && <a className="secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${selectedBooking.reservation.guest_phone.replace(/\D/g, '')}?text=${encodeURIComponent(guestAlternativeMessage())}`}>WhatsApp guest</a>}{selectedBooking.reservation.guest_email && <a className="secondary" href={`mailto:${selectedBooking.reservation.guest_email}?subject=${encodeURIComponent('Your Breathe Woods stay alternative')}&body=${encodeURIComponent(guestAlternativeMessage())}`}>Email guest</a>}</div></div>}
            {selectedBooking.cancellation_policy && <div className="detail-section cancellation-policy"><strong>Cancellation &amp; refund guidance</strong><span>{selectedBooking.cancellation_policy.message}</span><b>Expected refund: {formatInr(selectedBooking.cancellation_policy.refund_paise)} ({selectedBooking.cancellation_policy.refund_percent}%)</b><button className="text-button" onClick={() => void runWorkflowAction('cancel')} disabled={isUpdatingReservation || selectedBooking.reservation.status === 'cancelled'}>{selectedBooking.reservation.status === 'cancelled' ? 'Cancelled' : 'Cancel reservation'}</button></div>}
            {appConfig.environment === 'uat' && selectedBooking.reservation.status === 'pending_payment' && <div className="detail-section"><strong>UAT test control</strong><span>Uses the real confirmation path without sending a payment to PhonePe.</span><button className="secondary" onClick={() => void simulatePayment()} disabled={isSimulatingPayment}>{isSimulatingPayment ? 'Confirming test payment…' : 'Simulate successful payment'}</button></div>}
            <div className="detail-section"><strong>Price summary</strong>{selectedBooking.items.map((item) => <span key={item.label + '-' + item.item_type}>{item.label} × {item.quantity} — {formatInr(item.amount_paise)}</span>)}<b>Total — {formatInr(selectedBooking.reservation.total_paise)}</b></div>
            {selectedBooking.reservation.internal_note && <div className="detail-section"><strong>Internal note</strong><span>{selectedBooking.reservation.internal_note}</span></div>}
          </>}
        </aside>
      </section>}
    </>}
  </main>
}
