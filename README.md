# React + TypeScript + Vite

## Bunzl Unified AI Portal

The development dashboard uses a separate mock API for demo sign-in, assigned
modules, quota, requests, sessions, usage history, settings, and basic admin
operations. Applications
open in separate tabs. No real AI provider or notification service is called.
Demo tokens are held in memory, not localStorage. Data from the earlier
localStorage prototype is not imported or deleted.

### Run the demo

Install Node.js 24 or newer. From the project folder run:

```sh
npm install
```

In one terminal, start the mock API:

```sh
npm run dev:mock
```

In a second terminal, start the frontend:

```sh
npm run dev
```

Open the frontend address printed by Vite. Choose a demo profile and sign in.
Open Spark, submit a request in the new tab, select **Exit session**, and return
to the portal. The session summary and refreshed quota will appear. The limited
profile demonstrates that unassigned applications are hidden.

The mock listens on `127.0.0.1:3001` and stores data only in server memory;
restarting it resets the demo. Vite proxies `/api` to the mock in development.
The demo is not real authentication, authorization, or production metering.
Avoid entering sensitive information.

### Verify

```sh
npm run build
npm run lint
npm test
npm run test:mock
npx playwright install chromium --only-shell
npm run test:e2e
```

Browser tests start separate mock and Vite processes on ports 3002 and 4174.

### Production integration status

Production sign-in intentionally shows an unavailable message rather than
falling back to mock authentication. Entra/MSAL sign-in and token exchange,
approved APIM and module URLs, real module session integration, complete
reporting/sorting, and production API contract validation remain unimplemented.
The demo admin editor uses the administrator's assigned modules as its registry
and does not permit self-editing; a production admin registry and quota-group
contract must be confirmed. The mock API and its demo identities must never be deployed as
production security controls. Confirm the contracts and issuer/audience with
the backend and APIM owners. `.env.example` lists placeholders; never put
secrets in Vite environment variables.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
