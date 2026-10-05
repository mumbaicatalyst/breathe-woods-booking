import { supabase } from '../../lib/supabase'

export type CalendarRow = {
  resource_id: string; resource_name: string; resource_kind: string; allocation_id: string | null; reservation_id: string | null; allocation_state: 'hold' | 'confirmed' | 'block' | null; hold_expires_at: string | null; check_in: string | null; check_out: string | null; reservation_reference: string | null; reservation_status: string | null; guest_name: string | null; block_reason: string | null
}
export type ReservationRequestRow = { reservation_id: string; reference: string; status: string; check_in: string; check_out: string; guest_name: string | null; product_name: string | null; total_paise: number | null; created_at: string }

export type ReservationDetail = {
  reservation: {
    id: string; reference: string; status: string; check_in: string; check_out: string
    adults: number; children_7_to_12: number; children_0_to_6: number; pets: number
    source: string; guest_name: string | null; guest_email: string | null; guest_phone: string | null
    product_name: string | null; internal_note: string | null; total_paise: number | null
  }
  items: Array<{ label: string; quantity: number; amount_paise: number; item_type: string }>
  payment: { provider: string; state: string; amount_paise: number; provider_reference: string | null; expires_at: string | null } | null
  cancellation_policy: { refund_percent: number; refund_paise: number; decision: string; message: string; date_change_allowed: boolean } | null
}

export async function ownerReservationAction(reservationId: string, action: 'start_conversation' | 'decline' | 'hold_for_manual_payment' | 'confirm_manual_payment' | 'cancel', note?: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('owner_reservation_workflow_action', { p_reservation_id: reservationId, p_action: action, p_hold_hours: 12, p_note: note ?? null })
  if (error) throw new Error(error.message)
  return data as { status: string; expires_at?: string; cancellation_policy?: ReservationDetail['cancellation_policy'] }
}

export async function offerAlternativeDates(reservationId: string, checkIn: string, checkOut: string, note?: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('owner_reprice_reservation_request', { p_reservation_id: reservationId, p_check_in: checkIn, p_check_out: checkOut, p_note: note ?? null })
  if (error) throw new Error(error.message)
  return data as { status: string; total_paise: number }
}

export async function getOwnerCalendar(start: string, end: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('get_owner_calendar', { p_start: start, p_end: end })
  if (error) throw new Error(error.message)
  return data as CalendarRow[]
}

export async function getOwnerOpenReservationRequests() {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('get_owner_open_reservation_requests')
  if (error) throw new Error(error.message)
  return data as ReservationRequestRow[]
}

export async function getOwnerReservationDetail(reservationId: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('get_owner_reservation_detail', { p_reservation_id: reservationId })
  if (error) throw new Error(error.message)
  return data as ReservationDetail
}

export async function simulateUatSuccessfulPayment(reservationId: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('simulate_uat_successful_payment', { p_reservation_id: reservationId })
  if (error) throw new Error(error.message)
  return data as { status: string; reference?: string; already_confirmed?: boolean }
}
