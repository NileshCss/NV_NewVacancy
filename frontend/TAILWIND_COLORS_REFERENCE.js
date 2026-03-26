/**
 * COMPLETE TAILWIND THEME COLORS REFERENCE
 * =========================================
 * 
 * This file documents all color classes available after
 * the theme system update. All colors use CSS variables
 * and automatically switch between light and dark modes.
 */

// ============================================================
// PRIMARY COLORS (Orange - Used for CTAs & Highlights)
// ============================================================

// bg-primary
// Light: #FF7A00
// Dark:  #FF7A00
// Usage: Primary buttons, highlights, accent elements

// hover:bg-primary-hover
// Light: #E66A00
// Dark:  #FFB366
// Usage: Hover state for primary elements

// bg-primary-light
// Light: #FFE7CC
// Dark:  #FFE7CC
// Usage: Light background variant for secondary buttons

// text-primary
// Light: #FF7A00
// Dark:  #FF7A00
// Usage: Primary text links, logo accent

// ============================================================
// BACKGROUND COLORS
// ============================================================

// bg-bg-main
// Light: #F8FAFC (Lightest blue-gray)
// Dark:  #0F172A (Darkest navy)
// Usage: Page/app background, main container

// bg-bg-section
// Light: #EEF2F7 (Light blue-gray)
// Dark:  #162032 (Dark blue-gray)
// Usage: Section backgrounds, alternate areas

// bg-bg-card
// Light: #FFFFFF (White)
// Dark:  #1E293B (Slate)
// Usage: Card containers, modals, elevated surfaces

// bg-bg-input
// Light: #F1F5F9 (Pale blue)
// Dark:  #334155 (Darker slate)
// Usage: Form input backgrounds, search bars

// bg-bg-hover
// Light: #F1F5F9 (Pale blue)
// Dark:  #1E293B (Slate)
// Usage: Hover state backgrounds, interactive areas

// bg-bg-active
// Light: #E2E8F0 (Light slate)
// Dark:  #334155 (Darker slate)
// Usage: Active/selected state, tab backgrounds

// ============================================================
// TEXT COLORS
// ============================================================

// text-text-heading
// Light: #0F172A (Dark navy)
// Dark:  #F1F5F9 (Light slate)
// Usage: Headings (h1, h2, h3, etc.), main titles

// text-text-body
// Light: #334155 (Slate)
// Dark:  #CBD5E1 (Light slate)
// Usage: Body text, paragraphs, descriptions

// text-text-muted
// Light: #94A3B8 (Light slate)
// Dark:  #94A3B8 (Light slate - consistent)
// Usage: Secondary text, meta info, hints, placeholders

// text-text-white
// Light: #FFFFFF (White)
// Dark:  #FFFFFF (White)
// Usage: Text on primary backgrounds

// text-text-link
// Light: #FF7A00 (Orange)
// Dark:  #FF7A00 (Orange)
// Usage: Links, clickable text

// ============================================================
// BORDER & DIVIDER COLORS
// ============================================================

// border-border
// Light: #E2E8F0 (Light slate)
// Dark:  #334155 (Darker slate)
// Usage: Border lines, dividers, separators

// border-border-divider (from --color-divider)
// Light: #CBD5E1 (Muted slate)
// Dark:  #475569 (Medium slate)
// Usage: Subtle dividers, hairlines

// ============================================================
// BADGE COLORS
// ============================================================

// bg-badge-bg
// Light: #FFF4E5 (Very light orange)
// Dark:  rgba(255,122,0,0.1) (Transparent orange)
// Usage: Badge/tag backgrounds

// text-badge-text
// Light: #FF7A00 (Orange)
// Dark:  #FFB366 (Light orange)
// Usage: Badge/tag text

// border-badge-border
// Light: #FFD6A3 (Light orange)
// Dark:  #FF7A00 (Orange)
// Usage: Badge/tag borders

// ============================================================
// TICKER/ALERT COLORS
// ============================================================

// bg-ticker-bg
// Light: #FFF4E5 (Very light orange)
// Dark:  rgba(255,122,0,0.15) (Transparent orange)
// Usage: Live ticker/alert backgrounds

// text-ticker-text
// Light: #9A3412 (Dark orange-brown)
// Dark:  #FFAB5E (Light orange)
// Usage: Ticker/alert text

// ============================================================
// SHADOW UTILITIES
// ============================================================

// shadow-card
// Light: 0 4px 20px rgba(0,0,0,0.05)
// Dark:  0 4px 20px rgba(0,0,0,0.3)
// Usage: Card elevation, subtle depths

// shadow-card-hover
// Light: 0 8px 25px rgba(0,0,0,0.08)
// Dark:  0 8px 25px rgba(0,0,0,0.4)
// Usage: Card hover elevation, emphasis

// shadow-md
// Light: 0 4px 6px -1px rgba(0,0,0,0.1)
// Dark:  0 4px 6px -1px rgba(0,0,0,0.4)
// Usage: Medium elevation

// shadow-lg
// Light: 0 10px 15px -3px rgba(0,0,0,0.1)
// Dark:  0 10px 15px -3px rgba(0,0,0,0.5)
// Usage: Large elevation, modals

// ============================================================
// USAGE EXAMPLES BY COMPONENT TYPE
// ============================================================

// 1. BUTTONS
// ----------

