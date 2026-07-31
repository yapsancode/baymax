# Styleguide

Six of us touch this codebase. The rules below exist so the UI doesn't look
like six different apps. When in doubt, open the live styleguide:

```
npm run dev
# then visit http://localhost:5173/styleguide.html
```

Every token and component lives there. If you can't find what you need on that
page, ask in the group chat before reaching for raw Tailwind utilities.

---

## The 5 rules people break first

1. **Don't write raw colors.** No `bg-blue-500`, no `text-red-600`, no
   `border-gray-200`. Use tokens — `bg-info-soft`, `text-danger`,
   `border-border`. If you genuinely need a color that doesn't exist, add it
   to `src/index.css` under `@theme` and tell the team.

2. **Don't pick font sizes by number.** Use the semantic type scale:
   `text-h1`, `text-h2`, `text-body`, `text-small`, `text-caption`,
   `text-display`. They already set the right size + line-height + weight
   together. Avoid `text-xs`/`text-sm`/`text-lg` unless you have a clear
   reason.

3. **Don't build a custom button.** Use `<Button>` from `@/components/ui`.
   Same for `<Badge>`, `<Card>`, `<Input>`, `<Toggle>`, `<ProgressBar>`.
   If you need a variant that doesn't exist, add it to the component
   (not inline).

4. **Stick to Tailwind's spacing scale.** `p-2 / p-3 / p-4 / p-6 / p-8`,
   `gap-2 / gap-3 / gap-4`. Don't reach for `p-5` or `gap-7` — they break
   the rhythm.

5. **One radius per element type.** Cards = `rounded-xl`, buttons & inputs
   = `rounded-lg`, badges = `rounded-full`, small chips = `rounded-md`.
   Pick the one that matches the element role, don't sample randomly.

---

## Where things live

- **Tokens** — `src/index.css` (`@theme` block). Colors, type scale, radius,
  font.
- **UI components** — `src/components/ui/` (`Button`, `Badge`, `Card`,
  `Input`, `Toggle`, `ProgressBar`).
- **Shared bits with logic** — `src/components/shared/` (`BaymaxLogo`,
  `TaskIcon`).
- **Pages** — `src/pages/<Screen>/index.jsx`. One person per page.
- **Live styleguide** — `src/pages/Styleguide/`. When you add a token or
  component, add it here too.

---

## Type scale (quick reference)

| Class          | Use for                                            |
| -------------- | -------------------------------------------------- |
| `text-display` | Hero moments only — "Backend is live", big numbers |
| `text-h1`      | Screen title                                       |
| `text-h2`      | Card titles, section headers                       |
| `text-body`    | Default paragraph                                  |
| `text-small`   | Secondary text, descriptions                       |
| `text-caption` | Labels, badges, timestamps, meta                   |

## Colors (quick reference)

| Token               | Use for                                     |
| ------------------- | ------------------------------------------- |
| `background`        | Page background                             |
| `foreground`        | Default text                                |
| `card`              | Card / panel background (white)             |
| `muted`             | Subtle background (page bg behind cards)    |
| `muted-foreground`  | De-emphasised text                          |
| `border`            | All borders                                 |
| `primary`           | Brand actions, primary buttons, links       |
| `accent`            | Soft brand background (logo bg, active tab) |
| `success` / `-soft` | Completed states                            |
| `warning` / `-soft` | Pending / incomplete states                 |
| `danger` / `-soft`  | Destructive actions, errors                 |
| `info` / `-soft`    | Active / in-progress states                 |

The `-soft` variants are for badge / chip backgrounds. Pair them with the
plain `-foreground` for text on top.

---

## Formatting

We use Prettier. Run before pushing:

```
npm run format
```

Or set your editor to format on save. The config (`.prettierrc.json`) uses
single quotes, no semicolons, and the Tailwind class-sort plugin — so your
class lists end up in the same order regardless of who wrote them.

---

## Adding something new

- **A new color** — add it to `@theme` in `src/index.css`, then add a swatch
  to the styleguide page.
- **A new component variant** — add it to the existing component file
  (don't fork it), then add it to the styleguide page.
- **A whole new component** — create it under `src/components/ui/` (purely
  visual) or `shared/` (visual + logic), export it from the matching
  `index.js`, and add a section to the styleguide page.

If you're not sure where something belongs, ask before writing it.
