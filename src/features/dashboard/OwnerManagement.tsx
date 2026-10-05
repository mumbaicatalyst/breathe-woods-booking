import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Rate = {
  stay_date: string; tier_code: string; couple_room_paise: number; single_room_paise: number
  extra_adult_paise: number; extra_child_7_to_12_paise: number; minimum_stay_nights: number
  individual_rooms_bookable: boolean; individual_room_minimum_nights: number; buyout_discount_eligible: boolean
  buyout_one_night_discount_bps_group_10: number; buyout_one_night_discount_bps_group_15: number
  buyout_two_plus_nights_discount_bps_group_10: number; buyout_two_plus_nights_discount_bps_group_15: number; notes: string | null
}
type Product = { id: string; code: string; name: string; sellable_kind: string; active: boolean }
type Experience = { id: string; code: string; name: string; description: string | null; pricing_unit: string; amount_paise: number; max_quantity: number | null; active: boolean; configuration: Record<string, unknown> }
type Campaign = { id: string; name: string; status: string; stay_starts_on: string; stay_ends_on: string; incentive_type: string; discount_bps: number | null; fixed_discount_paise: number | null; promo_code: string | null; product_ids: string[] }
type Summary = { rates: Rate[]; products: Product[]; experiences: Experience[]; settings: Record<string, unknown>; campaigns: Campaign[] }
type Area = 'rates' | 'campaigns' | 'experiences' | 'rules'

