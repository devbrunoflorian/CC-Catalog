# 🎨 CC Catalog - Visual Style Handbook

This guide serves as the ultimate reference for visual adjustments, styling patterns, and theme consistency within the CC Catalog project. Whether you are a human collaborator or an AI agent, follow these guidelines to maintain the "Premium Glassmorphic" aesthetic.

---

## 📌 Table of Contents
1. [Core Design Philosophy](#core-design-philosophy)
2. [Primary Style Entry Point (`index.css`)](#primary-style-entry-point-indexcss)
3. [The Design Tokens (Theme Variables)](#the-design-tokens-theme-variables)
4. [Utility Classes & Patterns](#utility-classes--patterns)
    - [The Mica Effect](#the-mica-effect)
    - [The Glow & Lift Patterns](#the-glow--lift-patterns)
5. [Component-Specific Styling](#component-specific-styling)
6. [Themes & Dynamic Colors](#themes--dynamic-colors)
7. [Best Practices for Adjustments](#best-practices-for-adjustments)

---

## 🗺️ Core Design Philosophy
CC Catalog follows a **Windows 11 Mica/Acrylic** inspired aesthetic:
- **Translucency over Opacity**: Use `backdrop-blur` and low-opacity backgrounds instead of solid colors.
- **Layering**: Depth is achieved through subtle borders and gradients, not heavy shadows.
- **Brand Accents**: Use the Purple/Violet brand color subtly for interaction feedback (Glows).
- **Dark Mode**: The base should be a soft charcoal, never pure black (`#000`).

---

## 🛠️ Primary Style Entry Point
All global adjustments start here:
`src/renderer/index.css`

This file uses **Tailwind CSS v4** and contains the `@theme` block where all core tokens are defined.

---

## 💎 The Design Tokens (Theme Variables)
To change the "feel" of the app, modify these variables in the `@theme` block:

| Variable | Usage | Adjustment Logic |
| :--- | :--- | :--- |
| `--color-bg-dark` | App background | Keep around `HSL 240, 10%, 6-12%`. |
| `--color-bg-card` | Sidebar/Panel base | Slightly lighter than `bg-dark`. |
| `--color-brand-primary` | Main Purple | Interactive elements (active states). |
| `--color-brand-glow` | Hover Aura | Found in `hsla(...)`. Adjust the last digit (0.15-0.25) for intensity. |
| `--shadow-lift` | Floating Cards | A combination of a depth shadow and a brand halo. |

---

## ✨ Utility Classes & Patterns

### 🧊 The Mica Effect
Used for main columns and background panels.
```css
.glass-mica {
  @apply bg-white/[0.02] backdrop-blur-[12px] border border-white/5;
}
```
*   **To make it more "glassy":** Increase `backdrop-blur`.
*   **To make it darker:** Increase the first `white/[0.02]` value slightly.

### 🌟 The Glow & Lift Patterns
These are the most common adjustment requests.

#### `.hover-lift`
Used for cards that should feel "clickable" and premium.
- **Logic:** It floats the element up (`-translate-y-1`) and adds a brand-colored halo.
- **Where to adjust:** Change `hover:border-brand-primary/40` in `index.css` to change the edge brightness.

#### `.hover-glow`
Used for buttons and small interactive items.
- **Logic:** Adds a soft outer glow without moving the element.
- **Where to adjust:** Modify `hover:shadow-[0_0_18px_var(--color-brand-glow)]`.

---

## 🍱 Component-Specific Styling

### Dashboard & History Cards
Located in `App.tsx` and `HistoryView.tsx`.
- They use the `.glass-card` utility.
- To change the inner gradient of cards, edit `.glass-card::before` in `index.css`.

### Sidebar
Located in `App.tsx`.
- Uses `bg-bg-card/50` with a `backdrop-blur-sm`.
- **Note:** The sidebar should NOT have glow effects unless explicitly requested, to keep it as a "static anchor".

---

## 🌈 Themes & Dynamic Colors
Dynamic theme switching (Obsidian, Rose Quartz, Sapphire) is handled in:
`src/renderer/context/ThemeContext.tsx`
`src/renderer/App.tsx` -> `getBackgroundStyle()`

If you add a new theme color:
1. Add the enum to `ThemeContext.tsx`.
2. Add the hex values to `SettingsModal.tsx`.
3. Update `App.tsx`'s `getBackgroundStyle` to inject the correct HSL values into CSS variables.

---

## 📝 Best Practices for Adjustments
1. **Don't use pure black:** Use `rgba(255, 255, 255, 0.04)` over dark backgrounds to create light layers.
2. **Arbitrary Values:** In Tailwind, avoid spaces in arbitrary values inside `@apply` (e.g., use `shadow-[0_0_10px_red]` NOT `shadow-[0 0 10px red]`).
3. **Subtlety is Key:** When increasing glows, increment by `0.05` steps. Visual fatigue happens quickly with over-saturated glows.
4. **Consistency:** Always check how a change in `index.css` affects both the Dashboard and the History view before committing.

---
*Last Updated: February 2026*
