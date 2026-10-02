import { isSupabaseConfigured } from '../../lib/config'

export function OwnerDashboard() {
  return (
    <main className="owner-shell">
      <header className="owner-header">
        <div><p className="eyebrow">Breathe Woods</p><h1>Owner dashboard</h1></div>
        <span className="status-chip">UAT foundation</span>
      </header>
      <section className="owner-grid">
        <article><h2>Today</h2><p>Arrivals, departures, payment risks and operational extras will appear here from live reservation records.</p></article>
        <article><h2>Calendar</h2><p>Zen, Bougan’villa, rooms, owner blocks and temporary payment holds will share one inventory calendar.</p></article>
        <article><h2>Quick actions</h2><p>Create assisted booking · Block dates · Request payment · Create Book-now link</p></article>
        <article><h2>Commercial settings</h2><p>Future rates, holiday rules, offers, add-ons and policies will be managed here with effective dates and history.</p></article>
      </section>
      <section className="owner-callout">
        <h2>{isSupabaseConfigured ? 'UAT connection configured' : 'Setup pending'}</h2>
        <p>{isSupabaseConfigured ? 'The project connection is ready locally. Applying the booking schema and inventory configuration is the next step before authenticated dashboard data and workflows activate.' : 'This route is intentionally not a public demo dashboard. Supabase authentication and real inventory are required before it is activated.'}</p>
      </section>
    </main>
  )
}
