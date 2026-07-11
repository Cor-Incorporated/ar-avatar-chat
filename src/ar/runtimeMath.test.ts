import { BoxGeometry, Euler, Mesh, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { anchorAvatarToFeet, clampFrameDelta, coverProjectionScale, isCameraPermissionError, MAX_FRAME_DELTA_SECONDS, setUniformScale, shouldDeferViewportResize, snapObjectTransform } from './runtimeMath.js';

describe('AR runtime math', () => {
  it('clamps a resumed-tab frame delta', () => {
    expect(clampFrameDelta(5)).toBe(MAX_FRAME_DELTA_SECONDS);
    expect(clampFrameDelta(1 / 60)).toBeCloseTo(1 / 60);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
  });

  it('only applies isotropic scale', () => {
    const object = new Object3D();
    setUniformScale(object, 0.78);
    expect(object.scale.toArray()).toEqual([0.78, 0.78, 0.78]);
    expect(() => setUniformScale(object, 0)).toThrow(RangeError);
  });

  it('snaps a reacquired marker pose instead of interpolating through the camera origin', () => {
    const marker = new Object3D();
    marker.matrixAutoUpdate = false;
    const expectedPosition = new Vector3(1, 2, -6);
    const expectedRotation = new Quaternion().setFromEuler(new Euler(0.2, 0.4, 0.1));
    const expectedScale = new Vector3(1.25, 1.25, 1.25);
    marker.matrix.compose(expectedPosition, expectedRotation, expectedScale);
    const smoothed = new Object3D();

    snapObjectTransform(smoothed, marker);

    expect(marker.position.toArray()).toEqual([0, 0, 0]);
    expect(smoothed.position.toArray()).toEqual(expectedPosition.toArray());
    expect(smoothed.quaternion.angleTo(expectedRotation)).toBeCloseTo(0);
    expect(smoothed.scale.toArray()).toEqual([1.25, 1.25, 1.25]);
  });

  it('corrects camera projection for cover cropping without stretching', () => {
    expect(coverProjectionScale(1280, 960, 390, 844)).toEqual({ x: (4 / 3) / (390 / 844), y: 1 });
    expect(coverProjectionScale(1280, 960, 844, 390)).toEqual({ x: 1, y: (844 / 390) / (4 / 3) });
  });

  it('keeps the AR renderer fixed while the iOS keyboard owns the visual viewport', () => {
    expect(shouldDeferViewportResize(true)).toBe(true);
    expect(shouldDeferViewportResize(false)).toBe(false);
  });

  it('classifies camera permission failures by DOMException name before message fallback', () => {
    expect(isCameraPermissionError(new DOMException('localized message', 'NotAllowedError'))).toBe(true);
    expect(isCameraPermissionError(new DOMException('localized message', 'SecurityError'))).toBe(true);
    expect(isCameraPermissionError(new Error('Permission denied by browser'))).toBe(true);
    expect(isCameraPermissionError(new DOMException('device unavailable', 'NotFoundError'))).toBe(false);
  });

  it('centers X/Z and places the feet on the marker plane', () => {
    const object = new Object3D();
    const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial());
    mesh.position.set(3, 4, -2);
    object.add(mesh);
    anchorAvatarToFeet(object);
    object.updateWorldMatrix(true, true);
    expect(object.position.toArray()).toEqual([-3, -2, 2]);
  });
});
