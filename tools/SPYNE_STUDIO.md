# Free in-house studio (Spyne-style)

This is a proof. It is not wired into the phone app, and it does not call a paid API.

## What the references actually do

MyLoan listing photos (the phone screenshot the owner sent) are the bar. Spyne's own pages and the AutoVerified / Car Media samples were checked the same way.

- Wall: seamless, high-key, light grey. Almost no horizon.
- Floor: one large light-grey glossy turntable, nearly edge to edge. One thin circle, not a stack of rings.
- The car is large. The tyres sit on the disc. A soft reflection lives under the car and dies quickly. Glass stays dark and neutral.
- A small wordmark sits at the top centre.
- AutoVerified's public Premium Capture sample is the same idea on a grey cove with a dealer logo. Their new-car library photos are outdoor, not studio. Current gmautosales.ca inventory HTML does not expose the old studio frames, and the archive was not holding a usable listing photo.

The lot photos on images.app.ridemotive.com are the *before* pictures. They are not the Spyne output.

## How this build works

1. `tools/blender_spyne_plate.py` renders an empty set in Blender Cycles on CPU. Cyclorama, one glossy disc, soft area lights, three camera heights (`h070`, `h100`, `h140`). No car in the render.
2. `tools/spyne_composite.py` takes a BiRefNet cutout and:
   - smooths the plate (this Blender build has no OpenImageDenoise)
   - draws one constant-width circle from the projected disc (a real tube turns into a thick bar up close and disappears at the far edge)
   - finds the left and right tyre bottoms and seats them on the ground line for that camera
   - drops mask that hangs well below the tyres (the lot shadow)
   - paints a contact shadow and a short ambient occlusion, clipped to the disc
   - flips and squashes only the lower body into a reflection, faded out, clipped to the disc
   - fills real window holes with a dark neutral gradient
   - pulls the paint a little toward the wall colour
   - stamps a small G&M wordmark (Liberation Sans Bold, not licensed Arial)

The live `web-studio.js` path is unchanged. Background removal in the browser is still the existing imgly model.

## What would run after an upload

The phone should not do this. A free worker can:

- GitHub Actions on this public repo: CPU only, minutes per photo, no GPU.
- A free Hugging Face Space, including the public IC-Light Space through `gradio_client`, if a GPU is actually free that day. It often is not.
- The same composite on CPU. The plate is rendered once per camera and reused.

Nothing here calls Spyne, AutoVerified, or a paid relight API. IC-Light was not run for this proof: this machine has no GPU and no torch, and a free Space was not required to produce the sheets.

## What the proof measures

Panels are 2000×1334. Width is the alpha bounding box of the cutout after it is placed.

- RAV4 front and rear: 88% of the frame wide. Roof starts at 17–18% so it clears the wordmark. Tyre bottoms sit at about 75% of the frame height, inside the disc, with the near arc still below them.
- RAV4 side: 82% wide. The source is the darker 2022 Prime, and the two tyres in that photo are not level, so one sits a little higher.
- Camry front: 74% wide. The cutout is tall (windshield and roof), so 88% width would run the roof through the wordmark. Hood stickers are still in the paint.

The turntable circle is a constant-width stroke. Contact shadows meet the tyres. The reflection is only the lower body, squashed, faded, and clipped to the disc. Glass is a dark gradient in the upper holes only.

## Honest limits

- The car is still a photographed cutout pasted on a rendered floor. Spyne relights the paint. This pass only shifts white balance. Panel gaps and lot highlights stay in the source photo.
- The side RAV4 is a different, darker 2022 Prime than the white front and rear.
- The Camry hood stickers are in the paint. The cutout cannot remove them.
- Window glass is a flat dark gradient in the holes BiRefNet already punched. It is not a photographed studio reflection.
- The circle is drawn at a constant pixel width on purpose. A modelled ring cannot stay thin at both edges of this lens.
- The wordmark is Liberation Sans, stacked to read heavier. It is not Arial.
- Cycles on CPU at 48 samples is slightly grainy even after the bilateral filter. More samples would be cleaner and slower.
- Direction B (the photo-studio panorama with the curtain and the blue pillow) is dropped. Those plates are not used.
