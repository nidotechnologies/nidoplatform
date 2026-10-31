import * as React from "react"

interface ScrollAreaProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`overflow-auto ${className || ''}`}
      {...props}
    />
  )
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
