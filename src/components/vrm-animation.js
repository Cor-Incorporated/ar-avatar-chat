// src/components/vrm-animation.js
// A-FrameのTHREEインスタンスを使用（複数インスタンス問題を回避）
const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

AFRAME.registerComponent('vrm-animation', {
  schema: {
    src: { type: 'string', default: '' },
    autoplay: { type: 'boolean', default: true },
    loop: { type: 'boolean', default: false }
  },

  init: function() {
    this.mixer = null;
    this.action = null;
    this.scene = null;
    this.ready = false; // アニメーション準備完了フラグ
    this.pendingPlay = false; // 再生待機フラグ

    // VRMロード完了を待つ
    this.el.addEventListener('vrm-loaded', (e) => {
      this.vrm = e.detail.vrm;
      this.scene = e.detail.scene;
      this.loadAnimation();
    });
  },

  // A-Frameのplayイベントをオーバーライド（何もしない）
  play: function() {
    // 何もしない - playAnimationメソッドを使用
  },

  // A-Frameのpauseイベントをオーバーライド（何もしない）
  pause: function() {
    // 何もしない
  },

  loadAnimation: async function() {
    if (!this.data.src) return;

    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(this.data.src);

      if (!this.scene) {
        console.error('VRMシーンが見つかりません');
        return;
      }

      // AnimationMixer作成
      this.mixer = new THREE.AnimationMixer(this.scene);

      // アニメーションクリップ取得
      if (gltf.animations && gltf.animations.length > 0) {
        this.action = this.mixer.clipAction(gltf.animations[0]);
        this.action.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        this.action.clampWhenFinished = true; // アニメーション終了時に最後のフレームで停止

        if (this.data.autoplay) {
          this.action.play();
        }

        this.ready = true; // 準備完了フラグを立てる

        // 待機中の再生リクエストがあれば実行
        if (this.pendingPlay) {
          this.playAnimation();
        }
      } else {
        console.warn('アニメーションクリップが見つかりません');
      }

    } catch (error) {
      console.error('アニメーションロードエラー:', error);
    }
  },

  tick: function(time, deltaTime) {
    // AnimationMixerの更新
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000);
    }
  },

  // 外部から呼び出せる再生関数（マーカー検出時に使用）
  playAnimation: function() {
    if (!this.ready) {
      this.pendingPlay = true;
      return;
    }

    if (this.action) {
      this.action.reset().play();
      this.pendingPlay = false;
    } else {
      console.error('AnimationActionが存在しません');
    }
  }
});
