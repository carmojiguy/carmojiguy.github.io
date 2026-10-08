# Free in-house studio (Spyne-style), run 15

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

Run 13 painted a black blob over the roof, the pillars, the upper doors and the hood, then sampled that blob and called it glass. Run 14 replaced that with a brightness dip under the roof. On the RAV4 front that dip became hard black rectangles over the side-window frames and the B-pillar. The Accord and the Camry failed the bright-roof test, so their glass was left as lot glass with trees and sky. Brightness rules are gone.

## What run 15 keeps from run 14

The empty plate is still the 160-sample Cycles render, denoised with Intel OIDN 2.3.3 (`--ldr --srgb -q high`), then one constant-width circle. The plates were not re-rendered.

Also unchanged: tyre rotation (a positive PIL angle lifts a low right-hand tyre), the tight contact shadow, the unflipped mirror of the lower car clipped to the disc, the 1 px choke, the wall white-balance, the light-paint lift toward about 228–232, the softbox on the paint only, the dark-car specular damp, and the small wordmark. The wordmark is Liberation Sans Bold, not licensed Arial.

## How the glass is found

`tools/spyne_composite.py` downloads `mitbersh/car-parts-segmentation` (`parts_segmentation.pt`, YOLO26-s, 33 classes) into `/tmp/gm-models` on first use and does not commit the weights. The checkpoint is AGPL. Useful classes are `windshield`, `back-windshield`, `left_front-window`, `right_front-window`, `left_back-window`, and `right_back-window`.

The cutout is composited onto flat grey 224 so the model sees a car. Inference is `conf=0.40`, `imgsz=768`, `retina_masks=True`. Polygons whose names contain window, windshield, or glass are filled. The same model's roof, hood, mirror, and fender polygons are subtracted. Pixels with alpha under 80 are dropped. A mask larger than 32% of the car is rejected. There is no colour test and no brightness test, and nothing is closed or dilated into a rectangle.

Ultralytics `carparts-seg` has no door-window class (side glass is inside the door polygon), so it was not trained. YOLOE text prompts for "car window" found almost nothing on these photos and were not used.

## How the glass is painted

The mask is feathered with a Gaussian of sigma 1.15, about 1–2 px. The fill is a vertical gradient from (14, 18, 24) at the top of the glass to (34, 40, 48) at the bottom, plus one soft streak. That tint is 84% of the mix. The other 16% is the original glass after highlights are crushed (`lum / (1 + 3.4 * max(lum - 0.22, 0))`), so a bright sky collapses and a dark seat or headrest remains.

## What the render log printed

Plates are 2000×1334. Wall sample on the finished front is 231, 232, 234. Tyre dy is left contact minus right contact.

| Frame | Rotation | Tyre dy | Glass fraction of the frame |
| --- | --- | --- | --- |
| RAV4 front | +0.9° | 1.4 px | 0.116 |
| RAV4 side | +9.2° | 0 px | 0.105 |
| RAV4 rear | −0.9° | −1.4 px | 0.108 |
| Accord grey | −11.7° | −2.1 px | 0.079 |
| Camry black | +6.9° | −1.1 px | 0.073 |

Detected glass, confidence 0.40:

- RAV4 front: right_back-window 0.93 and 0.85, windshield 0.92, right_front-window 0.90, back-windshield 0.43. Kept 15.8% of the car. 270 pixels overlapped roof, hood, mirror, or fender and were removed.
- RAV4 side: left_front-window 0.94, left_back-window 0.94 and 0.75, back-windshield 0.94. Kept 15.2%. No roof overlap.
- RAV4 rear: right_back-window 0.90 and 0.89, back-windshield 0.90, right_front-window 0.89. Kept 14.5%. One overlapping pixel removed.
- Accord: left_back-window 0.93 and 0.66, windshield 0.92, left_front-window 0.91. Kept 14.8%. 591 overlapping pixels removed.
- Camry: right_front-window 0.93, right_back-window 0.91 and 0.88, windshield 0.88. Kept 14.7%. 252 overlapping pixels removed.

Each window polygon was measured on the cutout. Bounding-box fill is 0.49–0.90. The top edge of every window moves (31–135 px of vertical travel), so the opening is a curved or slanted header, not a horizontal bar. Opaque gaps inside the glass band, which are the pillars, measure 16–125 px. The side view's B-pillar gap is 125 px.

Inside the kept mask, after the blend, the fraction of pixels that are still green (trees) is 0.000 on all five. The fraction that is still bright blue is 0.000–0.007. Before the blend, the Accord and Camry side glass and the RAV4's sky-facing windows were 76–97% sky. Column-to-column residual contrast inside the tint is about 11 luminance units, roughly 30–47% of the original interior variation, which is the seat and headrest silhouette under the 16% mix.

A luminance grid of each finished frame (white body or wall as W, dark glass as #) shows white rows above the glass and white columns between the windows on the three white cars. On the Camry the body is the mid-dark paint and the glass is darker than that paint, with the same gaps.

## What I see in the crops

I opened the five 100% glass crops, the five finished frames, the mask overlays, and a tight band through each cabin.

- **RAV4 front.** The windshield and both side windows are a smoky blue-grey with one soft highlight and a visible headrest. The tops curve. The B-pillar and the mirror stay white. The roof rows above the glass are white, about 230. The far quarter is a partial detection (back-windshield at 0.43) and the mask on that opening follows the curve that is visible. No hard box. No trees or sky in the glass. The tint meets the frame and stops; it does not cover the pillar or the roof.
- **RAV4 side.** Front door, rear door, quarter, and rear glass are four separate tints. The B-pillar between the doors is white paint, 125 px of mask gap on the cutout and a white column on the finished frame. The quarter glass shows a headrest, not foliage. The roof above the glass is white. This source is the 2022 RAV4 Prime, a different car from the front and rear frames.
- **RAV4 rear.** Rear glass and both quarters are separate, with white body between them. The rear glass is darker at the top and shows a headrest. The roof and the tailgate are white. The tail lamps stay the outdoor lamps. No trees. The mask stops at the frame.
- **Accord grey.** Windshield, both side windows, and the small quarter are tinted. The lot sky that filled those windows is gone. A headrest remains in the front side window. The pillars and the roof are grey paint. The quarter's top is a shallow curve (quadratic residual about 1 px, fill 0.56), not a filled rectangle. 591 pixels where a glass polygon crossed the roof or the hood were removed.
- **Camry black.** Windshield and both side windows are tinted, with seat silhouettes. The sky that was 90–97% of those windows is gone. The pillars read as black paint, separated from the glass by 16–38 px gaps. The glass mask does not cover the roof. A soft outdoor shine is still on the roof and the hood paint; that shine is low frequency, so the dark-car damp does not remove it.

## Against the MyLoan frame

The attached reference is a white Trailblazer on myloan.ca, phone screenshot, with every window a dark tint, a soft highlight, and the body colour left on the pillars. That file was not on disk when this sheet was built. The left half of the sheet is a different photo from the same site: a white Mazda CX-5 on the myloan.ca turntable (`images.app.ridemotive.com/xd9t5mbu0fvu99ppkroohbck96t1`), labeled "MyLoan studio photo". It is the same kind of treatment. It is not the Trailblazer, and it is not the RAM that run 14's sheet called the reference.

Run 15 gets every detected window on all five cars into the smoky tint, including the side glass, and leaves the pillars and the roof in body colour. The panel highlights are still the shape of the outdoor photo. The reflection is still only the wheels and the rocker in the strip of floor under the car.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Browser cutout is still `@imgly/background-removal@1.6.0`. Ghost guides were not edited. Do not merge.
