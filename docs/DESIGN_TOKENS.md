# English con Fútbol — Design Tokens

*ESL PWA · design system · 2026-09-02*
*Source of truth for colour, type, spacing and component behaviour. No surface declares a raw hex value.*

The palette is inherited from the football prototype (`esl_soccer_arcade.html`) and is already committed
in the repo as `theme-color` in `index.html`. Nothing here is newly invented — this document pins it
down, checks it, and gives the custom properties to paste. **Every contrast figure below is computed,
not asserted.**

---

## 1. Palette

| Token | Hex | RGB | Role |
|---|---|---|---|
| `--pitch` | `#1B4332` | 27, 67, 50 | The ground. Every screen sits on it. Already the app's `theme-color`. |
| `--grass` | `#2D6A4F` | 45, 106, 79 | Raised surface one step off the ground — sound and syllable cards. |
| `--chalk` | `#F1FAEE` | 241, 250, 238 | All body text, and the fill of anything a child taps to reach content. |
| `--navy` | `#14213D` | 20, 33, 61 | Letterforms on chalk, tile borders, the back control. |
| `--yellow` | `#FFD60A` | 255, 214, 10 | The single accent. Marks what is live and what plays sound. |
| `--yellow-shadow` | `#B39100` | 179, 145, 0 | Hard shadow under yellow only. Never a surface, never text. |
| `--navy-shadow` | `#060C1A` | 6, 12, 26 | Hard shadow under navy only. Never a surface, never text. |

### Derived — alpha over `--pitch`

| Token | Value | Effective on pitch | Role |
|---|---|---|---|
| `--line` | `rgba(241,250,238,.42)` | `#7B9486` | Dashed borders, group dividers |
| `--dim` | `rgba(241,250,238,.50)` | `#8FA69A` | Locked letter glyphs, secondary labels |
| `--shadow` | `rgba(0,0,0,.40)` | — | The press affordance under every tappable object |

---

## 2. Contrast — measured

WCAG 2.1 ratios for every pairing the interface actually uses. Normal text needs **4.5:1**, text at 24px+
bold needs **3:1**, non-text UI boundaries need **3:1**.

| Pairing | Where it appears | Ratio | Verdict |
|---|---|---|---|
| chalk on pitch | All body text on the ground | **10.37:1** | ✅ passes AA |
| navy on chalk | The letter on a live tile | **14.95:1** | ✅ passes AA |
| yellow on pitch | Eyebrows, group labels | **7.85:1** | ✅ passes AA |
| navy on yellow | *Entrar a la lección* · *Escucha* | **11.31:1** | ✅ passes AA |
| chalk on grass | Word labels inside a card | **5.98:1** | ✅ passes AA |
| dim on pitch | Locked letter glyph (24–32px bold) | **3.85:1** | ⚠️ large text only |
| line @ 34% on pitch | Dashed borders, dividers *(was)* | **2.60:1** | ❌ below the 3:1 floor |
| line @ 42% on pitch | Dashed borders, dividers *(fixed)* | **3.20:1** | ✅ passes |

### One real defect, fixed here

The dashed outlines on locked tiles and the group dividers were set at 34% chalk — **2.60:1**, under the
3:1 floor for non-text UI boundaries. On a bright classroom screen those edges wash out and locked letters
stop reading as tiles at all. **40% is the minimum that clears 3:1; the token is set to 42% for headroom.**

The locked glyph at 3.85:1 is acceptable, but *only* because it is never smaller than 24px bold. **If a
locked letter ever renders at small size, it fails.**

### Never use

**navy on grass — 2.50:1.** The one unreadable pairing in the palette. It looks plausible in a mockup and
disappears on a real screen. Text on a grass surface is always chalk.

---

## 3. Typography

Two families, strict roles.

**Baloo 2** is the voice — rounded, high x-height, reads as friendly at letter size. It carries
letterforms, screen titles and group names, nothing else.

**Nunito** carries every word a child or teacher reads as language.

| Token | Size | Family / weight | Use |
|---|---|---|---|
| `--t-hero` | `clamp(88px, 27vw, 126px)` | Baloo 2 800 | The letter on the letter screen |
| `--t-tile` | `clamp(24px, 7vw, 32px)` | Baloo 2 800 | Letter tiles in the grid |
| `--t-h1` | `27px` | Baloo 2 800 | Screen title — *El alfabeto* |
| `--t-h2` | `21px` | Baloo 2 800 | Lesson tile titles |
| `--t-group` | `19px` | Baloo 2 800 | Group name — *Grupo 1* |
| `--t-body` | `15px` | Nunito 800 | Body text and controls |
| `--t-small` | `13px` | Nunito 800 | Secondary text, buttons |
| `--t-label` | `11.5px` | Nunito 800, `.13em`, uppercase | Section labels — *Sus sonidos* |

### The fonts must be self-hosted before this ships

