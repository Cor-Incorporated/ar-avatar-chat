import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Clock,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  ArMarkerControls,
  ArToolkitContext,
  ArToolkitSource,
} from '@ar-js-org/ar.js/three.js/build/ar-threex.mjs';
import { AvatarController } from './AvatarController.js';
import { clampFrameDelta, coverProjectionScale, detectARSourceOrientation, isObjectSafelyInCameraView, normalizeViewportOffset, shouldDeferViewportResize } from './runtimeMath.js';

export class ARRuntime extends EventTarget {
  readonly avatar = new AvatarController();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  private readonly markerRoot = new Scene();
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock(false);
  private source: ArToolkitSource | null = null;
  private context: ArToolkitContext | null = null;
  private markerControls: ArMarkerControls | null = null;
  private frame = 0;
  private disposed = false;
  private lastMarkerVisible = false;
  private cameraParametersUrl: string | null = null;
  private keyboardOverlayActive = false;
  private avatarPoseSafe = false;
  private safetyCheckCountdown = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    super();
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.add(this.camera, this.markerRoot);
    this.markerRoot.visible = false;
    this.markerRoot.add(this.avatar.root);
    this.scene.add(new AmbientLight(0xffffff, 1));
    const key = new DirectionalLight(0xffffff, 0.8);
    key.position.set(1, 2, 1);
    this.scene.add(key);
    window.addEventListener('ar-keyboard-overlay-change', this.handleKeyboardOverlayChange);
    window.visualViewport?.addEventListener('resize', this.syncVisualViewportOffset);
    window.visualViewport?.addEventListener('scroll', this.syncVisualViewportOffset);
  }

  async start(): Promise<void> {
    await this.initializeTracking();
    await this.avatar.load();
    this.clock.start();
    this.frame = requestAnimationFrame(this.renderFrame);
  }

  private async initializeTracking(): Promise<void> {
    // AR.js' npm package omits this calibration file. Bundle the official 3.4.8
    // payload so production startup does not depend on a third-party CDN.
    const calibration = Uint8Array.from(
      atob('AAACgAAAAeBAgwrsW6bUSwAAAAAAAAAAQHQ3KqAAAAAAAAAAAAAAAAAAAAAAAAAAQIL0K3dHyf9AbbNowAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAA/uWNa4AAAAL+3lTLAAAAAv17YFWAAAAA/VYLXIAAAAECCe0YgAAAAQIJlMOAAAABAdDcqoAAAAEBts2jAAAAAP+8OmzqkDy4='),
      (character) => character.charCodeAt(0),
    );
    this.cameraParametersUrl = URL.createObjectURL(new Blob([calibration]));
    this.source = new ArToolkitSource({
      sourceType: 'webcam',
      sourceWidth: 1280,
      sourceHeight: 960,
      displayWidth: 1280,
      displayHeight: 960,
    });
    this.context = new ArToolkitContext({
      cameraParametersUrl: this.cameraParametersUrl,
      detectionMode: 'mono',
      labelingMode: 'black_region',
      patternRatio: 0.8,
      maxDetectionRate: 60,
      canvasWidth: 1280,
      canvasHeight: 960,
    });

    const source = this.source;
    const context = this.context;
    await this.initializeSource(source);
    if (this.disposed || this.source !== source) {
      throw new Error('AR.js camera source was disposed before becoming ready');
    }
    await this.waitForCameraFrame(source.domElement);
    document.querySelector('#ar-stage')?.prepend(source.domElement);
    await this.initializeContext(context);
    if (this.disposed || this.context !== context || this.source !== source) {
      throw new Error('AR.js initialization was interrupted');
    }

    this.camera.projectionMatrix.copy(context.getProjectionMatrix());
    this.markerControls = new ArMarkerControls(context, this.markerRoot, {
      type: 'pattern',
      patternUrl: new URL('../assets/markers/penguin-marker.patt', import.meta.url).href,
      changeMatrixMode: 'modelViewMatrix',
      size: 1,
      minConfidence: 0.35,
    });
    if (new URLSearchParams(location.search).get('debug') === 'true') {
      const markerProbe = new Mesh(
        new BoxGeometry(0.2, 0.2, 0.2),
        new MeshBasicMaterial({ color: 0xff00ff, wireframe: true }),
      );
      markerProbe.name = 'ar-debug-marker-probe';
      markerProbe.position.y = 0.1;
      this.markerRoot.add(markerProbe);
    }
    this.resize();
    window.addEventListener('resize', this.handleViewportResize);
    window.addEventListener('orientationchange', this.handleViewportResize);
    this.dispatchEvent(new Event('cameraready'));
  }

  private initializeSource(source: ArToolkitSource): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        source.init(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private initializeContext(context: ArToolkitContext): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        context.init(resolve);
      } catch (error) {
        reject(error);
      }
    });
  }

  private waitForCameraFrame(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Camera stream did not produce a video frame within 8 seconds'));
      }, timeoutMs);
      const check = () => {
        if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
        cleanup();
        resolve();
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadeddata', check);
        video.removeEventListener('canplay', check);
      };
      video.addEventListener('loadeddata', check);
      video.addEventListener('canplay', check);
      void video.play().catch(() => undefined);
    });
  }

  private resize = (): void => {
    if (!this.source?.ready) return;
    this.source.onResizeElement();
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    document.documentElement.style.setProperty('--ar-layout-width', `${width}px`);
    document.documentElement.style.setProperty('--ar-layout-height', `${height}px`);
    this.renderer.setSize(width, height, false);
    const controller = this.context?.arController;
    if (this.context && controller && this.source.domElement.videoWidth > 0) {
      const rendered = this.source.domElement.getBoundingClientRect();
      const orientation = detectARSourceOrientation(rendered.width, rendered.height);
      controller.orientation = orientation;
      controller.options ??= {};
      controller.options.orientation = orientation;
      // Start from ARToolkit's current calibrated camera matrix, then apply
      // only the cover crop required to map its 4:3 camera plane onto the
      // fixed viewport. Both axes remain uniformly represented in pixels.
      this.camera.projectionMatrix.fromArray(controller.getCameraMatrix());
      const correction = coverProjectionScale(
        this.source.domElement.videoWidth,
        this.source.domElement.videoHeight,
        width,
        height,
      );
      this.camera.projectionMatrix.elements[0] *= correction.x;
      this.camera.projectionMatrix.elements[5] *= correction.y;
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }
    if (controller) {
      this.source.copyElementSizeTo(controller.canvas);
    }
    if (new URLSearchParams(location.search).get('debug') === 'true') {
      console.debug('[AR diagnostics]', {
        viewport: { width, height },
        video: {
          intrinsicWidth: this.source.domElement.videoWidth,
          intrinsicHeight: this.source.domElement.videoHeight,
          renderedWidth: this.source.domElement.getBoundingClientRect().width,
          renderedHeight: this.source.domElement.getBoundingClientRect().height,
        },
        canvas: { width: this.canvas.width, height: this.canvas.height },
        projection: {
          x: this.camera.projectionMatrix.elements[0],
          y: this.camera.projectionMatrix.elements[5],
        },
        orientation: controller?.orientation,
      });
    }
  };

  private handleViewportResize = (): void => {
    // iOS Safari emits window.resize while the software keyboard changes the
    // visual viewport. The AR video remains fixed, so resizing the renderer
    // and projection here would narrow the camera angle and distort alignment.
    if (shouldDeferViewportResize(this.keyboardOverlayActive)) return;
    this.resize();
  };

  private handleKeyboardOverlayChange = (event: Event): void => {
    const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
    const wasActive = this.keyboardOverlayActive;
    this.keyboardOverlayActive = active;
    this.syncVisualViewportOffset();
    if (wasActive && !active) {
      // Reconcile once after Safari has restored its layout viewport.
      requestAnimationFrame(() => {
        if (!this.disposed) this.resize();
      });
    }
  };

  private syncVisualViewportOffset = (): void => {
    const viewport = window.visualViewport;
    const x = this.keyboardOverlayActive ? normalizeViewportOffset(viewport?.offsetLeft ?? 0) : 0;
    const y = this.keyboardOverlayActive ? normalizeViewportOffset(viewport?.offsetTop ?? 0) : 0;
    document.documentElement.style.setProperty('--ar-vv-offset-x', `${x}px`);
    document.documentElement.style.setProperty('--ar-vv-offset-y', `${y}px`);
  };

  private renderFrame = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.renderFrame);
    const delta = clampFrameDelta(this.clock.getDelta());

    // One owner, one frame: tracking -> mixer/VRM -> render.
    if (this.source?.ready && this.context) this.context.update(this.source.domElement);
    const markerVisible = this.markerRoot.visible;
    if (markerVisible) {
      // MarkerControls owns both the pose matrix and visibility. Keeping the
      // avatar directly below this anchor avoids copying stale/decomposed
      // transforms and gives tracking a single source of truth.
      this.markerRoot.updateMatrixWorld(true);
      if (!this.lastMarkerVisible || this.safetyCheckCountdown <= 0) {
        this.avatar.root.visible = true;
        this.avatarPoseSafe = isObjectSafelyInCameraView(this.avatar.root, this.camera);
        this.safetyCheckCountdown = 6;
      } else {
        this.safetyCheckCountdown -= 1;
      }
      this.avatar.root.visible = this.avatarPoseSafe;
    } else {
      this.avatar.root.visible = true;
      this.avatarPoseSafe = false;
      this.safetyCheckCountdown = 0;
    }
    if (markerVisible && !this.lastMarkerVisible) {
      this.avatar.ensureIdle();
      this.logMarkerDiagnostics();
      this.dispatchEvent(new Event('markerfound'));
    } else if (!markerVisible && this.lastMarkerVisible) {
      this.dispatchEvent(new Event('markerlost'));
    }
    this.lastMarkerVisible = markerVisible;
    this.avatar.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private logMarkerDiagnostics(): void {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(this.avatar.root);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const cameraSpace = center.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const ndc = center.clone().project(this.camera);
    console.info('[AR render diagnostics]', {
      markerMatrix: this.markerRoot.matrix.elements.map((value) => Number(value.toFixed(4))),
      markerScale: this.markerRoot.scale.toArray().map((value) => Number(value.toFixed(4))),
      avatarVisible: this.avatar.root.visible,
      avatarBounds: {
        center: center.toArray().map((value) => Number(value.toFixed(4))),
        size: size.toArray().map((value) => Number(value.toFixed(4))),
      },
      cameraSpace: cameraSpace.toArray().map((value) => Number(value.toFixed(4))),
      ndc: ndc.toArray().map((value) => Number(value.toFixed(4))),
      inClipVolume: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.handleViewportResize);
    window.removeEventListener('orientationchange', this.handleViewportResize);
    window.removeEventListener('ar-keyboard-overlay-change', this.handleKeyboardOverlayChange);
    window.visualViewport?.removeEventListener('resize', this.syncVisualViewportOffset);
    window.visualViewport?.removeEventListener('scroll', this.syncVisualViewportOffset);
    document.documentElement.style.setProperty('--ar-vv-offset-x', '0px');
    document.documentElement.style.setProperty('--ar-vv-offset-y', '0px');
    this.markerControls?.dispose?.();
    this.source?.dispose();
    if (this.cameraParametersUrl) URL.revokeObjectURL(this.cameraParametersUrl);
    this.avatar.dispose();
    this.renderer.dispose();
  }
}
