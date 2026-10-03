import { BookingApp } from './features/booking/BookingApp'
import { OwnerDashboard } from './features/dashboard/OwnerDashboard'
import { PrivacyMessagingNotice } from './features/legal/PrivacyMessagingNotice'

export function App() {
  const isOwnerRoute = window.location.pathname.startsWith('/owner')
  const isPrivacyRoute = window.location.pathname.startsWith('/privacy-and-messaging')
  if (isPrivacyRoute) return <PrivacyMessagingNotice />
  return isOwnerRoute ? <OwnerDashboard /> : <BookingApp />
}
