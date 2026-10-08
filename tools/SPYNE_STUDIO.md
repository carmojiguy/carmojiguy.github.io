# Free in-house studio (Spyne-style), run 16

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

The window mask and the smoky blend are the run 15 versions, unchanged. `mitbersh/car-parts-segmentation` (YOLO26-s, downloaded at runtime, not committed) still supplies windshield, back-windshield, and the door windows. Roof, hood, mirror, and fender predictions are subtracted. The fill is still the feathered gradient mixed with 16% of the crushed original glass.

## What changed

The Camry cutout included the grey car parked behind it. On a dark car, a bright cap sitting on the black roof is dropped (3,130 px on the Camry). Light cars are left alone, because their roofs are already bright. Separate specks go too. I checked the other four cutouts; none had a second vehicle on the roof.

The Accord roof and A-pillar were a hard staircase. BiRefNet-general-lite is run again at a long side of about 2,000 when the source photo is the same car (the side cutout is the white Prime, and the test-rav4 side file is a different car, so that one keeps its existing matte). The outer contour is smoothed with a 9-point average and a 1 px soft rim. The choke no longer flattens that rim back to a binary edge.

Paint, and only paint, gets a broader relight. A wide blur of the body is pulled toward an even, slightly top-lit colour. Panel gaps and character lines stay in the high-frequency detail. One soft horizontal streak sits along the shoulder, under the glass. Tail-lamp masks from the same parts model are repainted as red lenses, so the lot is not still reflected in the lamp. Glass pixels are not in that pass.

Floor, tyre level, reflection, white balance, and the light-paint lift are still the run 14 versions.

## What the render log printed

Plates are 2000×1334. Wall sample is 231, 232, 234.

| Frame | Rotation | Tyre dy | Glass fraction |
| --- | --- | --- | --- |
| RAV4 front | +0.9° | 0 px | 0.076 |
| RAV4 side | +9.3° | 1.2 px | 0.105 |
| RAV4 rear | −0.8° | 0 px | 0.077 |
| Accord grey | −11.7° | 0.9 px | 0.079 |
| Camry black | +7.1° | 1.7 px | 0.073 |

## What I see

I opened each full frame and the 100% crops of the glass, the roof edge, and the paint. The sheet’s left panel is the first photo in the uploaded MyLoan screenshot: the white Trailblazer on the turntable.

- **RAV4 front.** Windshield and both side windows are the smoky tint, with a headrest, and the B-pillar is white. The roof edge against the wall is a clean curve. The hood is more even than run 15 and still carries the outdoor highlight along the centre. It would not pass next to the Trailblazer. That paint is lit by the cove; this is still a graded cutout.
- **RAV4 side.** Four separate windows, white pillars, no second car. The rear lamp is a red lens. The shoulder has one soft streak. Same limit as the front: the body is a relit photograph. It would not pass.
- **RAV4 rear.** The tail lamps are red lenses. The trees that used to sit in that plastic are gone. Rear glass is tinted. The roof is white. It would not pass. The lamp is cleaner than the lot lamp and flatter than a lamp shot in the cove, and the tailgate still reads as the outdoor panel with the shading compressed.
- **Accord.** The roof and the A-pillar at 100% are a smooth edge on the wall, not the staircase from run 15. Glass is tinted. The grey paint is more even, with one shoulder streak, and the hood still has some of the outdoor shine. It would not pass next to the reference.
- **Camry.** The grey roof and the spoiler are gone. Above the roof, from about y=144 to y=296 on the 2000×1334 frame, the pixels are the wall. The 100% roof crop is black paint, a soft streak, and tinted glass. The sky gradient on the hood is gone. It would not pass. It is the closest of the five on the paint, and it is still a cutout in a rendered room.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Ghost guides were not edited. Do not merge.
