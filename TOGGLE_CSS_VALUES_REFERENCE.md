# 🎨 Toggle CSS & Design Values Reference

**Purpose:** Quick reference for all CSS values, colors, and measurements  
**Status:** Ready to Copy/Paste  
**Last Updated:** April 1, 2026

---

## 🎯 Color Palette

### Primary Colors
```
Active (ON) State:
├─ Primary:      #22c55e (Tailwind emerald-500)
├─ Secondary:    #16a34a (Tailwind emerald-600)
├─ Shadow:       rgba(34, 197, 94, 0.3)
└─ Text:         #ffffff (White)

Inactive (OFF) State:
├─ Primary:      #e5e7eb (Tailwind gray-200)
├─ Secondary:    #d1d5db (Tailwind gray-300)
├─ Shadow:       rgba(0, 0, 0, 0.08)
└─ Text:         #6b7280 (Tailwind gray-500)

Thumb (Always):
├─ Background:   #ffffff (White)
├─ Shadow:       rgba(0, 0, 0, 0.15)
└─ Border-radius: 50%
```

### Gradient Values
```javascript
// ON State (Copy-Paste)
background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%)

// OFF State (Copy-Paste)
background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)

// Hover Modification (ON active)
filter: brightness(1.15)
```

---

## 📐 Dimensions

### Small Toggle (44×24px) - For Tables
```
Width:           44px
Height:          24px
Border-radius:   12px (half of height)
Padding:         2px (internal spacing)
Thumb size:      20px (height - 4px)
Gap:             2px (between edge and thumb)
```

### Large Toggle (52×28px) - For Forms/Modals
```
Width:           52px
Height:          28px
Border-radius:   14px
Padding:         2px
Thumb size:      24px (height - 4px)
Gap:             2px
```

### Label Spacing
```
With label:      Gap 0.5rem = 8px
Label position:  Left of toggle
Label font:      Inherit (no override)
```

---

## 🎬 Animation Specifications

### Main Transition
```css
/* Duration & Easing */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)

/* Properties Being Animated */
- transform (thumb position slide)
- background (color change)
- box-shadow (shadow effects)
```

### Cubic-Bezier Breakdown
```
cubic-bezier(0.4, 0, 0.2, 1)
├─ P1: (0.4, 0)   - Fast start
├─ P2: (0.2, 1)   - Ease out
└─ Effect: Natural, non-linear acceleration
```

### Duration Breakdown
```
0.0s:   Animation starts
0.05s:  Thumb starts moving (50ms)
0.15s:  Background color transitioning (150ms)
0.20s:  Shadow effects updating (200ms)
0.30s:  Animation complete (300ms)
```

---

## 🌈 Shadow Effects

### OFF State (Inactive)
```css
/* Inset shadow (depression effect) */
inset 0 2px 4px rgba(0, 0, 0, 0.05)

/* Outer shadow (subtle depth) */
0 2px 6px rgba(0, 0, 0, 0.08)

/* Combined */
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05), 
            0 2px 6px rgba(0, 0, 0, 0.08)
```

### ON State (Active)
```css
/* Inset shadow (slightly stronger) */
inset 0 2px 4px rgba(0, 0, 0, 0.1)

/* Outer glow (green-tinted) */
0 4px 12px rgba(34, 197, 94, 0.3)

/* Combined */
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 
            0 4px 12px rgba(34, 197, 94, 0.3)
```

### Hover State (Additional)
```css
/* Brightness increase */
filter: brightness(1.08)  /* OFF state */
filter: brightness(1.15)  /* ON state */

/* Shadow expansion */
/* Increase outer shadow blur and spread */
0 6px 16px rgba(34, 197, 94, 0.4)  /* ON hover */
```

### Active/Click State
```css
/* Press effect */
transform: scale(0.98)
filter: brightness(0.95)
```

---

## 📍 Positioning

