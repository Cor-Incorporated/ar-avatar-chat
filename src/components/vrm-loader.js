// src/components/vrm-loader.js
// A-FrameのTHREEインスタンスを使用（複数インスタンス問題を回避）
const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

AFRAME.registerComponent('vrm-loader', {
  schema: {
    src: { type: 'string', default: '' }
  },

  init: async function() {
    const scene = this.el.sceneEl.object3D;
    const loader = new GLTFLoader();

    // VRMプラグイン登録
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(this.data.src);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('VRMデータが見つかりません');
      }

      // スケルトン結合（パフォーマンス最適化）
      // Phase 7: removeUnnecessaryJointsは非推奨、combineSkeletonsを使用
      VRMUtils.combineSkeletons(gltf.scene);

      // Three.js複数インスタンス問題の回避：
      // setObject3Dの代わりに直接object3Dに追加
      this.el.object3D.add(gltf.scene);

      // 初期位置・サイズ調整
      gltf.scene.position.set(0, 0, 0);
      gltf.scene.scale.set(1.0, 1.0, 1.0);

      // VRMの原点はモデルごとにずれるため、x/zはbbox中心、yは足元(box.min.y)をマーカー原点に合わせる。
      // 胴体中心合わせだと足元がマーカー面下に沈むため、足元アンカーで接地させる。
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      if (Number.isFinite(center.x) && Number.isFinite(center.z)) {
        gltf.scene.position.x -= center.x;
        gltf.scene.position.z -= center.z;
      }
      if (Number.isFinite(box.min.y)) {
        gltf.scene.position.y -= box.min.y;
      }

      // VRMオブジェクトを保存（後でアニメーションで使用）
      this.vrm = vrm;
      this.scene = gltf.scene;

      this.el.emit('vrm-loaded', { vrm: vrm, scene: gltf.scene });

    } catch (error) {
      console.error('VRMロードエラー:', error);
      this.el.emit('vrm-load-error', { error });
      document.querySelector('#status').textContent = 'VRMロード失敗: ' + error.message;
    }
  },

  tick: function(time, deltaTime) {
    // VRMの更新（three-vrm必須）
    if (this.vrm) {
      this.vrm.update(deltaTime / 1000);
    }
  }
});
