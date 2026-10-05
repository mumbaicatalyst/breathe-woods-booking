import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { appConfig, isSupabaseConfigured } from '../../lib/config'
import { supabase } from '../../lib/supabase'
import { OwnerOverview } from './OwnerOverview'
import { getOwnerCalendar, getOwnerReservationDetail, simulateUatSuccessfulPayment, type CalendarRow, type ReservationDetail } from './calendar'

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

export function OwnerDashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [dashboardView, setDashboardView] = useState<'overview' | 'reservations'>('overview')
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<ReservationDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)
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
      setCalendarRows(await getOwnerCalendar(start, end))
    } catch (error) {
      setCalendarRows([])
      setCalendarError(error instanceof Error ? error.message : 'Unable to load the calendar.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadBookingDetail(reservationId: string) {
    setIsLoadingDetail(true)
    setDetailError(null)
    try {
      setSelectedBooking(await getOwnerReservationDetail(reservationId))
    } catch (error) {
      setSelectedBooking(null)
      setDetailError(error instanceof Error ? error.message : 'Unable to load booking details.')
    } finally {
      setIsLoadingDetail(false)
    }
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
      <section className="calendar-toolbar">
        <label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <button className="primary" onClick={() => void loadCalendar()} disabled={isLoading}>{isLoading ? 'Loading…' : 'Refresh calendar'}</button>
      </section>
      {calendarError && <section className="owner-callout"><h2>Dashboard access is not enabled for this account</h2><p>{calendarError}</p></section>}
      {!calendarError && <section className="dashboard-layout">
        <section className="calendar-list">
          {Object.entries(resourceGroups).map(([kind, rows]) => <section key={kind}>
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
          </section>)}
        </section>
        <aside className="booking-detail-panel">
          {isLoadingDetail && <p>Loading booking…</p>}
          {detailError && <p className="form-error">{detailError}</p>}
          {!isLoadingDetail && !detailError && !selectedBooking && <><p className="eyebrow">Booking details</p><h2>Select a booking</h2><p>Choose “View booking” beside a reservation to see its full operational summary.</p></>}
          {selectedBooking && <>
            <div className="detail-heading"><div><p className="eyebrow">{selectedBooking.reservation.status.replace('_', ' ')}</p><h2>{selectedBooking.reservation.reference}</h2></div><button className="secondary" onClick={() => setSelectedBooking(null)}>Close</button></div>
            <div className="detail-section"><strong>{selectedBooking.reservation.product_name ?? 'Stay'}</strong><span>{selectedBooking.reservation.check_in} → {selectedBooking.reservation.check_out}</span></div>
            <div className="detail-section"><strong>{selectedBooking.reservation.guest_name ?? 'Guest details unavailable'}</strong>{selectedBooking.reservation.guest_phone && <span>{selectedBooking.reservation.guest_phone}</span>}{selectedBooking.reservation.guest_email && <span>{selectedBooking.reservation.guest_email}</span>}</div>
            <div className="detail-section"><strong>Guests</strong><span>{selectedBooking.reservation.adults} adults · {selectedBooking.reservation.children_7_to_12} children 7–12 · {selectedBooking.reservation.children_0_to_6} children 0–6 · {selectedBooking.reservation.pets} pets</span></div>
            <div className="detail-section"><strong>Payment</strong><span>{selectedBooking.payment ? selectedBooking.payment.provider + ' · ' + selectedBooking.payment.state + ' · ' + formatInr(selectedBooking.payment.amount_paise) : 'Payment has not been created yet.'}</span></div>
            {appConfig.environment === 'uat' && selectedBooking.reservation.status === 'pending_payment' && <div className="detail-section"><strong>UAT test control</strong><span>Uses the real confirmation path without sending a payment to PhonePe.</span><button className="secondary" onClick={() => void simulatePayment()} disabled={isSimulatingPayment}>{isSimulatingPayment ? 'Confirming test payment…' : 'Simulate successful payment'}</button></div>}
            <div className="detail-section"><strong>Price summary</strong>{selectedBooking.items.map((item) => <span key={item.label + '-' + item.item_type}>{item.label} × {item.quantity} — {formatInr(item.amount_paise)}</span>)}<b>Total — {formatInr(selectedBooking.reservation.total_paise)}</b></div>
            {selectedBooking.reservation.internal_note && <div className="detail-section"><strong>Internal note</strong><span>{selectedBooking.reservation.internal_note}</span></div>}
          </>}
        </aside>
      </section>}
    </>}
  </main>
}
