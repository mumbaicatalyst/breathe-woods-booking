import { useEffect, useRef, useState } from 'react'
import type { BookingDraft, BookingStage } from '../../lib/types'
import { isSupabaseConfigured } from '../../lib/config'
import { formatInrFromPaise, getAvailableProducts, type AvailableProduct } from './availability'
import { getBookingQuote, type BookingQuote, type QuoteInput } from './quote'
import { createBookingHold, type BookingHold } from './hold'
import { RateCalendar } from './RateCalendar'

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

function stayKindLabel(kind: string) {
  if (kind === 'entire_property') return 'Entire property'
  if (kind === 'room_bundle') return 'Two bedrooms'
  if (kind === 'room') return 'Room'
  return 'Villa'
}

function formatStayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

type NumericFieldProps = {
  label: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
  help?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Keeps a temporary text value while someone is editing. The booking model only
 * receives a valid, clamped integer when they finish editing or use +/-.
 */
function NumericField({ label, value, min, max, onCommit, help }: NumericFieldProps) {
  const [rawValue, setRawValue] = useState(String(value))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) setRawValue(String(value))
  }, [value, isEditing])

  function commit() {
    const parsed = rawValue === '' ? min : Number.parseInt(rawValue, 10)
    const nextValue = clamp(Number.isFinite(parsed) ? parsed : min, min, max)
    setRawValue(String(nextValue))
    setIsEditing(false)
    onCommit(nextValue)
  }

  return <label className="numeric-field">{label}
    <span className="numeric-control">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onCommit(value - 1)}>−</button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={rawValue}
        onFocus={(event) => { setIsEditing(true); event.currentTarget.select() }}
        onChange={(event) => { if (/^\d*$/.test(event.target.value)) setRawValue(event.target.value) }}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onCommit(value + 1)}>+</button>
    </span>
    {help && <small>{help}</small>}
  </label>
}