Both faces currently load from Google Fonts. That is fine for a reference sheet and **wrong for the app.**
Offline capability is non-negotiable on this project — a classroom with no connectivity gets a silent
fallback face, and Baloo 2 falling back to a system sans changes the letterforms a child is learning to
recognise.

Self-host the weights actually used — **Baloo 2 800, Nunito 700/800** — and subset to Latin.

---

## 4. Spacing and radii

Spacing: `4 · 8 · 11 · 14 · 18 · 22 · 26`

| Token | Value | Token | Value |
|---|---|---|---|
| `--s-1` | 4px | `--r-sm` | 10px |
| `--s-2` | 8px | `--r-md` | 14px |
| `--s-3` | 11px | `--r-lg` | 18px |
| `--s-4` | 14px | `--r-xl` | 22px |
| `--s-5` | 18px | `--r-2xl` | 26px |
| `--s-6` | 22px | `--r-pill` | 999px |
| `--s-7` | 26px | | |

Radii scale with the object: chips 10px, controls 14px, tiles 18px, cards 22px, the hero 26px, pills fully
round. **Bigger object, rounder corner** — so size reads as softness rather than as weight.

---

## 5. Components

### Letter tile

| State | Fill | Border | Shadow | Accent |
|---|---|---|---|---|
| **live** | `--chalk` | 4px solid `--navy` | `0 5px 0 --shadow` | 22×5px `--yellow` bar, 9px from bottom |
| **locked** | none | 3px **dashed** `--line` | none | none |

The difference is structural, not decorative. **Fill and shadow mean "this does something."** Locked is
drawn, never hidden and never scolded — no padlock, no grey-out that reads as broken.

### The press affordance

Every tappable thing sits on a hard offset shadow with **no blur**. On `:active` it moves down by the
shadow's height while the shadow shrinks:

```css
--lift:         0 5px 0 var(--shadow);
--lift-pressed: 0 1px 0 var(--shadow);
```

Arcade-cabinet physics — the control visibly depresses. For a six-year-old on a shared phone this is the
whole feedback channel, and it is the one thing that must survive any restyle.

### Touch targets

Floor is **44×44px**. Measured on the built screen:

| Element | Size | Note |
|---|---|---|
| Letter tile @ 320px | **63px** | Smallest supported phone |
| Letter tile @ 390px | 80px | |
| Letter tile @ 430px | 90px | |
| Sound speaker button | 60px | |
| Letter hero card | ≥200px | |
| Gap between tiles | 11px | Separation, not just size |

---

## 6. Paste this

```css
/* English con Fútbol — design tokens
   No surface declares a raw hex value. */
:root{
  /* palette */
  --pitch:#1B4332;          /* ground */
  --grass:#2D6A4F;          /* raised surface */
  --chalk:#F1FAEE;          /* text + live fills */
  --navy:#14213D;           /* letterforms, borders */
  --yellow:#FFD60A;         /* the only accent */
  --yellow-shadow:#B39100;
  --navy-shadow:#060C1A;

  /* derived — alpha over --pitch */
  --line:rgba(241,250,238,.42);   /* 3.20:1 — do not drop below .40 */
  --dim:rgba(241,250,238,.50);    /* 3.85:1 — large text only */
  --shadow:rgba(0,0,0,.40);

  /* type */
  --font-display:'Baloo 2', cursive, sans-serif;
  --font-body:'Nunito', system-ui, sans-serif;
  --t-hero:clamp(88px,27vw,126px);
  --t-tile:clamp(24px,7vw,32px);
  --t-h1:27px; --t-h2:21px; --t-group:19px;
  --t-body:15px; --t-small:13px; --t-label:11.5px;

  /* space + radius */
  --s-1:4px;  --s-2:8px;  --s-3:11px; --s-4:14px;
  --s-5:18px; --s-6:22px; --s-7:26px;
  --r-sm:10px; --r-md:14px; --r-lg:18px;
  --r-xl:22px; --r-2xl:26px; --r-pill:999px;

  /* the press affordance */
  --lift:0 5px 0 var(--shadow);
  --lift-pressed:0 1px 0 var(--shadow);
  --touch-min:44px;
}
```

---

## 7. Rules that are not style preferences

**Yellow marks exactly two things:** what is available now, and what makes sound. The moment it decorates
a third thing it stops meaning anything, and the child loses the only signal telling them where to tap.

**Locked is drawn, not hidden.** Dashed chalk outline, no padlock, no error state. Unavailable letters are
the shape of the course, not a failure.

**Nothing in this palette encodes progress belonging to a person.** Devices are shared. A colour that
means "you did this" is a colour the next child inherits.

**No English in chrome.** Colour and type carry meaning so that navigation needs as few words as possible —
which is what lets the UI stay entirely in Spanish while the content is entirely in English.

---

*Filed: 2026-09-02 | Chat: Gen 2 | ESL-PWA: Slice 1 Alphabet | Parent: Gen 1 | ESL-PWA: PWA Master v2*
