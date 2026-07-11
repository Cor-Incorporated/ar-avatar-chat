import {
  AmbientLight,
  Clock,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  ArMarkerControls,
  ArSmoothedControls,
  ArToolkitContext,
  ArToolkitSource,
} from '@ar-js-org/ar.js/three.js/build/ar-threex.mjs';
import { AvatarController } from './AvatarController.js';
import { clampFrameDelta, coverProjectionScale, isChatInputActive, shouldKeepAvatarVisible } from './runtimeMath.js';

export class ARRuntime extends EventTarget {
  readonly avatar = new AvatarController();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  private readonly markerRoot = new Scene();
  private readonly smoothedRoot = new Scene();
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock(false);
  private source: ArToolkitSource | null = null;
  private context: ArToolkitContext | null = null;
  private markerControls: ArMarkerControls | null = null;
  private smoothedControls: ArSmoothedControls | null = null;
  private frame = 0;
  private disposed = false;
  private lastMarkerVisible = false;
  private hasTrackedPose = false;
  private markerGraceUntil = 0;
  private cameraParametersUrl: string | null = null;
  private keyboardOverlayActive = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    super();
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.add(this.camera, this.markerRoot, this.smoothedRoot);
    this.markerRoot.visible = false;
    this.smoothedRoot.visible = false;
    this.smoothedRoot.add(this.avatar.root);
    this.scene.add(new AmbientLight(0xffffff, 1));
    const key = new DirectionalLight(0xffffff, 0.8);
    key.position.set(1, 2, 1);
    this.scene.add(key);
    window.addEventListener('ar-keyboard-overlay-change', this.handleKeyboardOverlayChange);
  }

  private handleKeyboardOverlayChange = (event: Event): void => {
    this.keyboardOverlayActive = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
  };

  async start(): Promise<void> {
    await this.initializeTracking();
    await this.avatar.load();
    this.clock.start();
    this.frame = requestAnimationFrame(this.renderFrame);
  }

  private initializeTracking(): Promise<void> {
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

    return new Promise((resolve, reject) => {
      this.source?.init(() => {
        if (!this.source) return reject(new Error('AR.js camera source was disposed before becoming ready'));
        this.waitForCameraFrame(this.source.domElement).then(() => this.context?.init(() => {
          if (!this.context || !this.source) return reject(new Error('AR.js initialization was interrupted'));
          this.camera.projectionMatrix.copy(this.context.getProjectionMatrix());
          this.markerControls = new ArMarkerControls(this.context, this.markerRoot, {
            type: 'pattern',
            patternUrl: new URL('../assets/markers/penguin-marker.patt', import.meta.url).href,
            changeMatrixMode: 'modelViewMatrix',
            size: 1,
            minConfidence: 0.35,
          });
          this.smoothedControls = new ArSmoothedControls(this.smoothedRoot, {
            lerpPosition: 0.45,
            lerpQuaternion: 0.35,
            lerpScale: 0.6,
          });
          this.resize();
          window.addEventListener('resize', this.resize);
          window.addEventListener('orientationchange', this.resize);
          this.dispatchEvent(new Event('cameraready'));
          resolve();
        }), reject);
      }, reject);
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
    this.renderer.setSize(width, height, false);
    if (this.context && this.source.domElement.videoWidth > 0) {
      this.camera.projectionMatrix.copy(this.context.getProjectionMatrix());
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
    if (this.context?.arController) {
      this.source.copyElementSizeTo(this.context.arController.canvas);
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
      });
    }
  };

  private renderFrame = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.renderFrame);
    const delta = clampFrameDelta(this.clock.getDelta());

    // One owner, one frame: tracking -> mixer/VRM -> render.
    if (this.source?.ready && this.context) this.context.update(this.source.domElement);
    const markerVisible = this.markerRoot.visible;
    if (markerVisible) {
      this.hasTrackedPose = true;
      this.smoothedControls?.update(this.markerRoot);
      this.smoothedRoot.visible = true;
      this.markerGraceUntil = performance.now() + 2500;
    } else {
      const keyboardActive = isChatInputActive(document.activeElement, this.keyboardOverlayActive);
      this.smoothedRoot.visible = shouldKeepAvatarVisible(
        this.hasTrackedPose,
        false,
        this.markerGraceUntil,
        performance.now(),
        keyboardActive,
      );
    }
    if (markerVisible && !this.lastMarkerVisible) {
      this.avatar.ensureIdle();
      this.dispatchEvent(new Event('markerfound'));
    } else if (!markerVisible && this.lastMarkerVisible) {
      this.dispatchEvent(new Event('markerlost'));
    }
    this.lastMarkerVisible = markerVisible;
    this.avatar.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    window.removeEventListener('ar-keyboard-overlay-change', this.handleKeyboardOverlayChange);
    this.markerControls?.dispose?.();
    this.source?.dispose();
    if (this.cameraParametersUrl) URL.revokeObjectURL(this.cameraParametersUrl);
    this.avatar.dispose();
    this.renderer.dispose();
  }
}
