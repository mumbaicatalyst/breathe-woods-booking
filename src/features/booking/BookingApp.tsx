import { useState } from 'react'
import type { BookingDraft, BookingStage } from '../../lib/types'
import { isSupabaseConfigured } from '../../lib/config'
import { formatInrFromPaise, getAvailableProducts, type AvailableProduct } from './availability'
import { getBookingQuote, type BookingQuote, type QuoteInput } from './quote'
import { createBookingHold, type BookingHold } from './hold'

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

const countryCodes = [
  { label: 'India', value: '+91' },
  { label: 'United Arab Emirates', value: '+971' },
  { label: 'United Kingdom', value: '+44' },
  { label: 'United States / Canada', value: '+1' },
  { label: 'Australia', value: '+61' },
  { label: 'Singapore', value: '+65' },
]

export function BookingApp() {
  const [stage, setStage] = useState<BookingStage>('search')
  const [draft, setDraft] = useState<BookingDraft>(initialDraft)
  const [availability, setAvailability] = useState<AvailableProduct[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [mealPlan, setMealPlan] = useState<QuoteInput['mealPlan']>('breakfast')
  const [bonfireSessions, setBonfireSessions] = useState(0)
  const [lakeOutings, setLakeOutings] = useState(0)
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [customCountryCode, setCustomCountryCode] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [hold, setHold] = useState<BookingHold | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [isCreatingHold, setIsCreatingHold] = useState(false)
  const stageIndex = stages.findIndex(({ id }) => id === stage)
  const canSearch = Boolean(draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn)
  const selectedProduct = availability?.find((product) => product.productId === draft.selectedProductId)
  const effectiveCountryCode = countryCode === 'other' ? customCountryCode : countryCode
  const guestPhoneE164 = `${effectiveCountryCode.replace(/[^0-9+]/g, '')}${guestPhone.replace(/\D/g, '')}`
  const hasValidContactDetails = guestName.trim().length >= 2 && /\S+@\S+\.\S+/.test(guestEmail) && /^\+[1-9][0-9]{7,14}$/.test(guestPhoneE164)

  function invalidateQuote() {
    setQuote(null)
    setQuoteError(null)
  }

  async function searchAvailability() {
    if (!canSearch) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const partySize = draft.party.adults + draft.party.children7To12 + draft.party.children0To6
      setAvailability(await getAvailableProducts(draft.checkIn, draft.checkOut, partySize))
      invalidateQuote()
    } catch (error) {
      setAvailability(null)
      setSearchError(error instanceof Error ? error.message : 'We could not check availability. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  async function calculateQuote() {
    if (!draft.selectedProductId) return
    setIsQuoting(true)
    setQuoteError(null)
    try {
      setQuote(await getBookingQuote({
        productId: draft.selectedProductId, checkIn: draft.checkIn, checkOut: draft.checkOut,
        adults: draft.party.adults, children7To12: draft.party.children7To12, children0To6: draft.party.children0To6, pets: draft.party.pets,
        mealPlan, bonfireSessions, lakeOutings,
      }))
    } catch (error) {
      setQuote(null)
      setQuoteError(error instanceof Error ? error.message : 'We could not create a quote. Please review your selections.')
    } finally { setIsQuoting(false) }
  }

  async function createHold() {
    if (!draft.selectedProductId) return
    setIsCreatingHold(true)
    setHoldError(null)
    try {
      const result = await createBookingHold({
        productId: draft.selectedProductId, checkIn: draft.checkIn, checkOut: draft.checkOut,
        adults: draft.party.adults, children7To12: draft.party.children7To12, children0To6: draft.party.children0To6, pets: draft.party.pets,
        mealPlan, bonfireSessions, lakeOutings, guestName, guestEmail, guestPhone: guestPhoneE164, marketingOptIn,
      })
      setHold(result)
      setStage('payment')
    } catch (error) {
      setHoldError(error instanceof Error ? error.message : 'We could not hold this stay. Please try again.')
    } finally { setIsCreatingHold(false) }
  }

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
              <label>Check-in<input type="date" value={draft.checkIn} onChange={(event) => { invalidateQuote(); setAvailability(null); setDraft({ ...draft, checkIn: event.target.value }) }} /></label>
              <label>Check-out<input type="date" min={draft.checkIn || undefined} value={draft.checkOut} onChange={(event) => { invalidateQuote(); setAvailability(null); setDraft({ ...draft, checkOut: event.target.value }) }} /></label>
              <label>Total guests<input type="number" min="1" max="15" value={draft.party.adults + draft.party.children7To12 + draft.party.children0To6} onChange={(event) => { invalidateQuote(); setAvailability(null); setDraft({ ...draft, party: { ...draft.party, adults: Math.max(1, Number(event.target.value) || 1), children7To12: 0, children0To6: 0 } }) }} /></label>
            </div>
            <button className="primary" disabled={!canSearch || !isSupabaseConfigured || isSearching} onClick={searchAvailability}>{isSearching ? 'Checking availability…' : 'Check availability'}</button>
            {!isSupabaseConfigured && <p className="setup-note">Live availability will appear here once the UAT inventory connection is configured. This clean build intentionally contains no seeded stays or test calendar.</p>}
            {isSupabaseConfigured && <p className="setup-note">UAT connection is configured locally. Live availability activates after the booking schema and inventory configuration are applied.</p>}
            {searchError && <p className="form-error">{searchError}</p>}
            {availability && (
              <section className="availability-results" aria-live="polite">
                <h2>{availability.length ? 'Available stays' : 'No stays available for those dates'}</h2>
                {availability.length === 0 ? <p>Try other dates, a smaller party, or message the host for a special request.</p> : availability.map((product) => (
                  <article className="stay-option" key={product.productId}>
                    <div><p className="option-kind">{product.sellableKind === 'entire_property' ? 'Entire property' : product.sellableKind}</p><h3>{product.productName}</h3><p>Up to {product.maxOvernightGuests} overnight guests</p></div>
                    <div className="option-price"><strong>From {formatInrFromPaise(product.fromAmountPaise)}</strong><span>per night</span><button className="secondary" onClick={() => { invalidateQuote(); setDraft({ ...draft, selectedProductId: product.productId }); setMealPlan(product.sellableKind === 'entire_property' ? 'all_meals' : 'breakfast'); setStage('personalise') }}>Select</button></div>
                  </article>
                ))}
              </section>
            )}
          </section>
        )}

        {stage === 'personalise' && selectedProduct && (
          <section>
            <p className="eyebrow">{selectedProduct.sellableKind.replace('_', ' ')}</p>
            <h1>{selectedProduct.productName}</h1>
            <p className="intro">Tell us who is travelling and choose the stay experience. Children aged 0–6 are complimentary but count toward capacity.</p>
            <div className="form-grid">
              <label>Adults (13+)<input type="number" min="1" max={selectedProduct.maxOvernightGuests} value={draft.party.adults} onChange={(event) => { invalidateQuote(); setDraft({ ...draft, party: { ...draft.party, adults: Math.max(1, Number(event.target.value) || 1) } }) }} /></label>
              <label>Children (7–12)<input type="number" min="0" max={selectedProduct.maxOvernightGuests} value={draft.party.children7To12} onChange={(event) => { invalidateQuote(); setDraft({ ...draft, party: { ...draft.party, children7To12: Math.max(0, Number(event.target.value) || 0) } }) }} /></label>
              <label>Children (0–6)<input type="number" min="0" max={selectedProduct.maxOvernightGuests} value={draft.party.children0To6} onChange={(event) => { invalidateQuote(); setDraft({ ...draft, party: { ...draft.party, children0To6: Math.max(0, Number(event.target.value) || 0) } }) }} /></label>
              <label>Pets<input type="number" min="0" max="3" value={draft.party.pets} onChange={(event) => { invalidateQuote(); setDraft({ ...draft, party: { ...draft.party, pets: Math.max(0, Number(event.target.value) || 0) } }) }} /></label>
              <label>Meal plan<select value={mealPlan} onChange={(event) => { invalidateQuote(); setMealPlan(event.target.value as QuoteInput['mealPlan']) }} disabled={selectedProduct.sellableKind === 'entire_property'}>{selectedProduct.sellableKind !== 'entire_property' && <><option value="breakfast">Breakfast only</option><option value="breakfast_plus_one">Breakfast + 1 meal</option></>}<option value="all_meals">All meals</option></select></label>
              <label>Bonfire + barbecue evenings<input type="number" min="0" max={Math.max(0, (new Date(draft.checkOut).getTime() - new Date(draft.checkIn).getTime()) / 86400000)} value={bonfireSessions} onChange={(event) => { invalidateQuote(); setBonfireSessions(Math.max(0, Number(event.target.value) || 0)) }} /></label>
              <label>Lake outings<input type="number" min="0" max="10" value={lakeOutings} onChange={(event) => { invalidateQuote(); setLakeOutings(Math.max(0, Number(event.target.value) || 0)) }} /></label>
            </div>
            <button className="primary" onClick={calculateQuote} disabled={isQuoting}>{isQuoting ? 'Calculating your quote…' : 'Review price'}</button>
            {quoteError && <p className="form-error">{quoteError}</p>}
            {quote && <section className="quote-card" aria-live="polite"><h2>Your stay estimate</h2>{quote.items.filter((item) => item.amount_paise > 0).map((item) => <div className="quote-line" key={item.label}><span>{item.label}{item.quantity ? ` × ${item.quantity}` : ''}</span><strong>{formatInrFromPaise(item.amount_paise)}</strong></div>)}<div className="quote-total"><span>Total</span><strong>{formatInrFromPaise(quote.total_paise)}</strong></div><p>{quote.notice}</p><button className="secondary" onClick={() => setStage('details')}>Continue</button></section>}
            <button className="text-button" onClick={() => setStage('search')}>Change dates or stay</button>
          </section>
        )}
        {stage === 'details' && quote && (
          <section><p className="eyebrow">One last step</p><h1>Your details</h1><p className="intro">We’ll hold this stay for 10 minutes while payment is arranged. It is not confirmed until payment succeeds.</p><div className="form-grid"><label>Full name<input autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} /></label><label>Email<input type="email" autoComplete="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} /></label><label className="phone-field">Mobile / WhatsApp number<span className="phone-input"><select aria-label="Country calling code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>{countryCodes.map((country) => <option value={country.value} key={country.value}>{country.label} ({country.value})</option>)}<option value="other">Other</option></select>{countryCode === 'other' && <input className="custom-country-code" type="tel" inputMode="tel" aria-label="Country calling code" placeholder="+ code" value={customCountryCode} onChange={(event) => setCustomCountryCode(event.target.value)} />}<input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Mobile number" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} /></span><small>India is selected by default. We’ll use this number for stay updates.</small></label></div><label className="marketing-consent"><input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} /><span>Yes, I’d like occasional Breathe Woods offers and updates by email and WhatsApp.<small>Optional. Booking and stay updates are sent separately. You can opt out at any time.</small></span></label><p className="policy-link">See our <a href="/privacy-and-messaging">Privacy &amp; Messaging Notice</a>.</p><section className="quote-card"><div className="quote-total"><span>Amount to pay</span><strong>{formatInrFromPaise(quote.total_paise)}</strong></div><p>By continuing, you acknowledge that this UAT booking is held temporarily and will require payment confirmation.</p></section><button className="primary" onClick={createHold} disabled={isCreatingHold || !hasValidContactDetails}>{isCreatingHold ? 'Holding your stay…' : 'Continue to payment'}</button>{!hasValidContactDetails && <p className="setup-note">Enter your name, email and a valid mobile number to continue.</p>}{holdError && <p className="form-error">{holdError}</p>}<button className="text-button" onClick={() => setStage('personalise')}>Back to price</button></section>
        )}
        {stage === 'payment' && hold && <section className="empty-state"><p className="eyebrow">Stay held temporarily</p><h1>Payment setup pending</h1><p>Your UAT reference is <strong>{hold.reference}</strong>. This inventory hold expires at {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(hold.expires_at))}. PhonePe checkout will replace this screen when its UAT credentials are connected.</p><section className="quote-card"><div className="quote-total"><span>Amount due</span><strong>{formatInrFromPaise(hold.total_paise)}</strong></div></section></section>}
      </section>

      <footer className="booking-footer">Need something specific? <a href="mailto:sanil.prashant@gmail.com">Message the host</a></footer>
    </main>
  )
}
