# NIDO Procurement Platform - Frontend

A modern, professional procurement management application built with React, TypeScript, and Vite.

## Features

- **Dashboard & Analytics** - Main dashboard with SLA overview and metrics
- **Vendor Management** - Vendor list, orders, categories, and onboarding
- **Client Management** - Client list, add clients, and contract management
- **Procurement** - Orders, requests, and approval workflows
- **Reports** - Analytics and audit trails
- **Transactions** - Sales (quotes, orders, invoices) and purchases (expenses, POs, bills)
- **User Management** - User roles, departments, invitations, and audit logs
- **Shop** - Product catalog and e-commerce
- **Dark Theme UI** - Professional dark-themed interface with responsive design

## Tech Stack

- React 19.2
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React (icons)

## Getting Started

### Installation

```bash
npm ci
# or
pnpm install
# or
yarn install
```

For a Replit import, prefer `npm ci`: this uses the committed
`package-lock.json` exactly and avoids dependency-resolution work. The
repository already includes its Replit workflow and does not need project
migration or restructuring.

### Development

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
# or
pnpm build
# or
yarn build
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # Navigation, sidebar, top bar
│   ├── ui/              # Reusable UI components
│   └── shared/          # Shared utilities
├── pages/               # Page components for each route
├── contexts/            # React contexts for state management
├── store/               # Global state management
└── App.tsx              # Main app component with routing
```

## Navigation Structure

- Dashboard (Main Dashboard, SLA Overview)
- Shop
- Services & New AMC
- Support
- Clients (List, Add, Contracts)
- Vendors (List, Orders, Dashboard, Categories, Onboarding)
- Procure (Orders, Requests, Approvals)
- Reports (Analytics, Audit Trail)
- Transactions - Sales (Quotes, Orders, Invoices, Recurring, Delivery, Receipts, Credits, e-Way Bills)
- Transactions - Purchases (Expenses, Recurring, POs, Bills, Payments, Credits)
- User Management (Users, Roles, Departments, Invitations, Audit Trail)
- Configuration
