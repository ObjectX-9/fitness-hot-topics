import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props}/>;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn('flex h-8 min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [&_[data-slot=select-value]]:truncate', className)} {...props}>
    {children}<SelectPrimitive.Icon><ChevronDown className="size-3.5 shrink-0 opacity-50"/></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return <SelectPrimitive.Portal><SelectPrimitive.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-50">
    <SelectPrimitive.Popup data-slot="select-content" className={cn('max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none', className)} {...props}>
      <SelectPrimitive.List>{children}</SelectPrimitive.List>
    </SelectPrimitive.Popup>
  </SelectPrimitive.Positioner></SelectPrimitive.Portal>;
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn('relative flex cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50', className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center"><Check className="size-4"/></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
