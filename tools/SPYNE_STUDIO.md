# Free in-house studio (Spyne-style), run 13

This is a proof. It is not wired into the phone app. Nothing here calls a paid API. Do not merge it.

The bar is the owner's MyLoan screenshot: a white Trailblazer on a seamless light-grey cove, a large pale glossy turntable with one thin circle, dark neutral glass, a soft reflection under the car, and a floor with no grain. Run 12 was the same RAV4 front with trees in the glass, a grainy floor, a squashed reflection, and a side shot whose tyres were not level.

## What changed in this run

`tools/blender_spyne_plate.py` renders the empty set at 160 samples with adaptive sampling off. Ubuntu's Blender 4.0.2 has no OpenImageDenoise, so `tools/spyne_composite.py` denoises the plate with Intel's standalone OIDN 2.3.3 (`--ldr --srgb -q high`) and then draws the circle.

On the cutout, in order:

1. Rotate so the two tyre valleys share a y. The previous rotation used the wrong sign, so each pass made the tilt worse. A positive PIL angle is the direction that lifts a low right-hand tyre. Valleys closer than a quarter of the car are treated as one wheel.
2. Match the highlight colour to the wall, lift shadows, and push light paint toward the wall with a shoulder so the panels do not clip flat.
3. Replace cabin glass. The mask is every large region in the upper 47% of the body whose colour is not the door paint, including opaque glass that still holds trees or sky. It is filled with a dark blue-grey gradient and a soft softbox streak. The hood is left as paint so a sky reflection on the bonnet does not become a black window.
4. Pull green and blue casts on the paint back toward the door colour, then add a broad softbox band on the shoulder and the hood.
5. Choke the silhouette by 1 px and repaint that edge from the interior, so the matte is hard and has no halo.
6. A tight dark contact under each tyre, plus a wider soft occlusion under the body.
7. A vertical mirror of the lower car, not squashed, faded, blurred, and clipped to the disc.

The Camry with the hood stickers is gone. The two extra cars are a 2023 Accord EX in Meteoroid Grey and a 2025 Camry Hybrid in Midnight Black, both CC BY-SA 4.0 dealer-lot fronts. The white RAV4 front and rear are the 2021 XLE (CC BY-SA 4.0). The side is the 2022 RAV4 Prime (CC BY-SA 3.0), a different car.

## IC-Light

Both free Spaces answered. Neither result is in the final frames.

- `lllyasviel/IC-Light` was RUNNING on ZeroGPU. `gradio_client` cannot load it because `/info` returns 500. The Gradio 4 queue accepted a job and finished in about 8 seconds. That Space is foreground-conditioned only: there is no background-image input. The output was 1152×640 and went dark, not high-key.
- `GreenGoat/IClight-demo` was RUNNING and is background-conditioned. The first call and a second call at 1024 both returned. The Space delivered about 768×448 even when asked for 1024. One frame was a real relight (it matched neither the cutout nor the plate), but the background it invented was a mid grey, not our plate, and the car was far below 2000 px. Upscaling that into the frame would soften the panels, and the diffusion can rewrite the car.

Every other IC-Light duplicate checked this run was `RUNTIME_ERROR` or `PAUSED`, including `lllyasviel/iclight-v2-vary`. The CPU grade above is what the five frames use.

## What the frames measure

Plates are 2000×1334. Wall sample on the finished front is 231, 232, 234.

Floor grain is the high-frequency part, not the shading gradient. On the raw 160-sample plate that was about 2.5 levels. After OIDN it is about 0.12 on the plate and 0.19 on the composited floor away from the car. A 36×36 patch that was std 3.4 is std about 0.5 after the denoise. The floor reads smooth.

Tyre contact, left minus right, after placement:

| Frame | Rotation | Tyre dy |
| --- | --- | --- |
| RAV4 front | +0.9° | 1.4 px |
| RAV4 side | +9.2° | 0 px |
| RAV4 rear | −0.9° | 1.4 px |
| Accord grey | −11.7° | 2.1 px |
| Camry black | +6.9° | 1.1 px |

The windshield band on the RAV4 front is 96% darker than the pillars. Those pixels are 49, 57, 68 with high-frequency energy of 0.6, which is a smooth gradient, not leaves. The Accord, Camry, side, and rear windows land in the same dark blue-grey with a standard deviation of 6 to 11. Run 12 still had the trees, because that glass was opaque and the old fill only painted holes.

White-paint midtones on the RAV4 front sit near 180, and the bright panels near 215, against a wall at 231. The lift moved them up from the run 12 exposure. The shape of the outdoor highlights is still the lot photo.

The mirror is a real flip of the lower body, anchored at the tyres. The disc in front of the tyres is only about 150 px tall on the low camera, so what you see is the wheels and the rocker. The doors would land past the circle. It is not the squashed smear from run 12, and it is also not a tall Spyne mirror.

## Verdict, per frame

None of the five holds up next to the MyLoan screenshot yet. The specific run 12 failures that were called out are largely closed. The remaining gap is the same on every frame: the car is still a graded photograph sitting in a rendered room.

- **RAV4 front.** Glass is clean, tyres are level, the floor is smooth, and there is a contact shadow plus a short reflection of the wheel. It still looks like a cutout because the panel highlights and the shut lines are the outdoor photo, the white is a little duller than the wall, and the window is a painted gradient rather than glass in a real softbox room.
- **RAV4 side.** The 9° rotation puts both tyres on the same line. Glass is clean. Same paint and reflection limits. This is also a different, 2022 Prime, not the white car in the front and rear.
- **RAV4 rear.** Same as the front. Tyres within 2 px. Glass is a flat gradient. The tail lamps stay, because the outdoor-cast removal only pulls green and blue.
- **Accord grey.** Windows are a smooth dark gradient now. The 12° rotation is what it took to level the two contacts in that photo, and the car sits flat afterwards. The hood still carries the lot highlight. It does not yet look photographed in this room.
- **Camry black.** Windows are smooth and dark. The black paint keeps the outdoor speculars, so the car still reads as pasted onto the cove. A high-key room does not turn a black car white, and this pass does not invent new studio highlights on the panels.

## What is deliberately untouched

The live app still uses the ring-free satin discs and `web-studio.js`. Browser cutout is still `@imgly/background-removal@1.6.0`. Ghost guides were not edited in this run. The wordmark is Liberation Sans Bold, not licensed Arial.