### Thumb Position
```javascript
// OFF State (Right position)
transform: translateX(20px)  // for sm size
transform: translateX(24px)  // for lg size

// ON State (Left position)
transform: translateX(0px)   // default / initial
```

### Label Positioning
```
ON position:  Left side of toggle
OFF position: Right side of toggle

Coordinates (relative):
├─ Left edge:   4px margin
├─ Vertical:    Center aligned
└─ Font-size:   10px (small), 11px (large)
```

---

## 🎨 Complete CSS Block

### Small Toggle
```css
button.toggle-sm {
  width: 44px;
  height: 24px;
  padding: 2px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05), 
              0 2px 6px rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  outline: none;
}

button.toggle-sm:hover {
  brightness: 1.08;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05), 
              0 4px 10px rgba(0, 0, 0, 0.12);
}

button.toggle-sm:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

button.toggle-sm:active {
  transform: scale(0.98);
  filter: brightness(0.95);
}

button.toggle-sm[aria-pressed="true"] {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 
              0 4px 12px rgba(34, 197, 94, 0.3);
}

button.toggle-sm[aria-pressed="true"]:hover {
  filter: brightness(1.15);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 
              0 6px 16px rgba(34, 197, 94, 0.4);
}
```

---

## 🔤 Font & Text

### ON/OFF Labels
```css
Font-size:     10px (small), 11px (large)
Font-weight:   600 (semibold)
Text-color:    #ffffff (ON), #6b7280 (OFF)
Font-family:   Inherit (system default)
Opacity:       1.0 (always visible)
```

### Label Examples
```
Small (44×24px):
┌────────────┐
│ ON │●    │
│ OFF│      │ (not shown, only ON or OFF)

Large (52×28px):
┌──────────────┐
│ ON  │●       │
│ OFF │        │ (not shown, only ON or OFF)
```

---

## 🎯 Implementation Values Map

### Copy-Paste Sheet

#### Color Values
```javascript
const colors = {
  // ON State
  onBg1: '#22c55e',
  onBg2: '#16a34a',
  onShadow: 'rgba(34, 197, 94, 0.3)',
  onText: '#ffffff',
  
  // OFF State
  offBg1: '#e5e7eb',
  offBg2: '#d1d5db',
  offShadow: 'rgba(0, 0, 0, 0.08)',
  offText: '#6b7280',
  
  // Always
  thumbBg: '#ffffff',
  thumbShadow: 'rgba(0, 0, 0, 0.15)',
}
```

#### Size Values
```javascript
const sizes = {
  sm: {
    width: 44,
    height: 24,
    borderRadius: 12,
    thumbSize: 20,
    padding: 2,
    fontSize: 10,
    labelGap: '0.5rem',
  },
  lg: {
    width: 52,
    height: 28,
    borderRadius: 14,
    thumbSize: 24,
    padding: 2,
    fontSize: 11,
    labelGap: '0.5rem',
  },
}
```

#### Animation Values
```javascript
const animation = {
  duration: '0.3s',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  properties: ['transform', 'background', 'box-shadow'],
  hoverBrightness: 1.08,  // OFF
  hoverBrightnessActive: 1.15,  // ON
  activeBrightness: 0.95,
  activeScale: 0.98,
}
```

---

## 🌙 Dark Mode Adjustments

### Dark Mode Colors
```css
/* Assuming dark mode class: .dark */
.dark button.toggle-sm[aria-pressed="false"] {
  background: linear-gradient(135deg, #4b5563 0%, #374253 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3),
              0 2px 6px rgba(0, 0, 0, 0.5);
}

.dark button.toggle-sm[aria-pressed="true"] {
  /* Keep same green gradient, slightly adjust shadow */
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15),
              0 4px 12px rgba(34, 197, 94, 0.4);
}
```

---

## ⌨️ Keyboard & Focus

### Focus Style
```css
button.toggle-sm:focus {
  outline: 2px solid #3b82f6;  /* Blue focus */
  outline-offset: 2px;          /* Space from element */
}

/* Alternative: Ring style (Tailwind) */
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
```

