import { Checkbox } from '@/components/ui/checkbox'
import { RowMenu } from '@/components/common/RowMenu'
import type { GroceryItem } from '@/hooks/useGroceries'
import { PriceHistoryPopover } from './PriceHistoryPopover'

interface GroceryItemRowProps {
  item: GroceryItem
  formatCurrency: (amount: number) => string
  onToggle: (item: GroceryItem) => void
  onEdit: (item: GroceryItem) => void
  onDelete: (item: GroceryItem) => void
}

export function GroceryItemRow({
  item,
  formatCurrency,
  onToggle,
  onEdit,
  onDelete,
}: GroceryItemRowProps) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Checkbox
        id={`grocery-${item.id}`}
        checked={item.checked}
        onCheckedChange={() => onToggle(item)}
        aria-label={item.name}
      />
      <label
        htmlFor={`grocery-${item.id}`}
        className={`min-w-0 flex-1 truncate text-sm ${
          item.checked
            ? 'text-[var(--meta)] line-through'
            : 'text-[var(--text)]'
        }`}
      >
        {item.name}
      </label>
      {item.last_price !== null && (
        <span className="text-sm font-medium text-[var(--text)]">
          {formatCurrency(item.last_price)}
        </span>
      )}
      <PriceHistoryPopover
        nameNormalized={item.name_normalized ?? ''}
        itemName={item.name}
        formatCurrency={formatCurrency}
      />
      <RowMenu
        label={`Actions for ${item.name}`}
        onEdit={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      />
    </li>
  )
}
