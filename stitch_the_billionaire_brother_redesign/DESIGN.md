# Design System Strategy: The Architectural Authority

## 1. Overview & Creative North Star
**Creative North Star: "The Architectural Authority"**

This design system is built to evoke the sensation of a private high-end family office or a bespoke trading floor. It rejects the "bubbly" trends of modern SaaS in favor of **Architectural Authority**—a style defined by structural precision, intentional negative space, and a high-contrast monochromatic base punctuated by "Wealth Signals" (gold/amber accents).

To break the "template" look, we utilize **Asymmetric Precision**. Layouts should feel like a premium editorial spread: large, aggressive typography offsets smaller, technical data points. We avoid the rigid 12-column grid in favor of layered compositions where elements overlap slightly, creating a sense of depth and curated complexity.

---

## 2. Colors & Surface Logic

The palette is rooted in deep obsidian and charcoal tones, providing a canvas where information feels permanent and authoritative.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. 
Structure is defined through **Background Color Shifts**. To separate a sidebar from a main content area, do not draw a line; instead, transition from `surface` (#131313) to `surface_container_low` (#1c1b1b). This creates a sophisticated, "carved" look rather than a "pasted" look.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials.
*   **Base:** `surface` (#131313) - The primary canvas.
*   **Recessed:** `surface_container_lowest` (#0e0e0e) - Use for background utility areas or deep "wells" of information.
*   **Elevated:** `surface_container_high` (#2a2a2a) - Use for primary interactive containers.

### The "Glass & Gradient" Rule
To ensure the interface feels "High-Tech Finance" rather than just "Dark Mode," use Glassmorphism for floating elements (modals, dropdowns). 
*   **Token:** Use `surface_container` with a `backdrop-blur` of 20px and 60% opacity.
*   **Signature Textures:** For primary CTAs, use a subtle linear gradient (45-degree) from `primary` (#ffe2ab) to `primary_container` (#ffbf00). This avoids flat, "cheap" buttons and adds a metallic, lustrous quality.

---

## 3. Typography: The Voice of Precision

Our typography pairs the geometric stability of **Inter** with the technical rigor of **JetBrains Mono** and **Space Grotesk**.

*   **Display & Headlines (Inter):** Used for bold, authoritative statements. Use tight letter-spacing (-0.02em) for `display-lg` to create a "dense" and powerful visual weight.
*   **Body (Inter):** High readability, tracking set to "Normal." We prioritize generous line heights (1.6) to ensure the text feels premium and unhurried.
*   **Technical Labels (Space Grotesk / JetBrains Mono):** Used for data, labels, and small captions. This introduces the "Modern Tech" aspect—it looks like code or a financial terminal, conveying precision and no-nonsense accuracy.

---

## 4. Elevation & Depth

We convey importance through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Stack surfaces from darkest (bottom) to lightest (top). A `surface_container_high` card sitting on a `surface` background provides all the "lift" required. 
*   **Ambient Shadows:** If a floating state is required (e.g., a high-priority modal), use a wide, soft shadow.
    *   *Value:* `0px 24px 48px rgba(0, 0, 0, 0.5)`. 
    *   Shadows should never be grey; they must be a darker tint of the background color.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism & Depth:** Layered elements should use `surface_variant` with 70% opacity and a heavy blur. This makes the UI feel like an integrated piece of hardware rather than a series of flat web boxes.

---

## 5. Components

### Buttons
*   **Primary:** High-contrast `primary_container` (#ffbf00) with `on_primary` (#402d00) text. Sharp corners (`rounding: none` or `sm`). No borders.
*   **Secondary:** `surface_container_highest` background with `primary` text. This is "stealth" luxury.
*   **States:** On hover, primary buttons should shift to `primary_fixed_dim`. No "bounce" or playful animations; use a swift 150ms linear fade.

### Input Fields
*   **Styling:** Forbid the "box" look. Use a `surface_container_low` background with a bottom-only "Ghost Border" using `outline`.
*   **Labels:** Use `label-md` (Space Grotesk) in all caps for a formal, technical feel.

### Cards & Lists
*   **The Divider Ban:** Never use horizontal rules. Use vertical white space (32px or 48px) to separate list items. 
*   **Card Styling:** Use `surface_container_low`. For interactivity, increase to `surface_container_high` on hover. The transition should be subtle enough that the user "senses" the lift.

### Signature Component: The "Data Terminal" Chip
*   For status indicators or categories, use `JetBrains Mono` text inside a `surface_container_highest` chip with a 1px `primary` accent on the far left. This mimics high-end trading software.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Asymmetry:** Place a large `display-md` headline on the left and a small `body-sm` technical description on the right.
*   **Use High Contrast:** Ensure `white` text on `surface_container_lowest` is crisp. Authority comes from clarity.
*   **Respect the "No-Line" Rule:** If you feel the need to add a border, try changing the background color of the container instead.

### Don’t:
*   **Don't Use "Soft" Rounding:** Avoid `xl` or `full` rounding unless it's a specific action icon. We prefer `none` (0px) or `sm` (2px).
*   **Don't Use Playful Motion:** No "pop-ups" or "elastic" transitions. Use "fade" or "slide" with ease-in-out timing.
*   **Don't Add Clutter:** If a piece of information isn't critical, remove it. A billionaire's time is the most expensive asset; don't waste it with visual noise.
*   **Don't Use Pure Grey:** Use the provided tokens. Our "blacks" are warm and deep (`#0A0A0A`), never flat #333333.