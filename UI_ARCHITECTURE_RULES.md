# Enterprise UI/UX Architecture Rules

## Global Rule

Use dialogs only for small, single-purpose, low-content actions.

Allowed dialog use cases:

- Delete confirmation
- Small warning or status confirmation
- Tiny note input
- Quick approve/reject action
- Compact selection menus
- Lightweight preview

Do not use dialogs for workflows that include:

- Multi-section forms
- Tables
- File uploads
- Card-heavy content
- Multi-step processes
- Advanced editing
- Analytics and operational management

These workflows must be implemented as fullscreen pages.

## Mandatory Fullscreen Modules

Always fullscreen:

- Master Catalogue add and edit flows
- Vendor configuration workflows
- User configuration workflows
- Role and permission management workflows
- Workflow configuration workflows
- Client profile and contract workflows
- Product creation/editing/detail workflows
- AMC creation/editing workflows

## Strict Size Rule

If modal content requires internal scrolling, the modal is invalid.
Convert that flow into a fullscreen page.

## UX Direction

Enterprise pages should prioritize:

- Spacious layout
- High information density with clear hierarchy
- Sticky action bars for long workflows
- Predictable navigation and route-based state
- Minimal overlay interruption

## Engineering Enforcement

When implementing new features:

- Default to route-based pages for operational workflows
- Use dialogs only after validating the scope is compact
- Avoid adding `DialogContent` containers with multi-column forms, tables, or upload areas
