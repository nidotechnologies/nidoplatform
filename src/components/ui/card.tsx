import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border border-border bg-card text-card-foreground shadow-sm ${className || ""}`}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`${className || ""}`} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`pb-4 ${className || ""}`} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={`text-lg font-semibold leading-tight ${className || ""}`} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className || ""}`} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
