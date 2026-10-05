import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getOwnerCalendar, type CalendarRow } from './calendar'

type DailyRate = { stay_date: string; couple_room_paise: number; tier_code: string }

type OwnerOverviewProps = {
  onOpenReservations: (start: string, end: string) => void
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function localIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12) }
function monthLabel(date: Date) { return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date) }
function dateLabel(value: string) { return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(fromIso(value)) }
function isHighDemand(tier: string | undefined) { return Boolean(tier && /(peak|premium|ultra|holiday)/i.test(tier)) }

function uniqueBookings(rows: CalendarRow[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (!row.reservation_id || seen.has(row.reservation_id)) return false
    seen.add(row.reservation_id)
    return true
  })
}

export function OwnerOverview({ onOpenReservations }: OwnerOverviewProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
  const [selectedDay, setSelectedDay] = useState(localIso(new Date()))
  const [rows, setRows] = useState<CalendarRow[]>([])
  const [rates, setRates] = useState<Record<string, DailyRate>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const start = localIso(visibleMonth)
  const end = localIso(addMonths(visibleMonth, 1))
  const today = localIso(new Date())

  async function load() {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const [calendarResult, rateResult] = await Promise.all([
        getOwnerCalendar(start, end),
        supabase.rpc('get_public_daily_rate_calendar', { p_start_date: start, p_end_date: localIso(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12)) }),
      ])
      if (rateResult.error) throw new Error(rateResult.error.message)
      setRows(calendarResult)
      setRates(Object.fromEntries(((rateResult.data ?? []) as DailyRate[]).map((rate) => [rate.stay_date, rate])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the owner overview.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [start, end])
  useEffect(() => {
    const interval = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(interval)
  }, [start, end])

  const dayBookings = useMemo(() => uniqueBookings(rows.filter((row) => Boolean(row.reservation_id) && Boolean(row.check_in) && Boolean(row.check_out) && row.check_in! <= selectedDay && row.check_out! > selectedDay)), [rows, selectedDay])
  const currentMonthBookings = useMemo(() => uniqueBookings(rows.filter((row) => Boolean(row.reservation_id))), [rows])
  const activeHolds = currentMonthBookings.filter((row) => row.reservation_status === 'pending_payment').length
  const confirmedBookings = currentMonthBookings.filter((row) => row.reservation_status === 'confirmed').length
  const arrivalsToday = uniqueBookings(rows.filter((row) => row.check_in === today)).length
  const departuresToday = uniqueBookings(rows.filter((row) => row.check_out === today)).length
  const upcoming = currentMonthBookings
    .filter((row) => row.check_out! > today && row.reservation_status !== 'cancelled')
    .sort((a, b) => a.check_in!.localeCompare(b.check_in!))
    .slice(0, 6)

  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12)
  const dayCount = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12).getDate()
  const leadingEmpty = (first.getDay() + 6) % 7
  const calendarCells = Array.from({ length: leadingEmpty + dayCount }, (_, index) => index < leadingEmpty ? null : localIso(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - leadingEmpty + 1, 12)))

  function daySummary(date: string) {
    const active = rows.filter((row) => row.check_in && row.check_out && row.check_in <= date && row.check_out > date && row.allocation_state)
    const zen = new Set(active.filter((row) => row.resource_kind === 'room' && row.resource_name.startsWith('Zen')).map((row) => row.resource_id)).size
    const bougan = new Set(active.filter((row) => row.resource_kind === 'room' && row.resource_name.startsWith("Bougan'villa")).map((row) => row.resource_id)).size
    const reservations = uniqueBookings(active).length
    const holds = uniqueBookings(active.filter((row) => row.reservation_status === 'pending_payment')).length
    const blocks = active.filter((row) => row.allocation_state === 'block').length
    return { zen, bougan, reservations, holds, blocks, full: active.some((row) => row.resource_kind === 'property') }
  }

  return <section className="owner-overview">
    <section className="owner-overview-heading"><div><p className="eyebrow">Daily operations</p><h2>See the property at a glance.</h2><p>Confirmed bookings, temporary payment holds, availability and high-demand dates update automatically every minute.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Updating…' : 'Refresh now'}</button></section>
    {error && <p className="form-error">{error}</p>}
    <section className="owner-metrics" aria-label="Booking summary"><article><span>Arrivals today</span><strong>{arrivalsToday}</strong></article><article><span>Departures today</span><strong>{departuresToday}</strong></article><article><span>Confirmed this month</span><strong>{confirmedBookings}</strong></article><article><span>Live payment holds</span><strong>{activeHolds}</strong></article></section>
    <section className="owner-overview-grid">
      <section className="owner-month-calendar">
        <header><div><p className="eyebrow">Planning calendar</p><h2>{monthLabel(visibleMonth)}</h2></div><div className="owner-month-controls"><button className="secondary" aria-label="Previous month" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>‹</button><button className="secondary" aria-label="Next month" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>›</button></div></header>
        <div className="owner-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="owner-calendar-days">{calendarCells.map((date, index) => {
          if (!date) return <span className="owner-calendar-empty" key={`empty-${index}`} />
          const summary = daySummary(date)
          const rate = rates[date]
          const selected = date === selectedDay
          const hasActivity = summary.reservations > 0 || summary.blocks > 0
          return <button type="button" key={date} className={`owner-calendar-day ${selected ? 'is-selected' : ''} ${hasActivity ? 'has-activity' : ''} ${isHighDemand(rate?.tier_code) ? 'is-high-demand' : ''}`} onClick={() => setSelectedDay(date)}>
            <strong>{fromIso(date).getDate()}</strong>
            {summary.full ? <small className="full-day">Full property</small> : <small>{summary.zen || summary.bougan ? `Z ${summary.zen}/2 · B ${summary.bougan}/3` : 'Available'}</small>}
            {summary.holds > 0 && <i title="Payment hold">H</i>}
            {summary.blocks > 0 && <i title="Owner or maintenance block">B</i>}
            {isHighDemand(rate?.tier_code) && <em title="High-demand rate date">Peak</em>}
          </button>
        })}</div>
        <footer><span><b>H</b> payment hold</span><span><b>B</b> owner/maintenance block</span><span><b>Peak</b> high-demand date</span></footer>
      </section>
      <aside className="owner-day-drawer"><p className="eyebrow">Selected day</p><h2>{dateLabel(selectedDay)}</h2>{isHighDemand(rates[selectedDay]?.tier_code) && <p className="demand-note">High-demand date: avoid using this date for an owner or family stay unless necessary.</p>}{dayBookings.length === 0 ? <p>No guest bookings on this date. Review blocks and room availability before allocating it.</p> : <div className="owner-day-bookings">{dayBookings.map((booking) => <button key={booking.reservation_id} onClick={() => onOpenReservations(booking.check_in!, booking.check_out!)}><span><strong>{booking.reservation_reference}</strong><small>{booking.guest_name ?? 'Guest'} · {booking.check_in} → {booking.check_out}</small></span><b className={booking.reservation_status === 'pending_payment' ? 'hold' : ''}>{booking.reservation_status === 'pending_payment' ? 'Hold' : 'Confirmed'}</b></button>)}</div>}<button className="secondary drawer-action" onClick={() => onOpenReservations(selectedDay, localIso(new Date(fromIso(selectedDay).getTime() + 86400000)))}>Open day operations</button></aside>
    </section>
    <section className="owner-upcoming"><div><p className="eyebrow">Upcoming stays</p><h2>Next arrivals and bookings</h2></div><button className="text-button" onClick={() => onOpenReservations(start, end)}>View all reservations</button>{upcoming.length === 0 ? <p>No upcoming stays in this month yet.</p> : <div>{upcoming.map((booking) => <button key={booking.reservation_id} className="owner-upcoming-row" onClick={() => onOpenReservations(booking.check_in!, booking.check_out!)}><span><strong>{booking.guest_name ?? booking.reservation_reference}</strong><small>{booking.check_in} → {booking.check_out} · {booking.reservation_reference}</small></span><b className={booking.reservation_status === 'pending_payment' ? 'hold' : ''}>{booking.reservation_status === 'pending_payment' ? 'Payment hold' : 'Confirmed'}</b></button>)}</div>}</section>
  </section>
}