### Focus Visible (Keyboard Only)
```css
button.toggle-sm:focus-visible {
  outline: 2px dashed #3b82f6;
  outline-offset: 2px;
}
```

---

## ♿ Accessibility Attributes

### ARIA Attributes
```jsx
<button
  role="switch"
  aria-pressed={isActive}  // true or false
  aria-label="Toggle featured"
  title="Click to toggle featured status"
  tabIndex={0}
/>
```

### Disabled State
```css
button.toggle-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## 📱 Mobile/Touch

### Touch Target Size
```css
/* Minimum 48×28px */
min-width: 48px;
min-height: 28px;
```

### Touch Active State
```css
button.toggle-sm:active,
button.toggle-sm:active:hover {
  filter: brightness(0.95);
  transform: scale(0.98);
}
```

### No Hover on Touch
```css
@media (hover: none) and (pointer: coarse) {
  button.toggle-sm:hover {
    /* Don't apply hover brightness on touch devices */
    filter: none;
  }
}
```

---

## 🎭 Reduced Motion Support

### Prefers Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  button.toggle-sm {
    transition: none;
  }
  
  button.toggle-sm[aria-pressed="true"] {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    /* Instant change, no animation */
  }
}
```

---

## 🔢 Numeric Reference

### CSS Values Numeric Table

| Property | Value | Unit | Size |
|----------|-------|------|------|
| Width (sm) | 44 | px | - |
| Height (sm) | 24 | px | - |
| Width (lg) | 52 | px | - |
| Height (lg) | 28 | px | - |
| Border-radius | 12/14 | px | - |
| Padding | 2 | px | - |
| Gap (horizontal) | 8 | px | - |
| Gap (vertical) | 0.5 | rem | - |
| Animation duration | 0.3 | s | - |
| Hover Z-index | - | - | - |
| Focus outline width | 2 | px | - |
| Focus offset | 2 | px | - |

---

## 🎨 Gradient Angle

### Background Gradient
```css
/* All toggles use 135-degree angle */
/* From top-left to bottom-right */
/* Creates natural light-to-shadow effect */

direction: 135deg
/* 
  ↗️ Direction
  ┌───────┐
  │ Light │ (0%)
  │   ↘️  │
  │  Dark │ (100%)
  └───────┘
*/
```

---

## 💡 Quick Copy-Paste Blocks

### CSS Rule: OFF State
```css
background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.08);
opacity: 1;
```

### CSS Rule: ON State
```css
background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(34, 197, 94, 0.3);
opacity: 1;
```

### CSS Rule: Hover (OFF)
```css
filter: brightness(1.08);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 4px 10px rgba(0, 0, 0, 0.12);
```

### CSS Rule: Hover (ON)
```css
filter: brightness(1.15);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 6px 16px rgba(34, 197, 94, 0.4);
```

### CSS Rule: Click/Active
```css
transform: scale(0.98);
filter: brightness(0.95);
```

---

## 📊 Quick Reference Table

| Element | Small | Large | Both |
|---------|-------|-------|------|
| Width | 44px | 52px | - |
| Height | 24px | 28px | - |
| Thumb Size | 20px | 24px | 50% |
| Radius | 12px | 14px | half height |
| Label Font | 10px | 11px | 600 weight |
| Animation | 0.3s cubic | 0.3s cubic | - |
| Active Color | #22c55e | #22c55e | green |
| Inactive Color | #e5e7eb | #e5e7eb | grey |
| Text ON | #fff | #fff | white |
| Text OFF | #6b7280 | #6b7280 | gray |

---

## ✅ Validation Checklist

- [x] All color values defined
- [x] All dimensions specified
- [x] Animation values clear
- [x] Shadow specifications complete
- [x] Focus styles defined
- [x] Dark mode considered
- [x] Mobile support included
- [x] Accessibility attributes listed

---

**Type:** Design Reference  
**Format:** Copy-Paste Ready  
**Version:** 1.0  
**Status:** Complete ✅
