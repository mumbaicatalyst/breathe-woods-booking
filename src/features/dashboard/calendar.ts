import { supabase } from '../../lib/supabase'

export type CalendarRow = {
  resource_id: string; resource_name: string; resource_kind: string; allocation_id: string | null; allocation_state: 'hold' | 'confirmed' | 'block' | null; hold_expires_at: string | null; check_in: string | null; check_out: string | null; reservation_reference: string | null; reservation_status: string | null; guest_name: string | null; block_reason: string | null
}

export async function getOwnerCalendar(start: string, end: string) {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('get_owner_calendar', { p_start: start, p_end: end })
  if (error) throw error
  return data as CalendarRow[]
}