export function BookingApp() {
  const [stage, setStage] = useState<BookingStage>('search')
  const [draft, setDraft] = useState<BookingDraft>(initialDraft)
  const [searchAdults, setSearchAdults] = useState(2)
  const [searchChildren, setSearchChildren] = useState(0)
  const [requestedRooms, setRequestedRooms] = useState(1)
  const [availability, setAvailability] = useState<AvailableProduct[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [mealPlan, setMealPlan] = useState<QuoteInput['mealPlan']>('breakfast')
  const [bonfireSessions, setBonfireSessions] = useState(0)
  const [lakeTripGuests, setLakeTripGuests] = useState(0)
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [guestError, setGuestError] = useState<string | null>(null)
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
  const quoteRequestId = useRef(0)
  const wasEligibleForBonfireBenefit = useRef(false)
  const stageIndex = stages.findIndex(({ id }) => id === stage)
  const canSearch = Boolean(draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn)
  const selectedProduct = availability?.find((product) => product.productId === draft.selectedProductId)
  const effectiveCountryCode = countryCode === 'other' ? customCountryCode : countryCode
  const guestPhoneE164 = `${effectiveCountryCode.replace(/[^0-9+]/g, '')}${guestPhone.replace(/\D/g, '')}`
  const hasValidContactDetails = guestName.trim().length >= 2 && /\S+@\S+\.\S+/.test(guestEmail) && /^\+[1-9][0-9]{7,14}$/.test(guestPhoneE164)

  const requestedGuestCount = searchAdults + searchChildren
  const partyTotal = draft.party.adults + draft.party.children7To12 + draft.party.children0To6
  const hasBonfireMealBenefit = partyTotal >= 7 && (mealPlan === 'all_meals' || mealPlan === 'breakfast_plus_one')
  const isRoomStay = selectedProduct?.sellableKind === 'room'
  const selectedStayCapacity = selectedProduct?.maxOvernightGuests ?? 15
  const maxAdults = isRoomStay ? 2 : Math.max(1, selectedStayCapacity - draft.party.children7To12 - draft.party.children0To6)
  const maxChildren7To12 = isRoomStay ? Math.min(1, Math.max(0, selectedStayCapacity - draft.party.adults - draft.party.children0To6)) : Math.max(0, selectedStayCapacity - draft.party.adults - draft.party.children0To6)
  const maxChildren0To6 = isRoomStay ? Math.min(2, Math.max(0, selectedStayCapacity - draft.party.adults - draft.party.children7To12)) : Math.max(0, selectedStayCapacity - draft.party.adults - draft.party.children7To12)
  const displayedAvailability = availability?.filter((product) => {
    if (requestedRooms === 1) {
      const canUseOneFamilyRoom = searchAdults <= 2 && searchChildren <= 2 && requestedGuestCount <= 4
      return canUseOneFamilyRoom
        ? product.sellableKind === 'room' || product.sellableKind === 'villa'
        : ['zen-villa', 'bougan-two-rooms', 'bougan-villa'].includes(product.productCode)
    }
    if (requestedRooms === 2) return ['zen-villa', 'bougan-two-rooms', 'bougan-villa'].includes(product.productCode)
    if (requestedRooms === 3) return product.productCode === 'bougan-villa'
    return product.productCode === 'entire-property'
  })

  useEffect(() => {
    if (stage === 'personalise' && hasBonfireMealBenefit && !wasEligibleForBonfireBenefit.current && bonfireSessions === 0) {
      setBonfireSessions(1)
    }
    wasEligibleForBonfireBenefit.current = stage === 'personalise' && hasBonfireMealBenefit
  }, [stage, hasBonfireMealBenefit, bonfireSessions])

  function invalidateQuote() {
    setQuote(null)
    setQuoteError(null)
  }

  async function searchAvailability() {
    if (!canSearch) return
    setIsSearching(true)
    setSearchError(null)
    try {
      setAvailability(await getAvailableProducts(draft.checkIn, draft.checkOut, requestedGuestCount))
      invalidateQuote()
    } catch (error) {
      setAvailability(null)
      setSearchError(error instanceof Error ? error.message : 'We could not check availability. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (stage !== 'personalise' || !draft.selectedProductId) return
    const requestId = ++quoteRequestId.current
    setQuote(null)
    setQuoteError(null)
    const timer = window.setTimeout(async () => {
      setIsQuoting(true)
      try {
        const nextQuote = await getBookingQuote({
          productId: draft.selectedProductId!, checkIn: draft.checkIn, checkOut: draft.checkOut,
          adults: draft.party.adults, children7To12: draft.party.children7To12, children0To6: draft.party.children0To6, pets: draft.party.pets,
          mealPlan, bonfireSessions, lakeTripGuests,
        })
        if (requestId === quoteRequestId.current) setQuote(nextQuote)
      } catch (error) {
        if (requestId === quoteRequestId.current) setQuoteError(error instanceof Error ? error.message : 'We could not update the price. Please review your selections.')
      } finally {
        if (requestId === quoteRequestId.current) setIsQuoting(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [stage, draft.selectedProductId, draft.checkIn, draft.checkOut, draft.party.adults, draft.party.children7To12, draft.party.children0To6, draft.party.pets, mealPlan, bonfireSessions, lakeTripGuests])

  function setPartyBreakdown(category: 'adults' | 'children7To12' | 'children0To6', enteredValue: number) {
    const next = { ...draft.party }
    next[category] = enteredValue
    const nextTotal = next.adults + next.children7To12 + next.children0To6
    const invalidRoomFamily = isRoomStay && (next.adults > 2 || next.children7To12 > 1 || next.children0To6 > 2 || next.children7To12 + next.children0To6 > 2)
    if (nextTotal > selectedStayCapacity || invalidRoomFamily) {
      setGuestError(isRoomStay ? 'A room accommodates up to two adults and two children, with at most one child aged 7–12.' : 'This stay accommodates up to ' + selectedStayCapacity + ' overnight guests.')
      return
    }
    setGuestError(null)
    invalidateQuote()
    setDraft({ ...draft, party: next })
  }

  function setSearchAdultsCount(adults: number) {
    setSearchAdults(adults)
    if (adults + searchChildren > 15) setSearchChildren(15 - adults)
    invalidateQuote()
    setAvailability(null)
  }

  async function createHold() {
    if (!draft.selectedProductId) return
    setIsCreatingHold(true)
    setHoldError(null)
    try {
      const result = await createBookingHold({
        productId: draft.selectedProductId, checkIn: draft.checkIn, checkOut: draft.checkOut,
        adults: draft.party.adults, children7To12: draft.party.children7To12, children0To6: draft.party.children0To6, pets: draft.party.pets,
        mealPlan, bonfireSessions, lakeTripGuests, guestName, guestEmail, guestPhone: guestPhoneE164, marketingOptIn,
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
            <RateCalendar
              checkIn={draft.checkIn}
              checkOut={draft.checkOut}
              onChange={(checkIn, checkOut) => {
                invalidateQuote()
                setAvailability(null)
                setDraft({ ...draft, checkIn, checkOut })
              }}
            />
            <div className="form-grid search-guest-count">
              <NumericField label="Rooms" min={1} max={5} value={requestedRooms} onCommit={(value) => { setRequestedRooms(value); setAvailability(null) }} help="Choose how many bedrooms you need." />
              <NumericField label="Adults" min={1} max={15 - searchChildren} value={searchAdults} onCommit={setSearchAdultsCount} help="Ages 13 and above." />
              <NumericField label="Children" min={0} max={15 - searchAdults} value={searchChildren} onCommit={(value) => { setSearchChildren(value); invalidateQuote(); setAvailability(null) }} help="Ages 0–12; you’ll confirm ages next." />
            </div>
            <button className="primary" disabled={!canSearch || !isSupabaseConfigured || isSearching} onClick={searchAvailability}>{isSearching ? 'Checking availability…' : 'Check availability'}</button>
            {!isSupabaseConfigured && <p className="setup-note">Live availability will appear here once the UAT inventory connection is configured. This clean build intentionally contains no seeded stays or test calendar.</p>}
            {isSupabaseConfigured && <p className="setup-note">UAT connection is configured locally. Live availability activates after the booking schema and inventory configuration are applied.</p>}
            {searchError && <p className="form-error">{searchError}</p>}
            {displayedAvailability && (
              <section className="availability-results" aria-live="polite">
                <h2>{displayedAvailability.length ? 'Available stays' : 'No stays available for those dates'}</h2>
                {displayedAvailability.length === 0 ? <p>Try other dates, a smaller party, or message the host for a special request.</p> : displayedAvailability.map((product) => (
                  <article className="stay-option" key={product.productId}>
                    <div><p className="option-kind">{stayKindLabel(product.sellableKind)}</p><h3>{product.productName}</h3><p>{product.sellableKind === 'room_bundle' ? 'Up to 4 guests · 2 of 3 bedrooms; the remaining bedroom may be booked separately.' : `Up to ${product.maxOvernightGuests} overnight guests`}</p></div>
                    <div className="option-price"><strong>From {formatInrFromPaise(product.fromAmountPaise)}</strong><span>{product.sellableKind === 'room_bundle' ? 'per night · two bedrooms' : 'per night'}</span><button className="secondary" onClick={() => { invalidateQuote(); setDraft({ ...draft, selectedProductId: product.productId, party: { ...draft.party, adults: searchAdults, children7To12: Math.min(searchChildren, 1), children0To6: Math.max(searchChildren - 1, 0) } }); setMealPlan(product.sellableKind === 'entire_property' ? 'all_meals' : 'breakfast'); setStage('personalise') }}>Select</button></div>
                  </article>
                ))}
              </section>
            )}
          </section>
        )}

        {stage === 'personalise' && selectedProduct && (
          <section>
            <p className="eyebrow">{stayKindLabel(selectedProduct.sellableKind)}</p>
            <h1>{selectedProduct.productName}</h1>
            <p className="intro">Set the adult and child breakdown for this stay. You can adjust your party here; we’ll always keep it within the stay’s capacity. Children aged 0–6 are complimentary but count toward capacity.</p>
            <div className="form-grid">
              <NumericField label="Adults (13+)" min={1} max={maxAdults} value={draft.party.adults} onCommit={(value) => setPartyBreakdown('adults', value)} />
              <NumericField label="Children (7–12)" min={0} max={maxChildren7To12} value={draft.party.children7To12} onCommit={(value) => setPartyBreakdown('children7To12', value)} help="Charged only when above the included room allowance." />
              <NumericField label="Children (0–6)" min={0} max={maxChildren0To6} value={draft.party.children0To6} onCommit={(value) => setPartyBreakdown('children0To6', value)} help="Complimentary, but included in capacity." />
              <NumericField label="Pets" min={0} max={3} value={draft.party.pets} onCommit={(value) => { invalidateQuote(); setDraft({ ...draft, party: { ...draft.party, pets: value } }) }} />
              <label className="meal-plan-field">Meal plan<select value={mealPlan} onChange={(event) => { invalidateQuote(); setMealPlan(event.target.value as QuoteInput['mealPlan']) }} disabled={selectedProduct.sellableKind === 'entire_property'}>{selectedProduct.sellableKind !== 'entire_property' && <><option value="breakfast">Breakfast only</option><option value="breakfast_plus_one">Breakfast + 1 meal</option></>}<option value="all_meals">All meals</option></select></label>
              <NumericField label="Bonfire + barbecue evenings" min={0} max={Math.max(0, (new Date(draft.checkOut).getTime() - new Date(draft.checkIn).getTime()) / 86400000)} value={bonfireSessions} onCommit={(value) => { invalidateQuote(); setBonfireSessions(value) }} help={hasBonfireMealBenefit ? 'One evening has been added at no extra cost. Additional evenings are ₹500 per guest.' : '₹500 per guest, per evening.'} />
              <NumericField label="Guests joining the lake trip" min={0} max={requestedGuestCount} value={lakeTripGuests} onCommit={(value) => { invalidateQuote(); setLakeTripGuests(value) }} help="₹500 covers up to 2 guests; ₹250 for each additional guest." />
            </div>
            <p className="setup-note">{partyTotal} of up to {selectedStayCapacity} guests. Price updates automatically as you make changes.</p>
            {guestError && <p className="form-error">{guestError}</p>}
            {quoteError && <p className="form-error">{quoteError}</p>}
            {isQuoting && <p className="setup-note" aria-live="polite">Updating your price…</p>}
            {quote && <section className="quote-card" aria-live="polite">
              <h2>Your live stay estimate</h2>
              {quote.nightly_breakdown && <section className="nightly-rates" aria-label="Nightly rate breakdown">
                <p className="nightly-rates-heading">Your nightly price</p>
                {quote.nightly_breakdown.map((night) => <div className="nightly-rate" key={night.date}>
                  <span><strong>{formatStayDate(night.date)}</strong><small>{night.tier.replace(/_/g, ' ')}</small></span>
                  <strong>{formatInrFromPaise(night.total_paise)}</strong>
                </div>)}
              </section>}
              {quote.items.filter((item) => item.amount_paise > 0 || item.label.endsWith('(included)')).map((item) => <div className="quote-line" key={item.label}><span>{item.label}{item.quantity ? ` × ${item.quantity}` : ''}</span><strong>{item.label.endsWith('(included)') ? 'Included' : formatInrFromPaise(item.amount_paise)}</strong></div>)}
              <div className="quote-total"><span>Total</span><strong>{formatInrFromPaise(quote.total_paise)}</strong></div>
              <p>{quote.notice}</p><button className="secondary" onClick={() => setStage('details')}>Continue</button>
            </section>}
            <button className="text-button" onClick={() => setStage('search')}>Change dates, stay or total guests</button>
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
