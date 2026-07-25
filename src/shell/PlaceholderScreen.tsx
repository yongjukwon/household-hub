import { Screen } from './Screen'

/**
 * Temporary content for a destination whose real feature flow lands in Task 6.
 * Renders inside the finished Task 5 shell so navigation/appearance can be
 * validated before the screens exist.
 */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <div
        className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-8 text-center shadow-[var(--hh-shadow-card)]"
      >
        <p className="text-[var(--hh-muted)]">Coming soon.</p>
      </div>
    </Screen>
  )
}
