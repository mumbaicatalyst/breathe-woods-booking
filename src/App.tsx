import { BookingApp } from './features/booking/BookingApp'
import { OwnerDashboard } from './features/dashboard/OwnerDashboard'
import { PrivacyMessagingNotice } from './features/legal/PrivacyMessagingNotice'
import { CancellationRefundTerms } from './features/legal/CancellationRefundTerms'

export function App() {
  const isOwnerRoute = window.location.pathname.startsWith('/owner')
  const isPrivacyRoute = window.location.pathname.startsWith('/privacy-and-messaging')
  const isCancellationRoute = window.location.pathname.startsWith('/cancellation-and-refunds')
  if (isPrivacyRoute) return <PrivacyMessagingNotice />
  if (isCancellationRoute) return <CancellationRefundTerms />
  return isOwnerRoute ? <OwnerDashboard /> : <BookingApp />
}
