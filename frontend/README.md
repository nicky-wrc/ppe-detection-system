# PPE Guard AI Frontend

React 19 + TypeScript dashboard for PPE monitoring, camera operations, alert review, and safety reporting.

## Local development

```powershell
npm.cmd ci
npm.cmd run dev
```

The local UI defaults to `http://localhost:5173`. Set `VITE_API_URL` in `.env` when the backend is not available at `http://localhost:8000/api/v1`.

## Validation

```powershell
npm.cmd run lint
npm.cmd exec tsc -- --noEmit -p tsconfig.app.json
npm.cmd run build
```

## Visual system

The interface follows the repository's `apple.design.md` reference: Action Blue (`#0066cc`) is the single interactive accent, utility cards use soft hairlines with an 18px radius, actions use pill geometry, and page rhythm alternates white, parchment, and near-black surfaces without decorative gradients or UI shadows. Global design tokens and shared application chrome live in `src/index.css`.
