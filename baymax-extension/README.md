# Baymax — GCP Setup Guide

AI-powered Chrome Extension that guides developers through Google Cloud setup.

---

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Who Builds What

| Person    | File                                               | Screen                   |
| --------- | -------------------------------------------------- | ------------------------ |
| Person 1  | `src/pages/Home/index.jsx`                         | Task selection screen    |
| Person 2  | `src/pages/Guidance/index.jsx`                     | Step by step guidance    |
| Person 3  | `src/pages/Complete/index.jsx`                     | Completion summary       |
| Person 4  | `src/pages/Dashboard/Overview.jsx` + `History.jsx` | Dashboard tabs           |
| Person 5  | `src/pages/Dashboard/Settings.jsx` + `index.jsx`   | Settings + nav           |
| Tech Lead | `src/App.jsx` + `src/components/`                  | Everything connects here |

---

## Project Structure

```
src/
├── components/
│   ├── ui/           # Button, Badge, Card, Toggle, ProgressBar, Input
│   └── shared/       # BaymaxLogo, TaskIcon
├── pages/
│   ├── Home/
│   ├── Guidance/
│   ├── Complete/
│   └── Dashboard/    # index.jsx, Overview.jsx, History.jsx, Settings.jsx
├── lib/
│   └── utils.js      # cn() helper
└── App.jsx           # Main file — Tech Lead only
```

---

## How to Import Components

```jsx
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardContent,
  Toggle,
  ProgressBar,
  Input,
} from '@/components/ui'
import { BaymaxLogo, TaskIcon } from '@/components/shared'
```

---

## Component Examples

### Button

```jsx
<Button variant="primary">Deploy</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
<Button size="sm">Small</Button>
```

### Badge

```jsx
<Badge variant="completed">completed</Badge>
<Badge variant="incomplete">incomplete</Badge>
```

### Card

```jsx
<Card>
  <CardHeader>
    <p>Title</p>
  </CardHeader>
  <CardContent>
    <p>Content here</p>
  </CardContent>
</Card>
```

### Toggle

```jsx
const [on, setOn] = useState(true)
<Toggle checked={on} onChange={setOn} />
```

### ProgressBar

```jsx
<ProgressBar current={2} total={6} />
```

### TaskIcon

```jsx
<TaskIcon task="backend" /> // task = 'frontend' | 'backend' | 'database' | 'storage'
```

---

## Colors — Always Use These, Never Hardcode

```
Primary green       → text-[hsl(var(--primary))] / bg-[hsl(var(--primary))]
Light green (bg)    → bg-[hsl(var(--accent))]
Light green (text)  → text-[hsl(var(--accent-foreground))]
Border              → border-[hsl(var(--border))]
Muted background    → bg-[hsl(var(--muted))]
Muted text          → text-[hsl(var(--muted-foreground))]
```

---

## To Preview Dashboard

In `src/App.jsx`, change:

```js
const PREVIEW_DASHBOARD = false  →  const PREVIEW_DASHBOARD = true
```

---

## Rules for the Team

1. Only touch your assigned file
2. Never hardcode colors — use the CSS variables above
3. Import from `@/components/ui`, don't build your own buttons/cards
4. Open instructions are at the top of every file — read them first
5. Ask the tech lead before touching App.jsx or anything in components/
