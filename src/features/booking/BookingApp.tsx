import { useState } from 'react'
import type { BookingDraft, BookingStage } from '../../lib/types'
import { isSupabaseConfigured } from '../../lib/config'

const initialDraft: BookingDraft = {
  checkIn: '',
  checkOut: '',
  party: { adults: 2, children7To12: 0, children0To6: 0, pets: 0 },
}

const stages: { id: BookingStage; label: string }[] = [
  { id: 'search', label: 'Find a stay' },
  { id: 'personalise', label: 'Choose your stay' },
  { id: 'details', label: 'Your details' },
  { id: 'payment', label: 'Payment' },
]

export function BookingApp() {
  const [stage, setStage] = useState<BookingStage>('search')
  const [draft, setDraft] = useState<BookingDraft>(initialDraft)
  const stageIndex = stages.findIndex(({ id }) => id === stage)
  const canSearch = Boolean(draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn)

  return (
    <main className="booking-shell">
      <header className="booking-header">
        <a className="wordmark" href="/" aria-label="Breathe Woods booking home">Breathe Woods</a>
        <span className="header-note">Book your stay</span>
      </header>

      <section className="booking-card" aria-labelledby="booking-title">
        <ol className="progress" aria-label="Booking progress">
          {stages.map(({ id, label }, index) => (
            <li key={id} className={index <= stageIndex ? 'is-active' : ''} aria-current={id === stage ? 'step' : undefined}>
              <span>{index + 1}</span>{label}
            </li>
          ))}
        </ol>

        {stage === 'search' && (
          <section>
            <p className="eyebrow">Private stays in the woods of Raigad</p>
            <h1 id="booking-title">Find your escape</h1>
            <p className="intro">Choose dates and your total party. We’ll show only stays that are genuinely available.</p>
            <div className="form-grid">
              <label>Check-in<input type="date" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value })} /></label>
              <label>Check-out<input type="date" min={draft.checkIn || undefined} value={draft.checkOut} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value })} /></label>
              <label>Total guests<input type="number" min="1" max="15" value={draft.party.adults + draft.party.children7To12 + draft.party.children0To6} onChange={(event) => setDraft({ ...draft, party: { ...draft.party, adults: Math.max(1, Number(event.target.value) || 1), children7To12: 0, children0To6: 0 } })} /></label>
            </div>
            <button className="primary" disabled={!canSearch || !isSupabaseConfigured} onClick={() => setStage('personalise')}>Check availability</button>
            {!isSupabaseConfigured && <p className="setup-note">Live availability will appear here once the UAT inventory connection is configured. This clean build intentionally contains no seeded stays or test calendar.</p>}
          </section>
        )}

        {stage !== 'search' && (
          <section className="empty-state">
            <p className="eyebrow">Booking engine foundation</p>
            <h1>{stages[stageIndex].label}</h1>
            <p>This step is connected after the UAT database, availability service and PhonePe sandbox credentials are added. No made-up prices, reservations or payment outcomes are shown to guests.</p>
            <button className="secondary" onClick={() => setStage('search')}>Back to dates</button>
          </section>
        )}
      </section>

      <footer className="booking-footer">Need something specific? <a href="mailto:sanil.prashant@gmail.com">Message the host</a></footer>
    </main>
  )
}
