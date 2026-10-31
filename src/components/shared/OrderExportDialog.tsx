import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EMPTY_ORDER_EXPORT_FILTERS, type OrderExportFilters } from "@/lib/orderExportFilters";

export interface OrderExportOption {
  value: string;
  label: string;
}

interface OrderExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: OrderExportOption[];
  clients: OrderExportOption[];
  onExport: (filters: OrderExportFilters) => void | boolean | Promise<void | boolean>;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onSelectedChange,
  search,
  onSearchChange,
  open,
  onOpenChange,
}: {
  label: string;
  options: OrderExportOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  search: string;
  onSearchChange: (search: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(query))
      : options;
  }, [options, search]);
  const pluralLabel = label === "Status" ? "statuses" : "clients";
  const selectedLabel = selected.length === 0
    ? `All ${pluralLabel}`
    : `${selected.length} ${selected.length === 1 && label === "Status" ? "status" : pluralLabel} selected`;

  const toggleOption = (value: string, checked: boolean) => {
    onSelectedChange(checked
      ? [...selected, value]
      : selected.filter((item) => item !== value));
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={12}
            className="z-[80] flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
            style={{
              width: "min(max(var(--radix-popover-trigger-width), 20rem), calc(100vw - 2rem))",
              maxHeight: "min(34rem, var(--radix-popover-content-available-height, 34rem))",
            }}
          >
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={`Search ${label.toLocaleLowerCase()}...`}
                  className="h-9 pl-8"
                  aria-label={`Search ${label.toLocaleLowerCase()}`}
                />
              </div>
              <div className="mt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => onSelectedChange(options.map((option) => option.value))}
                  className="text-xs text-primary hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onSelectedChange([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
            <div role="group" aria-label={label} className="min-h-0 overflow-y-auto p-1">
              {visibleOptions.length ? visibleOptions.map((option) => {
                const checked = selected.includes(option.value);
                const checkboxId = `${label.toLocaleLowerCase()}-option-${option.value.replace(/[^a-z0-9_-]/gi, "-")}`;
                return (
                  <div
                    key={option.value}
                    className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(nextChecked) => toggleOption(option.value, nextChecked === true)}
                    />
                    <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer truncate">{option.label}</label>
                  </div>
                );
              }) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">No {pluralLabel} found.</p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
}

export default function OrderExportDialog({
  open,
  onOpenChange,
  statuses,
  clients,
  onExport,
}: OrderExportDialogProps) {
  const [filters, setFilters] = useState<OrderExportFilters>({ ...EMPTY_ORDER_EXPORT_FILTERS });
  const [openDropdown, setOpenDropdown] = useState<"status" | "client" | null>(null);
  const [statusSearch, setStatusSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilters({ ...EMPTY_ORDER_EXPORT_FILTERS });
    setOpenDropdown(null);
    setStatusSearch("");
    setClientSearch("");
    setIsExporting(false);
    setExportError("");
  }, [open]);

  const invalidDateRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);

  const handleExport = async () => {
    if (invalidDateRange || isExporting) return;
    setIsExporting(true);
    setExportError("");
    try {
      const shouldClose = await onExport(filters);
      if (shouldClose !== false) onOpenChange(false);
    } catch {
      setExportError("The CSV could not be generated. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>Export orders</DialogTitle>
          <DialogDescription>
            Narrow the current results by order date, status, or client. Leave a filter unselected to include all matching values.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-3 sm:grid-cols-2">
          <div>
            <label htmlFor="order-export-from" className="mb-1.5 block text-sm font-medium text-foreground">From date</label>
            <Input
              id="order-export-from"
              type="date"
              value={filters.fromDate}
              max={filters.toDate || undefined}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="order-export-to" className="mb-1.5 block text-sm font-medium text-foreground">To date</label>
            <Input
              id="order-export-to"
              type="date"
              value={filters.toDate}
              min={filters.fromDate || undefined}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            />
          </div>

          <MultiSelectDropdown
            label="Status"
            options={statuses}
            selected={filters.statuses}
            onSelectedChange={(selected) => setFilters((current) => ({ ...current, statuses: selected }))}
            search={statusSearch}
            onSearchChange={setStatusSearch}
            open={openDropdown === "status"}
            onOpenChange={(nextOpen) => setOpenDropdown(nextOpen ? "status" : null)}
          />
          <MultiSelectDropdown
            label="Client"
            options={clients}
            selected={filters.clients}
            onSelectedChange={(selected) => setFilters((current) => ({ ...current, clients: selected }))}
            search={clientSearch}
            onSearchChange={setClientSearch}
            open={openDropdown === "client"}
            onOpenChange={(nextOpen) => setOpenDropdown(nextOpen ? "client" : null)}
          />
        </div>

        {invalidDateRange && (
          <p role="alert" className="text-sm text-destructive">The start date must be on or before the end date.</p>
        )}
        {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters({ ...EMPTY_ORDER_EXPORT_FILTERS })}
            disabled={isExporting}
            className="sm:mr-auto"
          >
            Clear filters
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleExport} disabled={invalidDateRange || isExporting}>
              {isExporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}