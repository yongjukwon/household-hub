// Shared household currency formatting. CAD because this household is in
// Canada and no currency preference exists yet — centralized here so a future
// Settings option can make it configurable in one place. (Was previously
// duplicated in BudgetPageView and GroceryPageView.)
const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CAD',
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}
