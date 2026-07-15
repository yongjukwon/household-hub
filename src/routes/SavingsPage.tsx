import { SavingsPageView } from '@/components/savings/SavingsPageView'

// Top-level /savings route. Savings is a single household-wide list (no
// per-section pages), so it lives outside the NAV_ITEMS/page_section system —
// like /settings.
export default function SavingsPage() {
  return <SavingsPageView />
}
