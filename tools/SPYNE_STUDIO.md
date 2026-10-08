# Free in-house studio (Spyne-style), run 18

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

The window mask and the smoky blend are the run 15 versions, unchanged. The Camry subject matte, the IC-Light low-frequency transfer, the contact shadows and the glass blend are the run 17 versions. `mitbersh/car-parts-segmentation` still supplies the glass.

## What was wrong in the run 17 side frame

The RAV4 side was missing the entire rear wheel. The floor showed through the rear arch. The run 17 note said the tyres met the disc. That was false. The parts model finds two wheels on the side cutout. The rear wheel (`left_back-wheel`, about 44,000 px) does not touch the body-part masks, so the largest-component filter in `keep_subject` deleted it before the lower-envelope smooth ever ran. About 67,000 px left with it.

## What changed

Wheel masks are part of the subject. After `keep_subject`, `smooth_silhouette`, `smooth_profiles` and `defringe`, the original wheel pixels are copied back. `clip_hanging_shadow` and `choke` take the same mask and put those pixels back if a cleanup touched them.

On a black car (door-panel median under 70; the Camry is about 55, the white RAV4s are about 232, the Accord is about 121) the hood and the front fender are replaced with the door colour plus one soft streak. A bright neutral patch on the upper body, including the strip above the C-pillar, is painted the same dark colour. Red and yellow lamps stay, because that pass skips pixels whose channels differ by more than 70. The glass blend formula is unchanged. The bottom half of the windshield is then a flat dark glass.

A frame is written as `{name}.jpg` only after the gate below passes. A failure is written as `{name}-FAIL.jpg` and the table says FAIL.

## The gate

Run before a frame is a final. Source wheels are the parts model on the subject cutout (the BiRefNet recut of the source photo; the side cutout has no separate photo), transformed by the same rotate and scale as the car. Wheels smaller than 40% of the largest wheel are dropped on both sides, which removes the bumper-corner false wheel on the RAV4 rear and a contact-shadow detection. Reflections that miss the car alpha are dropped.

| Check | Rule |
| --- | --- |
| Wheels | Same count, and every source wheel matches a final wheel at IoU > 0.6 |
| Area | Final alpha (alpha > 128) within ±3% of the subject mask after scaling |
| Holes | Fill-holes changes under 0.2% of the subject, ignoring the open gap between the tyres |
| Roof | Pixels above the subject roofline, under the wordmark, that are not the wall: 40 or fewer |

## QA table

Plates are 2000×1334. Wall sample is 230, 232, 234. Every frame took the IC-Light transfer. All five passed. The table is `qa-table.txt` next to the frames.

| Car | Wheels | Count | Min IoU | Area | Error | Holes | Roof | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RAV4 front | PASS | 2/2 | 0.973 | PASS | 0.004 | PASS | PASS | PASS |
| Camry | PASS | 2/2 | 0.957 | PASS | 0.005 | PASS | PASS | PASS |
| RAV4 side | PASS | 2/2 | 0.891 | PASS | 0.007 | PASS | PASS | PASS |
| RAV4 rear | PASS | 2/2 | 0.950 | PASS | 0.003 | PASS | PASS | PASS |
| Accord | PASS | 2/2 | 0.976 | PASS | 0.005 | PASS | PASS | PASS |

## What the pixels show

- **RAV4 side.** Both wheels are on the finished frame. The rear wheel box is (1018, 618)–(1326, 904), 68,843 px, median luminance 43, bottom at y=903. The front wheel is 35,551 px, bottom at y=906. Both sit on the h140 ground line (y≈904). The arch above the tyre is open, which is the floor behind the wheel. Min IoU against the source wheel is 0.891.
- **Camry hood.** On the run 17 frame the hood median was 186 and the high-frequency detail was 16.6. On this frame the hood median is 89 and the detail is 8.4. A sample on the hood is about (90, 87, 94) to (96, 93, 100): dark paint with one soft lift. The door median is 55, so the white cars and the Accord are left alone.
- **Camry rear roof.** The bright grey patch beside the tail lamp, which read about (230, 220, 225), is now (56, 50, 52). The lamp pixel beside it is (189, 22, 16). Rows y=250, y=320 and y=360 through the roof span are the wall, (231, 232, 234).
- **The other three.** Wheel IoU is 0.95 or higher, area error is under 1%, and the roof check is 0. The RAV4 front rocker sample near the cladding is about (136, 137, 141) against the floor.

None of the five would pass next to the Trailblazer crop. The light is a transferred shading field, the floor reflection is the mirrored lower body, and the wordmark is Liberation Sans standing in for Arial.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Ghost guides were not edited. The weights are downloaded at runtime and are not in the repo. Do not merge.