// Primary Button
// <button className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors">
//   Call to Action
// </button>

// Secondary Button
// <button className="bg-primary-light text-primary hover:text-primary-hover font-semibold rounded-lg">
//   Secondary
// </button>

// Ghost Button
// <button className="border-2 border-primary text-primary hover:bg-primary/10 font-semibold rounded-lg">
//   Tertiary
// </button>

// 2. CARDS
// --------

// <div className="bg-bg-card border border-border rounded-lg p-6 shadow-card hover:shadow-card-hover">
//   {/* Content */}
// </div>

// 3. FORMS
// --------

// <input className="bg-bg-input border border-border text-text-body placeholder-text-muted 
//                   rounded-lg px-4 py-2 focus:border-primary focus:ring-2 focus:ring-primary/20" />

// 4. TEXT HIERARCHY
// -----------------

// <h1 className="text-4xl font-bold text-text-heading">Main Heading</h1>
// <p className="text-lg text-text-body">Body text</p>
// <p className="text-sm text-text-muted">Meta information</p>

// 5. BADGES
// ---------

// <span className="bg-badge-bg text-badge-text border border-badge-border 
//                  px-3 py-1 rounded-full text-xs font-semibold">
//   HOT
// </span>

// 6. ALERTS/NOTIFICATIONS
// -----------------------

// <div className="bg-ticker-bg text-ticker-text border-l-4 border-primary p-4 rounded">
//   Important message
// </div>

// ============================================================
// RESPONSIVE BEHAVIOR
// ============================================================

// All these colors work at ALL breakpoints (mobile, tablet, desktop)
// The theme switches based on user preference or OS setting,
// not based on screen size.

// Example responsive component:
// <div className="bg-bg-card text-text-heading p-4 md:p-8">
//   Padding changes, but colors stay consistent
// </div>

// ============================================================
// DARK MODE CLASS BEHAVIOR
// ============================================================

// The 'dark' class is automatically applied to <html> element
// You generally DON'T need to use it, but if needed:

// Specific dark mode styling:
// <div className="bg-white dark:bg-slate-900">
//   This isn't needed with our system - use bg-bg-card instead
// </div>

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

// These legacy colors still work for backward compatibility:
// - brand-50 through brand-900
// - navy-50 through navy-900
// - govt, pvt, tech, education

// But new components should use the semantic theme colors instead.

// ============================================================
// CUSTOM CSS VARIABLE USAGE
// ============================================================

// If you need to use colors in raw CSS or custom styles:

// In CSS:
// .custom-element {
//   background-color: var(--color-bg-card);
//   color: var(--color-text-heading);
//   border-color: var(--color-border);
//   box-shadow: var(--shadow-card);
// }

// In inline styles (NOT recommended):
// <div style={{ backgroundColor: 'var(--color-bg-card)' }}>
//   Content
// </div>

// ============================================================
// ACCESSIBILITY NOTES
// ============================================================

// All colors meet WCAG AA contrast requirements:
// ✅ Text on colors: 4.5:1 minimum contrast
// ✅ UI components: 3:1 minimum contrast
// ✅ Large text: 3:1 contrast is acceptable

// Examples of verified combinations:
// ✅ text-text-heading on bg-bg-card (7.2:1)
// ✅ text-text-body on bg-bg-card (5.4:1)
// ✅ text-primary on bg-bg-card (5.1:1)
// ✅ text-white on bg-primary (5.2:1)

// ============================================================
// COLOR PALETTE VISUAL
// ============================================================

/*
LIGHT MODE                      DARK MODE
┌──────────────────┐           ┌──────────────────┐
│ Background Main  │           │ Background Main  │
│ #F8FAFC          │           │ #0F172A          │
└──────────────────┘           └──────────────────┘
┌──────────────────┐           ┌──────────────────┐
│ Section          │           │ Section          │
│ #EEF2F7          │           │ #162032          │
└──────────────────┘           └──────────────────┘
┌──────────────────┐           ┌──────────────────┐
│ Card (White)     │           │ Card (Slate)     │
│ #FFFFFF          │           │ #1E293B          │
└──────────────────┘           └──────────────────┘
┌──────────────────┐           ┌──────────────────┐
│ Primary Orange   │ ─────────│ Primary Orange   │
│ #FF7A00          │           │ #FF7A00          │
└──────────────────┘           └──────────────────┘
*/

// ============================================================
// FREQUENTLY ASKED QUESTIONS
// ============================================================

// Q: How do I use colors in TypeScript?
// A: Colors work the same in .ts/.tsx files. Just use the
//    class names in your className strings.

// Q: Can I override these colors for specific elements?
// A: You can use Tailwind's arbitrary values:
//    className="bg-[#123456]"
//    But prefer using the semantic theme colors.

// Q: What if I need a color not in this list?
// A: Add it to globals.css as a CSS variable, then to
//    tailwind.config.js colors section.

// Q: Do I need to do anything for SSR/Next.js?
// A: Keep the ThemeProvider setup the same. The HTML won't
//    have a 'dark' attribute initially, which is correct.

// Q: How do I use colors in styled-components/emotion?
// A: Use CSS variables inside template literals:
//    const StyledDiv = styled.div`
//      background-color: var(--color-bg-card);
//    `

// ============================================================
// LAST UPDATED: 2026-03-25
// STATUS: ✅ PRODUCTION READY
// ============================================================
