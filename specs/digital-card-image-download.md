# Plan: Digital Card Full Image Download

## Task Description

Update `DigitalCard.tsx` to capture and download the **entire card** (not just the QR code) as a PNG image using `html-to-image`. Also fix the issue where `QRCodeSVG` cannot be used as a JSX component (type incompatibility).

## Objective

- Replace the current SVG-only QR code download with a full card image capture using `html-to-image`
- Fix the `QRCodeSVG` JSX component type error
- Allow users to save the complete digital membership card as a PNG

## Problem Statement

1. The current download only saves the QR code SVG, not the full card
2. `QRCodeSVG` from `qrcode.react` has a type incompatibility preventing it from being used as a JSX component (likely a React types version mismatch)

## Solution Approach

- Install `html-to-image` to capture the full card DOM node as a PNG
- Change the `ref` from targeting the SVG to targeting the card's root `Card` element
- Replace the SVG serialization logic with `toPng` from `html-to-image`
- Switch from `QRCodeSVG` to the canvas-based `QRCodeCanvas` (or use the `qrcode` package directly) to fix the JSX type error and improve image capture compatibility (canvas renders more reliably with `html-to-image` than SVG)

## Relevant Files

- `src/components/member/DigitalCard.tsx` — main file to modify
- `src/utils/download.ts` — existing download utility (will still be used or adapted)
- `package.json` — add `html-to-image` dependency

## Step by Step Tasks

### 1. Install html-to-image

- Run `pnpm add html-to-image`

### 2. Update DigitalCard.tsx

- Change import: replace `QRCodeSVG` with `QRCodeCanvas` from `qrcode.react` (fixes JSX type error and works better with html-to-image)
- Change `useRef<SVGSVGElement>` to `useRef<HTMLDivElement>` targeting the entire card
- Add the `ref` to the outer `Card` wrapper (or a wrapping `div`)
- Replace `onSVGButtonClick` with an async function that uses `toPng` from `html-to-image`:

  ```typescript
  import {toPng} from 'html-to-image';

  async function onDownloadClick() {
    const node = cardRef.current;
    if (!node) return;

    const dataUrl = await toPng(node, {pixelRatio: 2});
    downloadStringAsFile(dataUrl, `${card.memberName.split(' ').join('-')}-membership-card.png`);
  }
  ```

- Move the "Download Card" button **outside** the white QR code box so it's not captured in the image, or hide it during capture
- Strategy: Hide the button during capture using a temporary style, or place the button outside the card ref scope

### 3. Handle button visibility during capture

- Place the download button outside the `ref`-targeted element so it doesn't appear in the captured image
- Structure: wrap card content in a `div ref={cardRef}` inside the `Card`, and place the button after the ref div

### 4. Run post-task quality checks

- `pnpm tsc` — verify no type errors
- `pnpm lint` — fix lint issues
- `pnpm format` — format files
- `pnpm test` — run tests
- `pnpm build` — verify build

## Acceptance Criteria

- [ ] `html-to-image` is installed
- [ ] Clicking "Download Card" saves a PNG of the **entire card** (header, member info, QR code)
- [ ] No TypeScript errors related to `QRCodeSVG` / `QRCodeCanvas`
- [ ] The download button itself is not visible in the captured image
- [ ] All post-task checks pass (tsc, lint, format, test, build)

## Validation Commands

- `pnpm tsc` — No type errors
- `pnpm lint` — No lint errors
- `pnpm build` — Successful build

## Notes

- `html-to-image` uses `toPng`, `toJpeg`, `toSvg`, `toBlob` etc. We use `toPng` for broad compatibility
- `pixelRatio: 2` produces a higher-resolution image suitable for retina displays
- `QRCodeCanvas` renders a `<canvas>` element which `html-to-image` captures more reliably than inline SVG
