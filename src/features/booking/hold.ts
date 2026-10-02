import { supabase } from '../../lib/supabase'
import type { QuoteInput } from './quote'

export type HoldInput = QuoteInput & { guestName: string; guestEmail: string; guestPhone: string }
export type BookingHold = { reservation_id: string; reference: string; payment_id: string; expires_at: string; total_paise: number }

export async function createBookingHold(input: HoldInput): Promise<BookingHold> {
  if (!supabase) throw new Error('UAT connection has not been configured.')
  const { data, error } = await supabase.rpc('create_uat_booking_hold', {
    p_product_id: input.productId, p_check_in: input.checkIn, p_check_out: input.checkOut,
    p_adults: input.adults, p_children_7_to_12: input.children7To12, p_children_0_to_6: input.children0To6, p_pets: input.pets,
    p_meal_plan: input.mealPlan, p_bonfire_sessions: input.bonfireSessions, p_lake_outings: input.lakeOutings,
    p_guest_name: input.guestName, p_guest_email: input.guestEmail, p_guest_phone: input.guestPhone,
  })
  if (error) throw error
  return data as BookingHold
}
