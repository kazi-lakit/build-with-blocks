# Project OS

A React + TypeScript + Vite application with OIDC authentication.

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Environment Setup

Copy the example environment file and configure your values:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

- `VITE_API_URL` - API base URL
- `VITE_OIDC_TENANT_ID` - OIDC tenant ID
- `VITE_CLIENT_ID` - OAuth client ID
- `VITE_CLIENT_SECRET` - OAuth client secret
- `VITE_TENANT_ID` - Tenant ID
- `VITE_REDIRECT_URI` - OAuth redirect URI

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Oxlint
