import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../../lib/config'
import { supabase } from '../../lib/supabase'
import { getOwnerCalendar, type CalendarRow } from './calendar'

function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function startOfToday() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()) }

export function OwnerDashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [start, setStart] = useState(isoDate(startOfToday()))
  const [end, setEnd] = useState(isoDate(new Date(startOfToday().getTime() + 7 * 86400000)))

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) void loadCalendar() }, [session])

  async function requestSignIn() {
    if (!supabase) return
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/owner`,
        // The dashboard is invitation-only: never create an Auth user from this form.
        shouldCreateUser: false,
      },
    })
    setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
  }

  async function loadCalendar() {
    setIsLoading(true); setCalendarError(null)
    try { setCalendarRows(await getOwnerCalendar(start, end)) }
    catch (error) { setCalendarRows([]); setCalendarError(error instanceof Error ? error.message : 'Unable to load the calendar.') }
    finally { setIsLoading(false) }
  }

  if (!isSupabaseConfigured) return <main className="owner-shell"><section className="owner-callout"><h1>Setup pending</h1><p>The owner dashboard requires the UAT database connection.</p></section></main>

  if (!session) return <main className="owner-shell"><section className="owner-login"><p className="eyebrow">Breathe Woods</p><h1>Owner dashboard</h1><p>Only a pre-authorised owner or manager can sign in. Guest accounts are not created here.</p><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary" onClick={requestSignIn} disabled={!email}>Send secure sign-in link</button>{message && <p className="setup-note">{message}</p>}</section></main>

  const resourceGroups = calendarRows.reduce<Record<string, CalendarRow[]>>((groups, row) => { (groups[row.resource_kind] ??= []).push(row); return groups }, {})
  return <main className="owner-shell"><header className="owner-header"><div><p className="eyebrow">Breathe Woods</p><h1>Owner dashboard</h1></div><button className="secondary" onClick={() => void supabase?.auth.signOut()}>Sign out</button></header><section className="calendar-toolbar"><label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><button className="primary" onClick={loadCalendar} disabled={isLoading}>{isLoading ? 'Loading…' : 'Refresh calendar'}</button></section>{calendarError && <section className="owner-callout"><h2>Dashboard access is not enabled for this account</h2><p>{calendarError}</p></section>}{!calendarError && <section className="calendar-list">{Object.entries(resourceGroups).map(([kind, rows]) => <section key={kind}><p className="eyebrow">{kind}s</p>{rows.map((row) => <article className="calendar-row" key={`${row.resource_id}-${row.allocation_id ?? 'empty'}`}><div><strong>{row.resource_name}</strong><span>{row.allocation_id ? `${row.check_in} → ${row.check_out}` : 'Available in selected range'}</span></div>{row.allocation_id && <div className={`calendar-status ${row.allocation_state}`}><strong>{row.allocation_state === 'hold' ? 'Payment hold' : row.allocation_state}</strong><span>{row.reservation_reference ?? row.block_reason ?? 'Operational block'}</span>{row.guest_name && <span>{row.guest_name}</span>}</div>}</article>)}</section>)}</section>}</main>
}
