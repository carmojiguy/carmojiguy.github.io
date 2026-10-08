# Free in-house studio (Spyne-style), run 14

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

Run 13 is rejected. On all five frames the glass fill painted a black region over the roof, the pillars, the upper doors and the hood. The RAV4 rear and side were about half black. The Accord and the Camry were covered. The run 13 note said the glass was fine because it sampled that painted region (a dark band, low high-frequency energy) and treated it as a window. That measurement was the blob.

## What run 14 keeps from run 13

`tools/blender_spyne_plate.py` still renders the empty set at 160 samples. Ubuntu's Blender 4.0.2 has no OpenImageDenoise, so `tools/spyne_composite.py` denoises the plate with Intel's standalone OIDN 2.3.3 (`--ldr --srgb -q high`) and then draws the circle. The plates were not re-rendered.

Also unchanged: the tyre rotation (positive PIL angle lifts a low right-hand tyre), the tight contact shadow, the unflipped mirror of the lower car clipped to the disc, the 1 px choke, the wall white-balance, and the small wordmark. The wordmark is Liberation Sans Bold, not licensed Arial.

## What changed

The glass mask is no longer "anything in the upper half that is not the door colour." A column is a window only when a bright roof drops into a dark opening and the body colour comes back at the beltline. The mask has to stay under about 25% of the car, it cannot touch the top of the roof, and a long run of missed dark glass throws the whole mask away. The Accord failed that last test (a 196-column hole). The Camry roof median is 138, which is not a bright roof, so its mask is empty. Original glass is left in both cases.

On a light car the door paint is lifted so the bright panels sit near 228–232, then a soft band is added on the paint only. Neutral pixels past 236 are pulled back to 232 after the resize, because Lanczos ringing was clipping the white. On the black Camry, small outdoor speculars are replaced with a blurred copy of the panel. The broad sky reflection on that roof is low frequency, so it stays.

## IC-Light

Tried in run 13. Not used in these frames. `lllyasviel/IC-Light` returned a dark 1152×640 foreground-only result. `GreenGoat/IClight-demo` returned about 768×448 and invented its own grey background. The CPU grade is what the five frames use.

## What I actually see

Plates are 2000×1334. The wall on the finished front is 231, 232, 234. A flat patch of floor away from the car is a smooth light grey (one 24×24 patch measured standard deviation 0). Tyre dy is left contact minus right contact, after placement.

| Frame | Rotation | Tyre dy |
| --- | --- | --- |
| RAV4 front | +0.9° | 1.4 px |
| RAV4 side | +9.2° | 0 px |
| RAV4 rear | −0.9° | 1.4 px |
| Accord grey | −11.7° | 2.1 px |
| Camry black | +6.9° | 1.1 px |

I opened each finished frame, plus 100% crops of the glass and the tyre contact.

- **RAV4 front.** The windshield is a dark blue-grey gradient with one soft light band. A center sample through it reads about 41–63, and the roof pixel just above that sample is 230. The hood under it is white, with the bright-panel 90th percentile near 229 and the frame maximum 250 (one pixel). The roof, pillars, mirrors and hood are not black. The side window beside the windshield still shows trees and sky. Those columns do not have a clean roof over the opening, and the dark pixels are mixed with the mirror, so the mask left them. Tyres sit on the disc with a dark contact and a short reflection of the wheel. The floor is smooth. It still reads as a graded photograph in a rendered room.
- **RAV4 side.** Both door windows are the same dark gradient. The roof and the doors stay white. Both tyres share a y. The reflection under the rocker is the wheel and the lower door, faded, on the disc. This source is the 2022 RAV4 Prime, not the car in the front and rear frames.
- **RAV4 rear.** The rear windshield is a dark gradient. The roof above it and the tailgate below it are white. The small quarter window behind the rear door still shows trees. Tail lamps stay. Tyres are within 2 px.
- **Accord grey.** No glass was painted. The windshield still shows green trees and blue sky, and the wipers are still there. The roof and the hood are grey. They are not covered by a black fill. Tyres are level. The hood still has the outdoor highlight.
- **Camry black.** No glass was painted. The windshield shows sky, clouds and the wiper. The body is black. The hard speckles are softer than the lot photo; the wide sky shine on the roof and hood is still there. Nothing black was painted over the roof, because the roof was already the dark thing the old mask was confusing with glass.

## Against the MyLoan frame

The reference is the white Trailblazer on myloan.ca: every window is dark with a soft highlight, the paint looks lit by the cove, and the car is large on a pale disc. Run 14 gets the windshield, the side-view windows, and the rear glass into that dark-gradient state, and the white panels up near the wall. It does not get the front side window, the rear quarter window, or either of the other two cars' glass. The panel highlights are still the shape of the outdoor photo.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Browser cutout is still `@imgly/background-removal@1.6.0`. Ghost guides were not edited. Do not merge.
