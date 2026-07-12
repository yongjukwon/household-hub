import { cn } from '@/lib/utils'

// A 24-hour time control: two dropdowns (hour 00–23, minute 00–59) so there's
// no AM/PM to choose and no dependence on the device's clock format, unlike a
// native <input type="time">. Value is "HH:MM" or "" (no time). The hour drives
// presence — clearing it clears the time; picking an hour defaults the minute
// to "00".
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  hourLabel: string
  minuteLabel: string
  className?: string
}

export function TimeSelect({
  value,
  onChange,
  hourLabel,
  minuteLabel,
  className,
}: TimeSelectProps) {
  const [hour = '', minute = ''] = value ? value.split(':') : []

  function emit(nextHour: string, nextMinute: string) {
    onChange(nextHour ? `${nextHour}:${nextMinute || '00'}` : '')
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <select
        aria-label={hourLabel}
        className={selectClassName}
        value={hour}
        onChange={(event) => emit(event.target.value, minute)}
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-[var(--meta)]">
        :
      </span>
      <select
        aria-label={minuteLabel}
        className={selectClassName}
        value={minute}
        onChange={(event) => emit(hour, event.target.value)}
      >
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
