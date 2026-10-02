import { BookingApp } from './features/booking/BookingApp'
import { OwnerDashboard } from './features/dashboard/OwnerDashboard'

export function App() {
  const isOwnerRoute = window.location.pathname.startsWith('/owner')
  return isOwnerRoute ? <OwnerDashboard /> : <BookingApp />
}
