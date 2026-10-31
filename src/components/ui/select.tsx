import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  getReactNodeText,
  sortByDropdownLabel,
} from "@/lib/alphabeticalDropdowns";

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  isOpen: boolean;
  openDropdown: (rect: DOMRect) => void;
  closeDropdown: () => void;
  disabled?: boolean;
  itemLabels: Record<string, string>;
  registerItem: (value: string, label: string) => void;
  triggerRect: DOMRect | null;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}

const SelectContext = React.createContext<SelectContextType>({
  isOpen: false,
  openDropdown: () => {},
  closeDropdown: () => {},
  itemLabels: {},
  registerItem: () => {},
  triggerRect: null,
  contentRef: { current: null },
});

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

const Select: React.FC<SelectProps> = ({ value, onValueChange, disabled, children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [itemLabels, setItemLabels] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const registerItem = useCallback((itemValue: string, label: string) => {
    setItemLabels(prev => prev[itemValue] === label ? prev : { ...prev, [itemValue]: label });
  }, []);

  const openDropdown = useCallback((rect: DOMRect) => {
    setTriggerRect(rect);
    setIsOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inContent = contentRef.current?.contains(target) ||
        (target instanceof Element && !!target.closest("[data-select-content]"));
      if (!inContainer && !inContent) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, openDropdown, closeDropdown, disabled, itemLabels, registerItem, triggerRect, contentRef }}>
      <div ref={containerRef} className={`relative w-full ${className || ""}`}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const btnRef = useRef<HTMLButtonElement>(null);

    const handleClick = () => {
      if (context.disabled) return;
      if (context.isOpen) {
        context.closeDropdown();
      } else {
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) context.openDropdown(rect);
      }
    };

    return (
      <button
        ref={(el) => {
          (btnRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
        }}
        type="button"
        onClick={handleClick}
        disabled={context.disabled}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-1" />
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { placeholder?: string }
>(({ className, placeholder, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  const label = context.value
    ? (context.itemLabels[context.value] || context.value)
    : "";

  return (
    <div ref={ref} className={`text-foreground flex-1 text-left truncate ${className || ""}`} {...props}>
      {label || <span className="text-muted-foreground">{placeholder || children}</span>}
    </div>
  );
});
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);

    if (!context.isOpen || !context.triggerRect) return null;

    const rect = context.triggerRect;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;

    const maxHeight = Math.min(openUpward ? spaceAbove : spaceBelow, 320);
    const width = Math.max(rect.width, 160);
    const left = Math.min(rect.left, viewportWidth - width - 8);

    const fixedStyle: React.CSSProperties = {
      position: 'fixed',
      left,
      width,
      zIndex: 99999,
      maxHeight: Math.max(maxHeight, 120),
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };

    const childArray = React.Children.toArray(children);
    const selectItems = childArray.filter(isSelectItem);
    const orderedChildren =
      selectItems.length > 1 && selectItems.length === childArray.length
        ? sortByDropdownLabel(selectItems, (item) =>
            getReactNodeText(item.props.children),
          )
        : children;

    const content = (
      <div
        ref={(el) => {
          context.contentRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        style={fixedStyle}
        data-select-content="true"
        className={`rounded-md border border-border bg-background text-foreground shadow-xl overflow-y-auto ${className || ""}`}
        {...props}
      >
        {orderedChildren}
      </div>
    );

    // Dialogs use a transform for centering. A fixed-position menu rendered
    // inside that transformed subtree is positioned against the dialog rather
    // than the viewport, which makes it appear in a corner. Portal the menu to
    // the document body so the trigger rect is always interpreted correctly.
    return createPortal(content, document.body);
  }
);
SelectContent.displayName = "SelectContent";

function isSelectItem(
  child: React.ReactNode,
): child is React.ReactElement<{ children?: React.ReactNode }> {
  if (!React.isValidElement(child)) return false;
  const type = child.type as { displayName?: string };
  return type.displayName === "SelectItem";
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: string }
>(({ className, value, children, onClick, ...props }, ref) => {
  const context = React.useContext(SelectContext);

  useEffect(() => {
    if (value !== undefined) {
      const label = typeof children === 'string' ? children : (value || "");
      context.registerItem(value, label);
    }
  }, [value]);

  const handleSelect = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    context.onValueChange?.(value || "");
    context.closeDropdown();
    onClick?.(e as React.MouseEvent<HTMLDivElement>);
  };

  const isSelected = context.value === value;

  return (
    <div
      ref={ref}
      onMouseDown={handleSelect}
      onClick={handleSelect}
      className={`px-3 py-2 cursor-pointer text-foreground text-sm hover:bg-accent hover:text-accent-foreground ${isSelected ? "bg-primary/10 font-semibold text-primary" : ""} ${className || ""}`}
      data-value={value}
      {...props}
    >
      {children}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
