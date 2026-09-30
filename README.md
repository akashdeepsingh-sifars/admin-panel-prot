# Diagnostics prototype

Sample-data-only React prototype of the redesigned admin diagnostics UI. Plan: `freight-flow-tech/docs/superpowers/specs/2026-09-29-diagnostics-ui-redesign-plan.md`.

    npm install
    npm run dev        # http://localhost:5173
    npm run typecheck

- Stack: Vite, React 18, TypeScript, Tailwind v3, React Router v6, react-leaflet (OpenStreetMap tiles need internet).
- All data is generated in `src/sampleData/`: 8 loads (150-325 pings each), 4 drivers, 11 runs, API/notification/GPS reports. Findings are derived from the generated pings using the same logic as the backend rules.
- Acknowledge, comments, new runs and schedules live in memory only and reset on reload.
- Phone state per ping is limited to what the mobile app can read per GPS sample on both platforms: battery, charging, power-save, network type, location permission and precision, app state.

- Hosted on GitHub Pages: https://akashdeepsingh-sifars.github.io/admin-panel-prot/ (hash routing, deployed by `.github/workflows/deploy.yml` on every push to `main`).
