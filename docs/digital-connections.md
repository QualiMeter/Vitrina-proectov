# Digital Connections

`AmbientBackground` renders one inline SVG motif of curved strands, links, and nodes. The `hero`, `auth`, and `dashboard` variants share the same geometry and differ only in opacity, placement, and motion. Its wrapper is hidden from assistive technology and cannot receive pointer input.

- `hero`: visible behind the home hero; slow opacity/transform drift and a sparse path accent.
- `auth`: softer edges and a clear central region for a form; slower motion.
- `dashboard`: faint top-edge detail with no animation, mounted in student and AppShell main areas.

After PR #12 is merged, import `AmbientBackground` from `frontend/src/components/background/AmbientBackground` in the shared auth layout. Put `<AmbientBackground variant="auth" />` as the first child of a `position: relative; isolation: isolate` layout wrapper, then keep the form container at `position: relative; z-index: 1`. The auth layout should use a light opaque form surface. No auth pages are added here.

## Playwright captures

These screenshots were captured from the production build running in Chromium and are committed for PR review:

- [Home · 1920 px](screenshots/digital-connections/home-1920.png)
- [Home · 1280 px](screenshots/digital-connections/home-1280.png)
- [Home · 375 px](screenshots/digital-connections/home-375.png)
- [Student · 1280 px](screenshots/digital-connections/student-1280.png)
- [Student · 375 px](screenshots/digital-connections/student-375.png)
- [University · 1280 px](screenshots/digital-connections/university-1280.png)
