#!/usr/bin/env python3
"""Background-conditioned IC-Light (lllyasviel iclight_sd15_fbc) on CPU.

The foreground is the subject on mid-grey. The background is the cove plate.
One text-to-image pass, no high-res second pass. The caller keeps only the
low-frequency shading from this image.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import torch
from PIL import Image


BASE = (
    "/tmp/hf-cache/models--stablediffusionapi--realistic-vision-v51/"
    "snapshots/19e3643d7d963c156d01537188ec08f0b79a514a"
)
OFFSET = (
    "/tmp/hf-cache/models--lllyasviel--ic-light/snapshots/"
    "9cad1878695f546a7fb9eaca14e2a89131ba5ffe/iclight_sd15_fbc.safetensors"
)

PROMPT = (
    "a car in a bright white photo studio, soft overhead light, softbox, "
    "even illumination, realistic glossy paint"
)
A_PROMPT = "best quality"
N_PROMPT = "lowres, bad anatomy, cropped, worst quality, text, watermark, logo, extra car, outdoor, trees, sky"


def _multiple(n, base=64):
    return max(base, int(round(n / base)) * base)


def target_size(width, height, long_side):
    long_side = _multiple(long_side)
    if width >= height:
        w = long_side
        h = _multiple(height * (long_side / float(width)))
    else:
        h = long_side
        w = _multiple(width * (long_side / float(height)))
    return w, h


def resize(image, w, h):
    return np.asarray(Image.fromarray(image).resize((w, h), Image.Resampling.LANCZOS))


def numpy2pytorch(imgs):
    # 127 maps to 0, matching the IC-Light demo.
    h = torch.from_numpy(np.stack(imgs, axis=0)).float() / 127.0 - 1.0
    return h.movedim(-1, 1)


def pytorch2numpy(imgs):
    out = []
    for x in imgs:
        y = x.movedim(0, -1)
        y = y * 127.5 + 127.5
        out.append(y.detach().float().cpu().numpy().clip(0, 255).astype(np.uint8))
    return out


def load_models():
    from diffusers import AutoencoderKL, DPMSolverMultistepScheduler, StableDiffusionPipeline, UNet2DConditionModel
    from transformers import CLIPTextModel, CLIPTokenizer
    import safetensors.torch as sf

    if not os.path.isfile(os.path.join(BASE, "unet", "diffusion_pytorch_model.safetensors")):
        raise SystemExit("missing Realistic Vision weights at " + BASE)
    if not os.path.isfile(OFFSET):
        raise SystemExit("missing iclight_sd15_fbc at " + OFFSET)

    print("loading tokenizer, text encoder, vae, unet", flush=True)
    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained(BASE, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(BASE, subfolder="text_encoder", torch_dtype=torch.float32)
    vae = AutoencoderKL.from_pretrained(BASE, subfolder="vae", torch_dtype=torch.float32)
    unet = UNet2DConditionModel.from_pretrained(BASE, subfolder="unet", torch_dtype=torch.float32)
    print("  base loaded in", round(time.time() - t0, 1), "s", flush=True)

    with torch.no_grad():
        new_conv = torch.nn.Conv2d(
            12, unet.conv_in.out_channels, unet.conv_in.kernel_size, unet.conv_in.stride, unet.conv_in.padding
        )
        new_conv.weight.zero_()
        new_conv.weight[:, :4, :, :].copy_(unet.conv_in.weight)
        new_conv.bias = torch.nn.Parameter(unet.conv_in.bias.detach().clone())
        unet.conv_in = new_conv

    offset = sf.load_file(OFFSET)
    origin = unet.state_dict()
    merged = {}
    for key, value in origin.items():
        if key not in offset:
            raise SystemExit("offset missing " + key)
        extra = offset[key].float()
        if tuple(extra.shape) != tuple(value.shape):
            raise SystemExit(f"shape {key} origin {tuple(value.shape)} offset {tuple(extra.shape)}")
        merged[key] = value.float() + extra
    unet.load_state_dict(merged, strict=True)
    del offset, origin, merged

    device = torch.device("cpu")
    text_encoder = text_encoder.to(device)
    vae = vae.to(device)
    unet = unet.to(device)
    text_encoder.eval()
    vae.eval()
    unet.eval()
    try:
        from diffusers.models.attention_processor import AttnProcessor2_0
        unet.set_attn_processor(AttnProcessor2_0())
        vae.set_attn_processor(AttnProcessor2_0())
        print("  attention sdpa", flush=True)
    except Exception as exc:
        print("  attention default", exc, flush=True)

    original = unet.forward

    def hooked(sample, timestep, encoder_hidden_states, **kwargs):
        conds = kwargs["cross_attention_kwargs"]["concat_conds"].to(sample)
        reps = sample.shape[0] // conds.shape[0]
        conds = torch.cat([conds] * reps, dim=0)
        sample = torch.cat([sample, conds], dim=1)
        kwargs["cross_attention_kwargs"] = {}
        return original(sample, timestep, encoder_hidden_states, **kwargs)

    unet.forward = hooked

    scheduler = DPMSolverMultistepScheduler(
        num_train_timesteps=1000,
        beta_start=0.00085,
        beta_end=0.012,
        algorithm_type="sde-dpmsolver++",
        use_karras_sigmas=True,
        steps_offset=1,
    )
    pipe = StableDiffusionPipeline(
        vae=vae,
        text_encoder=text_encoder,
        tokenizer=tokenizer,
        unet=unet,
        scheduler=scheduler,
        safety_checker=None,
        requires_safety_checker=False,
        feature_extractor=None,
        image_encoder=None,
    )
    pipe.set_progress_bar_config(disable=True)
    print("  ready", round(time.time() - t0, 1), "s", flush=True)
    return pipe, tokenizer, text_encoder, vae


def encode_pair(tokenizer, text_encoder, positive, negative):
    def inner(text):
        max_length = tokenizer.model_max_length
        chunk = max_length - 2
        bos, eos = tokenizer.bos_token_id, tokenizer.eos_token_id
        tokens = tokenizer(text, truncation=False, add_special_tokens=False)["input_ids"]
        chunks = [[bos] + tokens[i : i + chunk] + [eos] for i in range(0, max(len(tokens), 1), chunk)]
        chunks = [c[:max_length] + [eos] * (max_length - len(c)) for c in chunks]
        ids = torch.tensor(chunks, dtype=torch.int64)
        return text_encoder(ids).last_hidden_state

    cond = inner(positive)
    uncond = inner(negative)
    n = max(cond.shape[0], uncond.shape[0])
    if cond.shape[0] < n:
        cond = cond.repeat((n + cond.shape[0] - 1) // cond.shape[0], 1, 1)[:n]
    if uncond.shape[0] < n:
        uncond = uncond.repeat((n + uncond.shape[0] - 1) // uncond.shape[0], 1, 1)[:n]
    return torch.cat(list(cond), dim=0)[None], torch.cat(list(uncond), dim=0)[None]


def relight(pipe, tokenizer, text_encoder, vae, fg, bg, steps, seed, long_side):
    h0, w0 = fg.shape[:2]
    w, h = target_size(w0, h0, long_side)
    fg_r = resize(fg, w, h)
    bg_r = resize(bg, w, h)
    print(f"  size {w}x{h} steps {steps}", flush=True)
    with torch.inference_mode():
        lat = numpy2pytorch([fg_r, bg_r])
        lat = vae.encode(lat).latent_dist.mode() * vae.config.scaling_factor
        concat = torch.cat([c[None] for c in lat], dim=1)
        cond, uncond = encode_pair(tokenizer, text_encoder, PROMPT + ", " + A_PROMPT, N_PROMPT)
        generator = torch.Generator(device="cpu").manual_seed(int(seed))
        t0 = time.time()

        def on_step(pipe, step_index, timestep, callback_kwargs):
            print(f"  step {step_index + 1}/{steps} {round(time.time() - t0, 1)}s", flush=True)
            return callback_kwargs

        result = pipe(
            prompt_embeds=cond,
            negative_prompt_embeds=uncond,
            width=w,
            height=h,
            num_inference_steps=int(steps),
            num_images_per_prompt=1,
            generator=generator,
            output_type="latent",
            guidance_scale=7.0,
            cross_attention_kwargs={"concat_conds": concat},
            callback_on_step_end=on_step,
        )
        pixels = vae.decode(result.images / vae.config.scaling_factor).sample
        image = pytorch2numpy(pixels)[0]
    print("  done", round(time.time() - t0, 1), "s", flush=True)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fg")
    parser.add_argument("--bg")
    parser.add_argument("--out")
    parser.add_argument("--jobs")
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--long-side", type=int, default=768)
    args = parser.parse_args()
    torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "4")))
    pipe, tokenizer, text_encoder, vae = load_models()
    jobs = []
    if args.jobs:
        jobs = json.load(open(args.jobs))
    else:
        jobs = [{"fg": args.fg, "bg": args.bg, "out": args.out, "seed": args.seed}]
    for job in jobs:
        print("relight", job["out"], flush=True)
        fg = np.asarray(Image.open(job["fg"]).convert("RGB"))
        bg = np.asarray(Image.open(job["bg"]).convert("RGB"))
        image = relight(
            pipe, tokenizer, text_encoder, vae, fg, bg,
            steps=job.get("steps", args.steps),
            seed=job.get("seed", args.seed),
            long_side=job.get("long_side", args.long_side),
        )
        os.makedirs(os.path.dirname(os.path.abspath(job["out"])), exist_ok=True)
        Image.fromarray(image, "RGB").save(job["out"])
        print("wrote", job["out"], image.shape, flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ICLIGHT_FAIL", type(exc).__name__, exc, flush=True)
        sys.exit(1)
