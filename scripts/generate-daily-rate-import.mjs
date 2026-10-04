import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const [sourcePath, destinationPath] = process.argv.slice(2)
if (!sourcePath || !destinationPath) {
  throw new Error('Usage: node scripts/generate-daily-rate-import.mjs <daily-rates.csv> <output.sql>')
}

const [headerLine, ...lines] = readFileSync(resolve(sourcePath), 'utf8').trim().split(/\r?\n/)
const headers = headerLine.split(',')
const requiredColumns = ['Date', 'Tier', 'Room_Couple', 'Room_Single', 'Extra_Adult', 'Extra_Kid', 'Group_10_Base_AI', 'Group_10_1Night_Final', 'Group_10_2Night_Final_PerNight', 'Group_15_Base_AI', 'Group_15_1Night_Final', 'Group_15_2Night_Final_PerNight']
for (const column of requiredColumns) {
  if (!headers.includes(column)) throw new Error('Missing required CSV column: ' + column)
}

function quote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'"
}

function paise(row, key) {
  const value = Number(row[key])
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid ' + key + ' for ' + row.Date)
  return Math.round(value * 100)
}

function discountBps(base, discounted) {
  return Math.round((1 - discounted / base) * 10000)
}

const values = lines.map((line) => {
  const row = Object.fromEntries(headers.map((header, index) => [header, line.split(',')[index]]))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.Date)) throw new Error('Invalid date: ' + row.Date)
  const group10Base = Number(row.Group_10_Base_AI)
  const group15Base = Number(row.Group_15_Base_AI)
  const one10 = discountBps(group10Base, Number(row.Group_10_1Night_Final))
  const one15 = discountBps(group15Base, Number(row.Group_15_1Night_Final))
  const two10 = discountBps(group10Base, Number(row.Group_10_2Night_Final_PerNight))
  const two15 = discountBps(group15Base, Number(row.Group_15_2Night_Final_PerNight))
  const eligible = one10 > 0 || one15 > 0 || two10 > 0 || two15 > 0
  const minimumStayNights = row.Tier.startsWith('Tier 1:') || row.Tier.startsWith('Tier 2:') ? 2 : 1
  return '  ((select id from public.properties where name = ' + quote('Breathe Woods') + ' limit 1), ' + quote(row.Date) + ', ' + quote(row.Tier) + ', ' + paise(row, 'Room_Couple') + ', ' + paise(row, 'Room_Single') + ', ' + paise(row, 'Extra_Adult') + ', ' + paise(row, 'Extra_Kid') + ', ' + minimumStayNights + ', true, 1, ' + eligible + ', ' + one10 + ', ' + one15 + ', ' + two10 + ', ' + two15 + ', ' + quote('Imported from ' + basename(sourcePath)) + ')'
})

const sql = '-- Generated from ' + basename(sourcePath) + '. This imports rates but deliberately does NOT activate them.\n' +
  '-- Run only after migration 202610040013_daily_pricing_calendar.sql.\n\nbegin;\n\n' +
  'insert into public.daily_pricing_calendar (\n' +
  '  property_id, stay_date, tier_code, couple_room_paise, single_room_paise,\n' +
  '  extra_adult_paise, extra_child_7_to_12_paise, minimum_stay_nights, individual_rooms_bookable,\n' +
  '  individual_room_minimum_nights, buyout_discount_eligible,\n' +
  '  buyout_one_night_discount_bps_group_10, buyout_one_night_discount_bps_group_15,\n' +
  '  buyout_two_plus_nights_discount_bps_group_10, buyout_two_plus_nights_discount_bps_group_15,\n' +
  '  notes\n) values\n' + values.join(',\n') +
  '\non conflict (property_id, stay_date) do update set\n' +
  '  tier_code = excluded.tier_code,\n  couple_room_paise = excluded.couple_room_paise,\n' +
  '  single_room_paise = excluded.single_room_paise,\n  extra_adult_paise = excluded.extra_adult_paise,\n' +
  '  extra_child_7_to_12_paise = excluded.extra_child_7_to_12_paise,\n  minimum_stay_nights = excluded.minimum_stay_nights,\n' +
  '  individual_rooms_bookable = excluded.individual_rooms_bookable,\n' +
  '  individual_room_minimum_nights = excluded.individual_room_minimum_nights,\n' +
  '  buyout_discount_eligible = excluded.buyout_discount_eligible,\n' +
  '  buyout_one_night_discount_bps_group_10 = excluded.buyout_one_night_discount_bps_group_10,\n' +
  '  buyout_one_night_discount_bps_group_15 = excluded.buyout_one_night_discount_bps_group_15,\n' +
  '  buyout_two_plus_nights_discount_bps_group_10 = excluded.buyout_two_plus_nights_discount_bps_group_10,\n' +
  '  buyout_two_plus_nights_discount_bps_group_15 = excluded.buyout_two_plus_nights_discount_bps_group_15,\n' +
  '  notes = excluded.notes,\n  updated_at = now();\n\ncommit;\n'

writeFileSync(resolve(destinationPath), sql)
console.log('Prepared ' + lines.length + ' daily rates in ' + destinationPath)
