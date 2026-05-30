import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampZoomTranslation,
  displayedImageSize,
  focalPointDoubleTapUpdate,
  focalPointScaleUpdate,
} from '@/utils/zoomable-image-math';

describe('zoomable-image-math', () => {
  it('keeps focal point fixed during pinch scale change', () => {
    const start = focalPointScaleUpdate({
      focalX: 200,
      focalY: 300,
      viewportWidth: 400,
      viewportHeight: 800,
      startScale: 1,
      startTranslateX: 0,
      startTranslateY: 0,
      gestureScale: 2,
      minScale: 1,
      maxScale: 4,
    });

    assert.equal(start.scale, 2);
    // Focal at center → no translation drift.
    assert.equal(start.translateX, 0);
    assert.equal(start.translateY, 0);

    const offset = focalPointScaleUpdate({
      focalX: 300,
      focalY: 400,
      viewportWidth: 400,
      viewportHeight: 800,
      startScale: 1,
      startTranslateX: 0,
      startTranslateY: 0,
      gestureScale: 2,
      minScale: 1,
      maxScale: 4,
    });

    assert.equal(offset.translateX, -100);
    assert.equal(offset.translateY, 0);
  });

  it('clamps pan at edges for scaled content', () => {
    const clamped = clampZoomTranslation({
      translateX: 500,
      translateY: -500,
      scale: 2,
      viewportWidth: 400,
      viewportHeight: 400,
      contentWidth: 400,
      contentHeight: 400,
    });

    assert.equal(clamped.translateX, 200);
    assert.equal(clamped.translateY, -200);
  });

  it('computes contain layout size from image aspect ratio', () => {
    const displayed = displayedImageSize({
      imageWidth: 800,
      imageHeight: 1600,
      viewportWidth: 400,
      viewportHeight: 800,
      contentFit: 'contain',
    });

    assert.equal(displayed.width, 400);
    assert.equal(displayed.height, 800);
  });

  it('double tap zooms toward tap point then resets', () => {
    const zoomIn = focalPointDoubleTapUpdate({
      tapX: 300,
      tapY: 400,
      viewportWidth: 400,
      viewportHeight: 800,
      currentScale: 1,
      currentTranslateX: 0,
      currentTranslateY: 0,
      zoomInScale: 2.5,
      zoomOutThreshold: 1.02,
    });

    assert.equal(zoomIn.zoomingIn, true);
    assert.equal(zoomIn.scale, 2.5);
    assert.equal(zoomIn.translateX, -150);

    const zoomOut = focalPointDoubleTapUpdate({
      tapX: 300,
      tapY: 400,
      viewportWidth: 400,
      viewportHeight: 800,
      currentScale: 2.5,
      currentTranslateX: 100,
      currentTranslateY: 0,
      zoomInScale: 2.5,
      zoomOutThreshold: 1.02,
    });

    assert.equal(zoomOut.zoomingIn, false);
    assert.equal(zoomOut.scale, 1);
    assert.equal(zoomOut.translateX, 0);
  });
});
