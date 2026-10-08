# Free in-house studio (Spyne-style), run 17

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

The window mask and the smoky blend are the run 15 versions, unchanged. `mitbersh/car-parts-segmentation` still supplies the glass. The fill is still the feathered gradient mixed with 16% of the crushed original glass.

## What changed

The Camry matte was still the two cars. The bright-cap drop from run 16 only removed a light strip, and the dark hatchback stayed. The parts model finds two roofs on that cutout. The upper roof (top at y≈87 on the 2000×1070 recut) is not the Camry. The subject is the other parts, including the lower roof. BiRefNet alpha outside that dilated subject is cleared, and anything above the subject roof line goes with it. On the finished 2000×1334 frame the roof starts at y=378. Rows y=250, y=320 and y=360 through the roof span are the wall, 231, 232, 234. There is no second roofline and no white stripe up there.

The Camry was floating because the silhouette contact was not the rubber. Both tyre bottoms now come from the wheel masks and sit on the same ground line as the RAV4 (y≈1000, 0.9 px apart). The contact shadow is the same function the RAV4 uses.

The RAV4 front edge was a white fringe on the black cladding. Inpaint was sampling the white lot that BiRefNet leaves under a clear alpha. That inpaint is gone. A bright pixel in the outer 5 px is replaced with the interior colour when it is much lighter than that interior. The lower envelope is also smoothed in screen space, without filling the wheel arches. On the finished frame the rocker boundary pixel is black, about 11, 11, 11, and the light pixels below it are the floor.

Paint shading is a local IC-Light pass, not another grade. `lllyasviel/ic-light` `iclight_sd15_fbc` is added to `stablediffusionapi/realistic-vision-v51` and run on CPU at 768×512, 20 steps, about 92 seconds and 5 GB each. The foreground is the cutout on mid-grey. The background is the rendered cove plate. Only the low-frequency ratio (a wide blur, clamped between 0.42 and 1.85) is multiplied onto the full-resolution cutout. Badges, grille, wheels, text and the plate stay. The glass blend is applied after that. If that pass is missing, the run 16 grade is the fallback. All five frames used the IC-Light pass.

## What the render log printed

Plates are 2000×1334. Wall sample is 230, 232, 234. Every frame took the IC-Light transfer.

| Frame | Rotation | Tyre dy | Glass fraction | Contacts |
| --- | --- | --- | --- | --- |
| RAV4 front | +4.1° | 0 px | 0.076 | wheel masks |
| Camry black | +6.9° | 0.9 px | 0.073 | wheel masks |
| RAV4 side | +2.6° | 0 px | 0.105 | silhouette (one wheel pair was not returned) |
| RAV4 rear | −0.8° | 0 px | 0.075 | wheel masks |
| Accord grey | −11.5° | 0.9 px | 0.079 | wheel masks |

## What I see

I opened each full frame, the sheet next to the Trailblazer crop from `uploads/myloan-reference.png`, the pixels above the Camry roof, and 100% crops of the RAV4 rocker, the rear corner, the paint and the glass.

- **Camry.** The hatchback, its windows, the spoiler and the white stripe are not in the frame. Above the roof is the wall. The tyres meet the disc and a contact shadow sits under them. The glass is the smoky tint. The paint is darker and more even than the outdoor shot, and the badge and the plate are still the original. It would not pass next to the Trailblazer. The light is a transferred shading field, the floor reflection is only the mirrored lower body, and the roof still carries a broad highlight from the source photo.
- **RAV4 front.** The windows are separate smoked openings with the pillar left white. The rocker and the rear corner read as black cladding against the floor, without the white speckled fringe from run 16. Dirt on the cladding is still there, which is the original detail. It would not pass next to the Trailblazer. The body is lit more like the cove than the grade was, and it is still a cutout: the edge is a mask, and the reflection is not a full car in that floor.
- **RAV4 side.** This is the white Prime, not the grey car in the test-rav4 side file. The glass is tinted. The tail lamp is a red lens on the rear quarter, and the quarter panel around it stays white. The tyres meet the disc on this plate. It would not pass.
- **RAV4 rear.** The tail lamps are red lenses. The rear glass is tinted. The roof is white. It would not pass. The lamp fill is flatter than a lamp shot in the cove.
- **Accord.** The roof edge is a smooth line on the wall. The glass is tinted. The grey paint took the same low-frequency transfer. It would not pass.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Ghost guides were not edited. The weights are downloaded at runtime and are not in the repo. Do not merge.
