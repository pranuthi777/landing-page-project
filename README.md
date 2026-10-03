# Ridgeway Instrument Co. — landing page

A single-page marketing site for a **fictional** company that builds, calibrates
and repairs handheld field instruments. Static HTML, CSS and vanilla JavaScript.
No framework, no build step, no dependencies, no web fonts.

> Ridgeway Instrument Co. is not a real company. The people, quotations,
> addresses, phone number and email address on this site are invented. The
> phone number uses the `555-01xx` range reserved for fiction and the email
> sits on the IETF-reserved `.example` domain, so neither can reach anyone.

---

## Contents

- [Preview it locally](#preview-it-locally)
- [Deploy it](#deploy-it)
- [What is on the page](#what-is-on-the-page)
- [Project structure](#project-structure)
- [Design notes](#design-notes)
- [How the JavaScript is organised](#how-the-javascript-is-organised)
- [The contact form](#the-contact-form)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Performance](#performance)
- [Checklist before you submit](#checklist-before-you-submit)
- [Fictional content](#fictional-content)

---

## Preview it locally

The site is plain files, so any static server works. From the repository root:

```bash
# Python, already present on macOS and most Linux distributions
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Any equivalent works too:

```bash
npx serve .          # Node
php -S localhost:8000
```

Opening `index.html` directly from the file system also works, with two caveats:
in-page anchors and the contact form behave slightly differently under the
`file://` protocol, and some browsers apply stricter rules to web manifests.
Use a server when you want to check the real thing.

---

## Checking it still holds up

```bash
node tools/audit.mjs
```

Exits non-zero on failure, so it drops straight into a pre-commit hook. It
checks JS and CSS syntax, HTML tag balance, that every in-page anchor has a
target, that every local file reference exists on disk, that every form field
has a `<label>`, an `aria-describedby` and a matching error element, the heading
structure, the length of the title and meta description, WCAG contrast for each
colour pair in the palette, that the stylesheet tokens have not drifted from the
palette, leftover placeholder text, and the file sizes.

It also scans for the design patterns this project is supposed to avoid, so a
gradient or a stray drop shadow cannot slip in during a later edit: gradients,
drop shadows, glow and neon, glassmorphism, purple, Inter or Space Grotesk,
emoji, checkmark bullets, bento grids, three-up pricing, terminal windows,
skeleton loaders, animated arrows, dot-grid backgrounds, em dashes, the
"Not X. Y." sentence pattern, and any corner radius larger than 2px.

It is a lint, not a test suite: it reads files rather than driving a browser.

---

## Deploy it

The repository is deployment-ready as-is. Pick whichever is easiest.

### GitHub Pages

1. Create the repository on GitHub as **`pranuthi777/landing-page-project`**.
   Leave it empty: no README, no `.gitignore`, no licence.
2. From the repository root, push:

   ```bash
   git remote add origin https://github.com/pranuthi777/landing-page-project.git
   git push -u origin main
   ```

   macOS will prompt for a GitHub username and a Personal Access Token. GitHub
   no longer accepts an account password for git operations, so use a token:
   **Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → Generate new token**, scoped to this one repository with
   **Contents: Read and write**. Nothing else is needed. An expiry date is worth
   setting.

3. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
   Branch `main`, folder `/ (root)`. Save.
4. The site is live at **`https://pranuthi777.github.io/landing-page-project/`**.

The remote and the `canonical`, `og:url` and `og:image` values in `index.html`
already point at that address, so nothing needs editing afterwards.

`404.html` is picked up automatically and GitHub Pages serves it for any missing
path.

### Netlify

1. **Add new site → Import an existing project** and connect the repository.
2. Leave build command **empty** and publish directory as `.`.
3. Deploy. The site is live at the subdomain Netlify assigns.

### Vercel

1. **Add New → Project** and import the repository.
2. Framework preset: **Other**. Leave the build command and output directory
   empty.
3. Deploy.

### If you deploy somewhere other than GitHub Pages

The absolute URLs in `index.html` are already set for
`https://pranuthi777.github.io/landing-page-project/`. If you host on Netlify or
Vercel instead, update these four lines:

- `<link rel="canonical">`
- `og:url`
- `og:image`
- `README.md`, where the live URL appears

Search engines and social platforms ignore a wrong canonical, but an `og:image`
pointing at a host you do not control produces a broken link preview, which is
visible in Slack and on social platforms.

---

## What is on the page

| Section | Contents |
| --- | --- |
| **Header** | Wordmark, four-item nav (Home, About, Services, Contact), hamburger below 880px, hairline border once the page scrolls |
| **Hero** | Headline, subtext, two calls to action, four company facts, technical drawing of the R2 meter |
| **About** | Two paragraphs of prose plus a bordered fact list (founded, workshop, people, materials, support window, lab) |
| **Services** | Four numbered entries in an index layout, then a comparison table for the R1 and R2 |
| **Testimonials** | Three long-form quotations with named roles and named employers |
| **Contact** | Address, email, phone and opening hours, plus a validated message form |
| **Footer** | Brand, page links, contact details, social links, dynamic copyright year, fiction disclaimer |

Everything is real content. No lorem ipsum, no `TODO`, no placeholder rows left
behind.

---

## Project structure

```
landing-page-project/
├── index.html              the page
├── 404.html                custom not-found page, self-contained on purpose
├── robots.txt
├── site.webmanifest        PWA metadata, points at the real icons
├── assets/
│   ├── css/styles.css      one stylesheet, commented in 17 sections
│   ├── js/main.js          one script, commented in 7 modules
│   └── img/
│       ├── favicon.svg     primary icon, 528 bytes
│       ├── favicon.ico     16/32/48px fallback, 1.4 KB
│       ├── apple-touch-icon.png  180x180, 2.2 KB
│       └── og-image.png    1200x630 link preview, 7.8 KB
├── tools/
│   ├── generate-icons.mjs  regenerates the three raster icons
│   └── audit.mjs           pre-submission lint, see below
├── .gitignore
├── LICENSE
└── README.md
```

### Why `404.html` duplicates some styles

GitHub Pages, Netlify and Vercel all serve `404.html` from the site root in
reply to *any* missing path. A relative reference to
`assets/css/styles.css` would then resolve against the URL that was requested,
for example `/anything/deep/assets/css/styles.css`, which is also missing, and
the error page would arrive unstyled.

So the 404 page carries a small inline stylesheet using the same colour tokens,
and a short script that probes upward for the directory that actually contains
`index.html` and rewrites its links against it. The duplication is deliberate
and commented as such.

### Regenerating the icons

The three raster icons are generated from the same geometry and the same colour
values as the CSS tokens:

```bash
node tools/generate-icons.mjs
```

No dependencies, it only uses `node:zlib` and `node:fs`. The output is committed
so the site never needs building.

---

## Design notes

**Palette.** Warm paper (`#f3efe6`) rather than white, near-black ink, and a
single accent (`#a63d22`) for labels, links and focus rings. Flat fills only.
No gradients, no glass, no neon.

**Type.** A system serif for reading and headings, a system monospace for
eyebrows, table headers, labels and other small metadata. Nothing is
downloaded, so there is no flash of unstyled text and no layout shift.

**Corners and depth.** A 2px radius on form fields and buttons, nothing else.
Separation comes from hairline rules and background tone changes instead of drop
shadows.

**Layout.** Fluid type with `clamp()`, a 1180px container, and two-column grids
that collapse below 880px. The services section is a numbered index with rules
between rows rather than a row of equal cards, because the four services are not
the same size of job and a grid flattens that difference.

**Motion.** Elements fade up 10px as they enter the viewport, and the schematic
in the hero draws its own strokes. Both run once. Hover states change colour and
border only. Everything is switched off under
`prefers-reduced-motion: reduce`.

---

## How the JavaScript is organised

`assets/js/main.js` is a single IIFE with seven modules, each an independent
initialiser:

1. **Helpers** — `$`, `$$`, `onFrame` for rAF throttling, `isWide` for the
   breakpoint, which mirrors the CSS.
2. **Header** — adds `.is-stuck` past 8px of scroll.
3. **Navigation** — opens and closes the hamburger panel, updates `aria-expanded`,
   closes on Escape, on outside click, on link click and on resize past the
   breakpoint. Locks body scroll while open.
4. **Scroll spy** — sets `aria-current` on the nav item for whichever section is
   under the header.
5. **Reveal** — one `IntersectionObserver`, and it unobserves each element once
   it has been revealed so nothing fires twice.
6. **Year** — writes the current year into the footer.
7. **Form** — validation, error summary, composed message, clipboard.

Every module bails out early if its markup is missing, so the file is safe to
include on a partial page.

---

## The contact form

There is no backend, and the page does not pretend otherwise.

- **Validates in the browser.** Required fields, a length floor on the message,
  and a permissive email pattern. Each field shows its own error, and a summary
  panel at the top lists every problem as a link to the field.
- **Validation timing.** A field is checked when you leave it, and then live as
  you type if it was already wrong. Errors appear as soon as you submit once.
  `aria-invalid` and `aria-describedby` are wired up, and the status region is
  `role="status"` with `aria-live="polite"`, so successes and failures are both
  announced.
- **On success it says so honestly.** The panel is headed *Message ready, not
  sent*, explains that there is no server behind a static page, and shows the
  composed message in a copyable box with two buttons: *Open in mail app*, which
  builds a prefilled `mailto:`, and *Copy message*, which uses the async
  Clipboard API with a `document.execCommand` fallback for older browsers.
- **Clear form** resets every field, error and panel, and returns focus to the
  first input.

To make it send for real, point the submit handler at a form service (Formspree,
Netlify Forms, Basin) and replace the `showSuccess` body with a `fetch` POST.

---

## Accessibility

- Skip link as the first focusable element, visible on focus.
- One `h1`, sensible heading order, landmarks for header, main, footer and both
  nav regions.
- The mobile menu is a real `<button>` with `aria-expanded` and `aria-controls`.
  Escape closes it and returns focus to the button.
- `aria-current="true"` tracks the visible section.
- Visible focus ring on every interactive element, never removed.
- All form inputs have real `<label>`s, hint text via `aria-describedby`, and
  inline errors wired with `aria-invalid`.
- Every animation respects `prefers-reduced-motion`.
- Colour contrast: body text `#4b473c` on `#f3efe6` is about 7.5:1, the accent
  `#a63d22` on paper is about 6:1, and `--ink-faint` is used only for text at
  label size and above.
- Touch targets on the mobile nav are full-width and at least 44px tall.

---

## Browser support

Current Chrome, Edge, Firefox and Safari, desktop and mobile. The CSS uses
custom properties, `clamp()`, grid and `100dvh`. `dvh` has a `vh` fallback
immediately before it. The JavaScript uses `IntersectionObserver`,
`fetch`-free XHR for the 404 path probe, and both the modern and legacy
clipboard APIs.

---

## Performance

No web fonts, no framework, no images above 8KB, and no third-party requests of
any kind. Everything is served from the repository itself.

| File | Size |
| --- | --- |
| `index.html` | 29.4 KB |
| `404.html` | 9.1 KB |
| `assets/css/styles.css` | 28.6 KB |
| `assets/js/main.js` | 18.2 KB |
| All four images together | 11.7 KB |

That is about 97 KB of everything, before compression,
served in four requests with no third-party traffic.

The CSS and JS are both deferred or render-blocking only where it matters: the
stylesheet is a normal blocking link, and `main.js` is `defer`red. A single
one-line inline script marks the document so the hero is never briefly visible in
its pre-animation state.

---

## Checklist before you submit

Run through this once:

- [ ] `<title>` and `<meta name="description">` describe *this* company.
- [ ] `canonical`, `og:url` and `og:image` point at your deployed domain.
- [ ] Copyright year updates itself (it is wired to the visitor's clock).
- [ ] No link in the page goes to an invented profile URL. The social links go to
      platform homepages, which is stated on the page.
- [ ] Form errors, success panel, placeholders and reset all work.
- [ ] Hamburger opens, closes on link click, on Escape and on outside click.
- [ ] No sideways scrolling at 320px, 375px, 768px, 1024px and 1440px. Verified
      in headless Chromium at 320, 375, 414, 600, 768, 880, 1024, 1280, 1440 and
      1920: `scrollWidth` equals `clientWidth` at every width.
- [ ] `https://<your-domain>/does-not-exist` shows the custom 404 and its links
      still work.
- [ ] Keyboard-only pass: Tab from the top, the skip link appears first.
- [ ] Reduced-motion pass: enable the setting in your OS and reload. Everything
      is visible immediately, nothing moves.
- [ ] Repository is public and the live URL is publicly reachable, so a reviewer
      can open both without asking you for access.

---

## Fictional content

One note, stated plainly so nobody is misled.

Ridgeway Instrument Co. is invented for this exercise. The company, the two
products, the specifications, the three customers, the quotations and the staff
are all fiction, written so the layout could be judged on real text of realistic
length instead of lorem ipsum. Nothing on this page is a claim about a real
business, and the footer says so on the page itself.

---

## Licence

MIT. See [LICENSE](LICENSE).