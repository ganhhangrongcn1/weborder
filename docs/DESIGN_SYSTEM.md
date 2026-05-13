# DESIGN SYSTEM (Extracted from current UI)

Nguồn phân tích: `src/styles.css`, `tailwind.config.js`, toàn bộ JSX trong `src/**` (className + inline style).
Phạm vi: chỉ đọc và tổng hợp, không sửa code.

## 1. COLOR SYSTEM

### Primary color
- `#FF6A00` (orange primary, dùng nhiều nhất)
- Gradient primary: `linear-gradient(135deg, #FF7A00 0%, #FF4F17 100%)`

### Secondary
- `#3A1F14` (brown text/brand phụ)
- `#F5C426` (accent vàng, tab/chip admin)

### Background
- App background: `#FFFAF3`, `#F3EEE6`, `#F2EEE8` (kèm gradient)
- Admin background: `#F6F7FB`

### Card background
- Base card: `#FFFFFF`
- Soft card: `#FFF7EC`, `#FFFDF8`, `#F8F9FC`, `#FFF2E2`

### Text
- Main: `#3A1F14` (customer), `#172033` (admin)
- Secondary: `rgba(58,31,20,0.55)` ~ `rgba(58,31,20,0.60)`, `#7A8294`
- Disabled/muted: `rgba(58,31,20,0.45)`, `rgba(58,31,20,0.38)`, `#667085`

### Border color
- Primary border: `#E7E9F0`, `#DFE4EF`, `#E2E5EE`
- Orange border: `rgba(255,106,0,0.10)`, `rgba(255,106,0,0.18)`, `#FFD8D8` (danger variant)

### Badge (sale, hot)
- Sale/flash: `#FF3200`, `#FF8A00`, `#FFD24A`, `#E93B32`
- Hot/add highlight: `#FFB800`, `#FF5A1F`, `#FFCA1A`

## 2. TYPOGRAPHY

### Font family
- Main: `"Inter", system-ui, -apple-system, Arial, sans-serif`
- Tailwind sans config: `Inter, system-ui, Arial`

### Font size
- Title lớn: `24px` (home heading), `30px` (admin top heading)
- Title nhỏ: `18px` / `20px` / `16px`
- Body: `14px`
- Caption: `10px` / `11px` / `12px`

### Font weight
- Thực tế sau normalize: chủ yếu `500`
- Semantic dùng trong code: `650`, `700`, `750`, `800`, `850`, `900`, `950`

### Line height
- Phổ biến: `1.2`, `1.22`, `1.25`, `1.35`, `1.45`, `1.55`

## 3. SPACING

### Padding chuẩn
- Card: `12px`, `14px`, `16px`, `18px`
- Section/page shell: `14px 16px` (mobile shell), có variant bottom `128px`/`150px`

### Margin giữa block
- Block gap chính: `8px`, `10px`, `12px`, `14px`, `16px`, `18px`
- Section gap home shell: `16px` ~ `18px`

### Gap grid
- Product grid: `12px` (mobile nhỏ: `10px`)
- Mini cards/admin grid: `10px` ~ `16px`

## 4. BORDER RADIUS

- Card: `22px`, `24px`, `28px`
- Button: `14px`, `16px`, `20px`
- Input: `12px`
- Avatar: `999px` (full), ring thường `border-4`
- Chip/badge: `999px` (pill), category icon `58px` vòng tròn

## 5. SHADOW

- Card shadow (soft): `0 12px 34px rgba(58, 31, 20, 0.08)` (tailwind `shadow-soft`)
- Floating shadow: `0 18px 44px rgba(58, 31, 20, 0.18)`
- Button shadow (orange): `0 12px 24px rgba(255, 90, 31, 0.24)` (tailwind `shadow-orange`)
- Top/fixed bar shadow: `0 -12px 32px rgba(58, 31, 20, 0.08)` (tailwind `shadow-top`)

## 6. COMPONENT PATTERN

### Banner
- Class: `.home2026-banner-card`
- Nền gradient cam-vàng: `#FFCA1A -> #FF5A1F -> #C74216`
- Radius `28px`, min-height `184px`, shadow đậm cam
- Overlay tối bằng pseudo `::after` để tăng contrast text

### Card món (Product Card)
- Class: `.product-card`
- Nền trắng, radius `24px`, border nhẹ `rgba(58,31,20,0.04)`, `shadow-soft`
- Ảnh bo `22px`, badge nổi, giá cam `#FF6A00`, nút `+` gradient primary
- State selected: border cam + shadow cam nhạt

### Deal card
- Class: `.home2026-flash-deal` + block flash liên quan
- Card sáng, radius `18px`~`20px`, dùng màu đỏ-cam cho giá giảm/timer
- Có các biến thể (nhiều lần override) nhưng giữ motif flash: contrast cao + CTA nóng

### Category chip
- Class: `.home2026-category-bubble`
- Icon tròn `58x58`, pill border cam nhẹ, text label 2 dòng
- Active: gradient `#FFB800 -> #FF6A00`, text trắng, shadow cam

### Button
- CTA chính: `.cta`, `.cta-small`, `.product-add-btn`
- Style: gradient cam, text trắng, weight cao, radius 16-20, shadow orange
- Secondary/ghost: nền trắng hoặc cam nhạt (`#FFF3E6`, `#FF…` tint)

### Floating cart
- Class: `.floating-cart-bar`
- Fixed bottom (`bottom: 86px`), max width ~`402px`, radius `24px`
- Glassmorphism: nền trắng trong + blur + viền trắng mờ
- Icon khối gradient cam, CTA phụ dạng pill cam nhạt

## 7. EFFECT / ANIMATION

- Hover/interactive transition: chủ yếu `0.15s`~`0.2s ease`
- Product card transition: `transform`, `border-color`, `box-shadow`
- Active/click scale: `scale(0.985)` / `scale(0.995)` (button/card/cart item)
- Switch toggle: knob translateX với `transition: transform 0.2s ease`
- Backdrop blur dùng cho modal/floating bar

## 8. UI PATTERN QUAN TRỌNG

- Mobile layout width chuẩn: `main.shadow-preview { width: min(100vw, 430px); max-width: 430px; }`
- Shell mobile: `padding-left/right: 16px` (nhỏ hơn còn `14px`), đáy để chừa nav/cart
- Section spacing: gap theo hệ `10/12/14/16/18`
- List/Grid:
  - Banner/category/promo dùng horizontal scroll + snap
  - Product list chính dùng grid 2 cột (`repeat(2, minmax(0, 1fr))`)
  - Nhiều card chi tiết dùng stack + mini-grid

