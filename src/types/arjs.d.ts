declare module '@ar-js-org/ar.js/three.js/build/ar-threex.mjs' {
  import type { Camera, Object3D } from 'three';
  export class ArToolkitSource {
    ready: boolean;
    domElement: HTMLVideoElement;
    constructor(parameters: Record<string, unknown>);
    init(onReady: () => void, onError?: (error: Error) => void): void;
    onResizeElement(): void;
    copyElementSizeTo(element: HTMLElement): void;
    dispose(): void;
  }
  export class ArToolkitContext {
    arController: { canvas: HTMLCanvasElement } | null;
    constructor(parameters: Record<string, unknown>);
    init(onReady: () => void): void;
    update(element: HTMLVideoElement): void;
    getProjectionMatrix(): Camera['projectionMatrix'];
  }
  export class ArMarkerControls {
    constructor(context: ArToolkitContext, object: Object3D, parameters: Record<string, unknown>);
    dispose?(): void;
  }
  export class ArSmoothedControls {
    constructor(object: Object3D, parameters?: Record<string, unknown>);
    update(target: Object3D): void;
  }
}