function localIso(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function plusDays(days: number) { return localIso(new Date(Date.now() + days * 86400000)) }
function formatInr(paise: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100) }
function toPaise(value: string) { return Math.max(0, Math.round((Number(value) || 0) * 100)) }
function fromPaise(value: number) { return String(value / 100) }
function dateLabel(value: string) { return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`)) }

export function OwnerManagement() {
  const [area, setArea] = useState<Area>('rates')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedRateDate, setSelectedRateDate] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignStart, setCampaignStart] = useState(plusDays(1))
  const [campaignEnd, setCampaignEnd] = useState(plusDays(21))
  const [campaignDiscount, setCampaignDiscount] = useState('10')
  const [campaignProductIds, setCampaignProductIds] = useState<string[]>([])
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null)
  const [experienceName, setExperienceName] = useState('')
  const [experienceDescription, setExperienceDescription] = useState('')
  const [experiencePrice, setExperiencePrice] = useState('')
  const [experienceActive, setExperienceActive] = useState(true)

  async function load() {
    if (!supabase) return
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_owner_management_summary', { p_start_date: localIso(new Date()), p_end_date: plusDays(90) })
      if (rpcError) throw new Error(rpcError.message)
      const next = data as Summary
      setSummary(next)
      setSelectedRateDate((current) => current || next.rates[0]?.stay_date || '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load property management settings.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  const selectedRate = useMemo(() => summary?.rates.find((rate) => rate.stay_date === selectedRateDate) ?? null, [summary, selectedRateDate])
  const editingExperience = useMemo(() => summary?.experiences.find((experience) => experience.id === editingExperienceId) ?? null, [summary, editingExperienceId])

  function startExperienceEdit(experience: Experience) {
    setEditingExperienceId(experience.id); setExperienceName(experience.name); setExperienceDescription(experience.description ?? '')
    setExperiencePrice(fromPaise(experience.amount_paise)); setExperienceActive(experience.active); setMessage(null)
  }

  async function saveRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !selectedRate) return
    const values = new FormData(event.currentTarget)
    setSaving(true); setError(null); setMessage(null)
    try {
      const { error: rpcError } = await supabase.rpc('upsert_owner_daily_rate', {
        p_stay_date: selectedRate.stay_date,
        p_tier_code: String(values.get('tier_code') ?? selectedRate.tier_code),
        p_couple_room_paise: toPaise(String(values.get('couple') ?? '')),
        p_single_room_paise: toPaise(String(values.get('single') ?? '')),
        p_extra_adult_paise: toPaise(String(values.get('adult') ?? '')),
        p_extra_child_7_to_12_paise: toPaise(String(values.get('child') ?? '')),
        p_minimum_stay_nights: Number(values.get('minimum_nights') ?? selectedRate.minimum_stay_nights),
        p_individual_rooms_bookable: selectedRate.individual_rooms_bookable,
        p_individual_room_minimum_nights: selectedRate.individual_room_minimum_nights,
        p_buyout_discount_eligible: selectedRate.buyout_discount_eligible,
        p_buyout_one_night_discount_bps_group_10: selectedRate.buyout_one_night_discount_bps_group_10,
        p_buyout_one_night_discount_bps_group_15: selectedRate.buyout_one_night_discount_bps_group_15,
        p_buyout_two_plus_nights_discount_bps_group_10: selectedRate.buyout_two_plus_nights_discount_bps_group_10,
        p_buyout_two_plus_nights_discount_bps_group_15: selectedRate.buyout_two_plus_nights_discount_bps_group_15,
        p_notes: selectedRate.notes,
      })
      if (rpcError) throw new Error(rpcError.message)
      setMessage(`Rates for ${dateLabel(selectedRate.stay_date)} are live for new guest searches. Existing quotes and bookings are unchanged.`)
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this rate.') }
    finally { setSaving(false) }
  }

  async function saveCampaign(status: 'draft' | 'active') {
    if (!supabase || !campaignName.trim()) { setError('Give the campaign a clear internal name first.'); return }
    setSaving(true); setError(null); setMessage(null)
    try {
      if (status === 'active') {
        const { data: impact, error: impactError } = await supabase.rpc('get_owner_pricing_change_impact', { p_stay_starts_on: campaignStart, p_stay_ends_on: campaignEnd, p_product_ids: campaignProductIds.length ? campaignProductIds : null })
        if (impactError) throw new Error(impactError.message)
        const openQuotes = Number((impact as { affected_open_quotes?: number }).affected_open_quotes ?? 0)
        const holds = Number((impact as { affected_payment_holds?: number }).affected_payment_holds ?? 0)
        if ((openQuotes || holds) && !window.confirm(`${openQuotes} open quote(s) and ${holds} payment hold(s) overlap these stay dates. Their prices will remain protected. Publish this campaign anyway?`)) return
      }
      const { error: rpcError } = await supabase.rpc('owner_upsert_pricing_campaign', {
        p_campaign: {
          name: campaignName.trim(), status, stay_starts_on: campaignStart, stay_ends_on: campaignEnd,
          incentive_type: 'percentage_discount', discount_bps: Math.round((Number(campaignDiscount) || 0) * 100), minimum_nights: 1, minimum_guests: 1,
        },
        p_product_ids: campaignProductIds.length ? campaignProductIds : null,
      })
      if (rpcError) throw new Error(rpcError.message)
      setMessage(status === 'active' ? 'Campaign is live for eligible new guest quotes. Existing guest quotes, payment holds and bookings remain unchanged.' : 'Campaign draft saved. It is not visible to guests yet.')
      setCampaignName(''); setCampaignDiscount('10'); setCampaignProductIds([]); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this campaign.') }
    finally { setSaving(false) }
  }

  async function saveExperience(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !editingExperience) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const { error: rpcError } = await supabase.rpc('owner_update_experience', {
        p_experience_id: editingExperience.id, p_name: experienceName, p_description: experienceDescription,
        p_amount_paise: toPaise(experiencePrice), p_active: experienceActive, p_configuration: editingExperience.configuration,
      })
      if (rpcError) throw new Error(rpcError.message)
      setMessage(`${experienceName} has been updated for future guest quotes.`); setEditingExperienceId(null); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this experience.') }
    finally { setSaving(false) }
  }

  return <section className="owner-manage">
    <header className="owner-manage-heading"><div><p className="eyebrow">Manage property</p><h2>Change what guests see—without changing past promises.</h2><p>Use the common controls first. Existing requests, payment holds and confirmed bookings always retain their quoted price.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Updating…' : 'Refresh'}</button></header>
    {error && <p className="form-error">{error}</p>}{message && <p className="manage-message">{message}</p>}
    <nav className="manage-paths" aria-label="Property management sections">
      <button className={area === 'rates' ? 'is-active' : ''} onClick={() => setArea('rates')}><span>Rates &amp; availability</span><small>Adjust live nightly pricing</small></button>
      <button className={area === 'campaigns' ? 'is-active' : ''} onClick={() => setArea('campaigns')}><span>Offers &amp; campaigns</span><small>Fill quieter dates deliberately</small></button>
      <button className={area === 'experiences' ? 'is-active' : ''} onClick={() => setArea('experiences')}><span>Meals &amp; experiences</span><small>Update guest-facing add-ons</small></button>
      <button className={area === 'rules' ? 'is-active' : ''} onClick={() => setArea('rules')}><span>Property rules</span><small>Review operational guardrails</small></button>
    </nav>
    {loading && !summary && <section className="owner-callout"><p>Loading management controls…</p></section>}
    {summary && area === 'rates' && <section className="manage-workspace"><header><div><p className="eyebrow">Rates</p><h3>Choose a date, then adjust the rate guests will see.</h3></div><p>Use campaigns for temporary incentives. Change a daily rate only when you intend to change the base price.</p></header><div className="manage-rates-layout"><section className="rate-date-list">{summary.rates.length === 0 ? <p>No published daily rates were found in this range.</p> : summary.rates.slice(0, 28).map((rate) => <button key={rate.stay_date} className={selectedRateDate === rate.stay_date ? 'is-selected' : ''} onClick={() => setSelectedRateDate(rate.stay_date)}><span><strong>{dateLabel(rate.stay_date)}</strong><small>{rate.tier_code.replaceAll('_', ' ')}</small></span><b>{formatInr(rate.couple_room_paise)}</b></button>)}</section>{selectedRate && <form className="rate-editor" onSubmit={(event) => void saveRate(event)}><p className="eyebrow">Editing {dateLabel(selectedRate.stay_date)}</p><h3>{selectedRate.tier_code.replaceAll('_', ' ')}</h3><label>Rate tier<input name="tier_code" defaultValue={selectedRate.tier_code} /></label><div><label>Couple room rate<input name="couple" inputMode="decimal" defaultValue={fromPaise(selectedRate.couple_room_paise)} /></label><label>Single room rate<input name="single" inputMode="decimal" defaultValue={fromPaise(selectedRate.single_room_paise)} /></label></div><div><label>Extra adult<input name="adult" inputMode="decimal" defaultValue={fromPaise(selectedRate.extra_adult_paise)} /></label><label>Child 7–12<input name="child" inputMode="decimal" defaultValue={fromPaise(selectedRate.extra_child_7_to_12_paise)} /></label></div><label>Minimum stay nights<input name="minimum_nights" type="number" min="1" defaultValue={selectedRate.minimum_stay_nights} /></label><p className="manage-hint">All amounts are in INR. This applies only to new guest quotes from this point forward.</p><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Publish this daily rate'}</button></form>}</div></section>}
    {summary && area === 'campaigns' && <section className="manage-workspace"><header><div><p className="eyebrow">Offers &amp; campaigns</p><h3>Use an offer to respond to a specific business need.</h3></div><p>Campaigns are measured separately from base-rate changes, so you can see what actually worked.</p></header><div className="manage-campaign-layout"><form className="campaign-form" onSubmit={(event) => { event.preventDefault(); void saveCampaign('draft') }}><h3>Create a campaign</h3><label>Internal campaign name<input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="November weekday escape" /></label><div><label>Stay from<input type="date" value={campaignStart} onChange={(event) => setCampaignStart(event.target.value)} /></label><label>Stay to<input type="date" value={campaignEnd} onChange={(event) => setCampaignEnd(event.target.value)} /></label></div><label>Percentage discount<input type="number" min="1" max="100" value={campaignDiscount} onChange={(event) => setCampaignDiscount(event.target.value)} /></label><fieldset><legend>Eligible stays</legend>{summary.products.filter((product) => product.active).map((product) => <label className="check-row" key={product.id}><input type="checkbox" checked={campaignProductIds.includes(product.id)} onChange={(event) => setCampaignProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />{product.name}</label>)}</fieldset><p className="manage-hint">Published percentage offers are applied to eligible new guest quotes. Existing requests, payment holds and bookings keep their original price.</p><div className="manage-form-actions"><button className="secondary" disabled={saving}>Save draft</button><button type="button" className="primary" onClick={() => void saveCampaign('active')} disabled={saving}>Publish campaign</button></div></form><section className="campaign-list"><h3>Campaigns</h3>{summary.campaigns.length === 0 ? <p>No campaigns yet. Create one only when there is a clear reason to influence demand.</p> : summary.campaigns.map((campaign) => <article key={campaign.id}><span><strong>{campaign.name}</strong><small>{campaign.stay_starts_on} → {campaign.stay_ends_on} · {campaign.discount_bps ? `${campaign.discount_bps / 100}% off` : campaign.incentive_type.replaceAll('_', ' ')}</small></span><b className={`campaign-${campaign.status}`}>{campaign.status}</b></article>)}</section></div></section>}
    {summary && area === 'experiences' && <section className="manage-workspace"><header><div><p className="eyebrow">Meals &amp; experiences</p><h3>Keep guest options accurate and easy to understand.</h3></div><p>Experience prices update new quotes only. Existing guest quotes keep the price already promised.</p></header><div className="experience-grid">{summary.experiences.map((experience) => <article key={experience.id}><span className="status-chip">{experience.active ? 'Active' : 'Hidden'}</span><h3>{experience.name}</h3><p>{experience.description ?? 'No guest-facing description yet.'}</p><strong>{formatInr(experience.amount_paise)} <small>per {experience.pricing_unit.replace('_', ' ')}</small></strong><button className="secondary" onClick={() => startExperienceEdit(experience)}>Edit experience</button></article>)}</div>{editingExperience && <form className="experience-editor" onSubmit={(event) => void saveExperience(event)}><header><div><p className="eyebrow">Editing experience</p><h3>{editingExperience.name}</h3></div><button type="button" className="text-button" onClick={() => setEditingExperienceId(null)}>Close</button></header><label>Name<input value={experienceName} onChange={(event) => setExperienceName(event.target.value)} /></label><label>Description<textarea value={experienceDescription} onChange={(event) => setExperienceDescription(event.target.value)} /></label><label>Price in INR<input inputMode="decimal" value={experiencePrice} onChange={(event) => setExperiencePrice(event.target.value)} /></label><label className="check-row"><input type="checkbox" checked={experienceActive} onChange={(event) => setExperienceActive(event.target.checked)} />Show this experience to guests</label><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save experience'}</button></form>}</section>}
    {summary && area === 'rules' && <section className="manage-workspace rules-workspace"><header><div><p className="eyebrow">Property rules</p><h3>Review the safeguards behind every guest quote.</h3></div></header><article><h3>Guest and capacity rules</h3><p>Room capacity, child rules and payment-hold behaviour are enforced centrally, so the website and owner dashboard stay consistent.</p><button className="secondary" disabled>Detailed editing comes next</button></article><article><h3>Pricing guardrails</h3><p>Daily rates change future searches. Campaigns never rewrite submitted requests, payment holds or confirmed bookings.</p><button className="secondary" onClick={() => setArea('rates')}>Review daily rates</button></article><article><h3>Current configuration</h3><pre>{JSON.stringify(summary.settings, null, 2)}</pre></article></section>}
  </section>
}
