---
name: awesome-design-md
description: "Brand design-system reference library (DESIGN.md files) for 71 well-known companies — Claude, OpenAI/x.ai, Stripe, Vercel, Linear, Notion, Figma, Apple, Tesla, Ferrari, Spotify, and more. Each entry is a plain-text design system (colors, typography, spacing, components, voice) that can be applied to generate UI matching that brand's look and feel. Use when the user wants to build, theme, or restyle an interface 'like <brand>', wants a specific brand's color/type tokens, or wants a curated real-world design system to anchor a new UI. Sourced from github.com/voltagent/awesome-design-md (MIT)."
---

# Awesome Design MD — Brand Design System Library

A curated collection of `DESIGN.md` files extracted from 71 popular brand websites. A `DESIGN.md` is a plain-text design-system document (the concept popularized by Google Stitch) that an AI agent reads to generate UI consistent with a brand: color tokens, typography scale, spacing, component patterns, and brand voice.

## When to use

Use this skill when the task involves matching or borrowing a real brand's visual design, e.g.:

- "Make this landing page look like **Stripe** / **Linear** / **Claude**."
- "Give me **Vercel**'s color and typography tokens."
- "Use a clean fintech style — pick a good reference and apply it."
- Starting a new UI and wanting a proven, real-world design system to anchor decisions.

For general (non-brand-specific) design guidance — style catalogs, palettes, font pairings, UX rules — prefer the `ui-ux-pro-max` skill. This skill is specifically for **named-brand** design systems.

## How to use

1. Identify the brand the user wants (or recommend one that fits the vibe).
2. Read its design file: `design-md/<brand>/DESIGN.md`. Each file has YAML frontmatter (`colors`, `typography`, etc.) followed by markdown describing components, layout, and voice.
3. Apply the tokens/patterns to the target framework (CSS variables, Tailwind theme, design tokens, component styles). Translate values faithfully rather than approximating.
4. If the user named a brand not in the list below, say so and offer the closest match.

## Available brands (71)

`design-md/<name>/DESIGN.md` for each:

airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, elevenlabs, expo, ferrari, figma, framer, hashicorp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier

## Notes

- Each brand folder also contains a short `README.md` describing the source.
- `UPSTREAM_README.md` and `LICENSE` (MIT) are the original repo's files, kept for attribution.
- These are design references for inspiration/consistency; respect each brand's trademarks — don't pass off generated work as the official brand.
