import { isCurrencyCode } from '@household-hub/domain'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SelectField } from '@/components/SelectField'
import { deviceTimeZone } from '@/features/household'
import { newUuid } from '@/lib/uuid'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type { Trip } from './data'
import { defaultTripDateRange } from './dateRange'
import { normalizeCurrencyInput } from './forms'
import { deleteTrip, saveTrip } from './mutations'
import { TripDateRangeField } from './TripDateRangeField'

// A short curated list; any valid IANA name may still be typed.
const COMMON_ZONES = [
  'America/Toronto',
  'America/Vancouver',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Australia/Sydney',
]

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

interface TripSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip | null
}

/** Create or edit a trip (destination, dates, timezone, currency). */
export function TripSheet({ open, onOpenChange, householdId, trip }: TripSheetProps) {
  const { tokens } = useTheme()
  const initialRange = trip
    ? { startDate: trip.startDate, endDate: trip.endDate }
    : defaultTripDateRange()
  const [name, setName] = useState(trip?.name ?? '')
  const [destination, setDestination] = useState(trip?.destination ?? '')
  const [currency, setCurrency] = useState(normalizeCurrencyInput(trip?.destinationCurrency ?? 'CAD'))
  const [timezone, setTimezone] = useState(trip?.destinationTimezone ?? deviceTimeZone())
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (name.trim().length === 0 || destination.trim().length === 0) {
      setError('Give the trip a name and destination.')
      return
    }
    if (endDate < startDate) {
      setError('The end date must be on or after the start date.')
      return
    }
    if (!isCurrencyCode(currency)) {
      setError('Enter a valid three-letter ISO currency code.')
      return
    }
    if (!isTimeZone(timezone)) {
      setError('Enter a valid IANA destination timezone.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveTrip(
        householdId,
        {
          id: trip?.id ?? newUuid(),
          name,
          destination,
          timezone,
          startDate,
          endDate,
          destinationCurrency: currency,
        },
        trip?.revision ?? null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this trip.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!trip) return
    setSaving(true)
    try {
      const outcome = await deleteTrip(householdId, trip.id, trip.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (failure) {
      setConfirmDelete(false)
      setError(operationThrownError(failure, 'Could not delete this trip.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={trip ? 'Edit trip' : 'New trip'}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>

      <View style={[styles.fieldset, { backgroundColor: tokens.cardAlt, borderRadius: tokens.radiusCard }]}>
        <Text style={[styles.legend, { color: tokens.ink }]}>Destination setup</Text>
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>City or destination</Text>
          <TextInput
            accessibilityLabel="City or destination"
            value={destination}
            onChangeText={setDestination}
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink, backgroundColor: tokens.card },
            ]}
          />
        </View>
        <View style={styles.field}>
          <SelectField
            label="Destination timezone"
            value={COMMON_ZONES.includes(timezone) ? timezone : COMMON_ZONES[0]}
            onChange={setTimezone}
            options={COMMON_ZONES.map((z) => ({ value: z, label: z }))}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>Destination currency</Text>
          <TextInput
            accessibilityLabel="Destination currency"
            value={currency}
            onChangeText={(v) => setCurrency(normalizeCurrencyInput(v))}
            maxLength={3}
            autoCapitalize="characters"
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink, backgroundColor: tokens.card },
            ]}
          />
        </View>
        {destination.trim() && timezone.trim() && currency ? (
          <Text style={[styles.preview, { color: tokens.muted }]}>
            {destination.trim()} · {timezone.trim()} · {currency}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <TripDateRangeField
          startDate={startDate}
          endDate={endDate}
          onChange={(range) => {
            setStartDate(range.startDate)
            setEndDate(range.endDate)
          }}
        />
      </View>

      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={[
            styles.saveButton,
            { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
            saving && styles.disabled,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Save</Text>
        </Pressable>
        {trip ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => setConfirmDelete(true)}
            style={[styles.deleteButton, saving && styles.disabled]}
          >
            <Text style={[styles.deleteButtonText, { color: tokens.danger }]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete trip?"
        description="This removes the trip and its expenses. This cannot be undone."
        error={confirmDelete ? error : null}
        confirmLabel="Delete"
        confirmDisabled={saving}
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  fieldset: { padding: 12, marginBottom: 14 },
  legend: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  preview: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  error: { fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
