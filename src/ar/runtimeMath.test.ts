import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { anchorAvatarToFeet, anchorObjectToWorldPoints, clampFrameDelta, coverProjectionScale, detectARSourceOrientation, isCameraPermissionError, isObjectSafelyInCameraView, MAX_FRAME_DELTA_SECONDS, normalizeViewportOffset, setUniformScale, shouldDeferViewportResize } from './runtimeMath.js';

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

  it('corrects camera projection for cover cropping without stretching', () => {
    expect(coverProjectionScale(1280, 960, 390, 844)).toEqual({ x: (4 / 3) / (390 / 844), y: 1 });
    expect(coverProjectionScale(1280, 960, 844, 390)).toEqual({ x: 1, y: (844 / 390) / (4 / 3) });
  });

  it('keeps the AR renderer fixed while the iOS keyboard owns the visual viewport', () => {
    expect(shouldDeferViewportResize(true)).toBe(true);
    expect(shouldDeferViewportResize(false)).toBe(false);
  });

  it('sanitizes visual viewport pan offsets', () => {
    expect(normalizeViewportOffset(24.5)).toBe(24.5);
    expect(normalizeViewportOffset(-2)).toBe(0);
    expect(normalizeViewportOffset(Number.NaN)).toBe(0);
  });

  it('reports the rendered camera orientation used by ARToolkit', () => {
    expect(detectARSourceOrientation(390, 844)).toBe('portrait');
    expect(detectARSourceOrientation(844, 390)).toBe('landscape');
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

  it('anchors scaled humanoid feet using parent-space world positions', () => {
    const avatar = new Object3D();
    avatar.scale.setScalar(0.5);
    anchorObjectToWorldPoints(avatar, [new Vector3(-0.2, 0.1, 0.05), new Vector3(0.2, 0.1, 0.05)]);
    expect(avatar.position.toArray()).toEqual([0, -0.1, -0.05]);
  });

  it('rejects an avatar that is behind, too close to, or outside the camera', () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.updateProjectionMatrix();
    const avatar = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    avatar.position.z = -3;
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(true);
    avatar.position.z = -0.1;
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(false);
    avatar.position.z = 2;
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(false);
    avatar.position.set(100, 0, -3);
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(false);
  });
});
