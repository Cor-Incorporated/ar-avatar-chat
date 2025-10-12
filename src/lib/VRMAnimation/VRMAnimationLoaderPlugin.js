/**
 * VRM Animation Loader Plugin
 * 
 * @description
 * GLTFLoaderのプラグインとして動作し、VRMC_vrm_animation拡張を解析。
 * humanoidボーンマッピングを活用したリターゲティング処理を実行。
 * 
 * これにより、ボーン命名規則に依存しないVRMアニメーション読み込みが可能となる。
 * 
 * @architecture
 * GLTFLoaderPluginインターフェースに準拠：
 * - name: プラグイン名を返す
 * - afterRoot: GLTF読み込み後の処理
 * 
 * @example
 * const loader = new GLTFLoader();
 * loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
 * const gltf = await loader.loadAsync('animation.vrma');
 * const vrmAnimation = gltf.userData.vrmAnimations[0];
 * 
 * @author Based on fbx2vrma-converter-ui by tegnike
 * @see https://github.com/tegnike/fbx2vrma-converter-ui
 */

import * as THREE from 'three';
import { arrayChunk } from '../utils/arrayChunk.js';
import { VRMAnimation } from './VRMAnimation.js';

const MAT4_IDENTITY = new THREE.Matrix4();

const _v3A = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _quatC = new THREE.Quaternion();

/**
 * VRM Humanoid Bone Parent Map
 * 
 * @description
 * humanoidボーンの親子関係を定義。
 * リターゲティング時のワールド座標変換に使用。
 */
const VRMHumanBoneParentMap = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  upperChest: 'chest',
  neck: 'upperChest',
  head: 'neck',
  leftShoulder: 'upperChest',
  leftUpperArm: 'leftShoulder',
  leftLowerArm: 'leftUpperArm',
  leftHand: 'leftLowerArm',
  rightShoulder: 'upperChest',
  rightUpperArm: 'rightShoulder',
  rightLowerArm: 'rightUpperArm',
  rightHand: 'rightLowerArm',
  leftUpperLeg: 'hips',
  leftLowerLeg: 'leftUpperLeg',
  leftFoot: 'leftLowerLeg',
  leftToes: 'leftFoot',
  rightUpperLeg: 'hips',
  rightLowerLeg: 'rightUpperLeg',
  rightFoot: 'rightLowerLeg',
  rightToes: 'rightFoot'
};

export class VRMAnimationLoaderPlugin {
  constructor(parser, options) {
    this.parser = parser;
    this.options = options || {};
  }
  
  get name() {
    return 'VRMC_vrm_animation';
  }
  
  /**
   * GLTF読み込み後の処理
   * 
   * @param {GLTF} gltf - 読み込まれたGLTFオブジェクト
   * 
   * @description
   * VRMC_vrm_animation拡張を解析し、humanoidボーンマッピングを使用して
   * リターゲティング処理を実行。結果をgltf.userData.vrmAnimationsに格納。
   */
  async afterRoot(gltf) {
    const defGltf = gltf.parser.json;
    const defExtensionsUsed = defGltf.extensionsUsed;
    
    // VRMC_vrm_animation拡張が使用されているか確認
    if (
      defExtensionsUsed == null ||
      defExtensionsUsed.indexOf(this.name) === -1
    ) {
      return;
    }
    
    const defExtension = defGltf.extensions?.[this.name];
    
    if (defExtension == null) {
      return;
    }
    
    // ノードマップの作成
    const nodeMap = this._createNodeMap(defExtension);
    
    // ボーンのワールド行列マップの作成
    const worldMatrixMap = await this._createBoneWorldMatrixMap(
      gltf,
      defExtension
    );
    
    // Hipsの初期位置を取得
    const hipsNode = defExtension.humanoid.humanBones['hips'].node;
    const hips = await gltf.parser.getDependency('node', hipsNode);
    const restHipsPosition = hips.getWorldPosition(new THREE.Vector3());
    
    // 各アニメーションクリップをVRMAnimationに変換
    const clips = gltf.animations;
    const animations = clips.map((clip, iAnimation) => {
      const defAnimation = defGltf.animations[iAnimation];
      
      const animation = this._parseAnimation(
        clip,
        defAnimation,
        nodeMap,
        worldMatrixMap
      );
      animation.restHipsPosition = restHipsPosition;
      
      return animation;
    });
    
    // 結果を保存
    gltf.userData.vrmAnimations = animations;
  }
  
  /**
   * ノードマップの作成
   * 
   * @private
   * @param {Object} defExtension - VRMC_vrm_animation拡張定義
   * @returns {Object} ノードインデックスからボーン名/表情名へのマップ
   */
  _createNodeMap(defExtension) {
    const humanoidIndexToName = new Map();
    const expressionsIndexToName = new Map();
    let lookAtIndex = null;
    
    // humanoidボーンマップ
    const humanBones = defExtension.humanoid?.humanBones;
    
    if (humanBones) {
      Object.entries(humanBones).forEach(([name, bone]) => {
        const { node } = bone;
        humanoidIndexToName.set(node, name);
      });
    }
    
    // 表情マップ（プリセット）
    const preset = defExtension.expressions?.preset;
    
    if (preset) {
      Object.entries(preset).forEach(([name, expression]) => {
        const { node } = expression;
        expressionsIndexToName.set(node, name);
      });
    }
    
    // 表情マップ（カスタム）
    const custom = defExtension.expressions?.custom;
    
    if (custom) {
      Object.entries(custom).forEach(([name, expression]) => {
        const { node } = expression;
        expressionsIndexToName.set(node, name);
      });
    }
    
    // 視線インデックス
    lookAtIndex = defExtension.lookAt?.node ?? null;
    
    return { humanoidIndexToName, expressionsIndexToName, lookAtIndex };
  }
  
  /**
   * ボーンワールド行列マップの作成
   * 
   * @private
   * @param {GLTF} gltf - GLTFオブジェクト
   * @param {Object} defExtension - VRMC_vrm_animation拡張定義
   * @returns {Map} ボーン名 → ワールド行列のマップ
   */
  async _createBoneWorldMatrixMap(gltf, defExtension) {
    // ワールド行列を更新
    gltf.scene.updateWorldMatrix(false, true);
    
    const threeNodes = await gltf.parser.getDependencies('node');
    const worldMatrixMap = new Map();
    
    for (const [boneName, { node }] of Object.entries(
      defExtension.humanoid.humanBones
    )) {
      const threeNode = threeNodes[node];
      worldMatrixMap.set(boneName, threeNode.matrixWorld);
      
      if (boneName === 'hips') {
        worldMatrixMap.set(
          'hipsParent',
          threeNode.parent?.matrixWorld ?? MAT4_IDENTITY
        );
      }
    }
    
    return worldMatrixMap;
  }
  
  /**
   * アニメーションの解析とリターゲティング
   * 
   * @private
   * @param {THREE.AnimationClip} animationClip - GLTFアニメーションクリップ
   * @param {Object} defAnimation - GLTF animation定義
   * @param {Object} nodeMap - ノードマップ
   * @param {Map} worldMatrixMap - ワールド行列マップ
   * @returns {VRMAnimation} リターゲティング済みVRMAnimation
   * 
   * @description
   * 【重要】ここでリターゲティングの魔法が起こる：
   * 1. 元のアニメーショントラックからボーン情報を取得
   * 2. humanoidボーンマッピングでボーン名を解決
   * 3. ワールド座標変換を適用
   * 4. VRMモデルのボーン構造に適合したトラックを生成
   */
  _parseAnimation(animationClip, defAnimation, nodeMap, worldMatrixMap) {
    const tracks = animationClip.tracks;
    const defChannels = defAnimation.channels;
    
    const result = new VRMAnimation();
    result.duration = animationClip.duration;
    
    defChannels.forEach((channel, iChannel) => {
      const { node, path } = channel.target;
      const origTrack = tracks[iChannel];
      
      if (node == null) {
        return;
      }
      
      // === humanoidボーントラックの処理 ===
      const boneName = nodeMap.humanoidIndexToName.get(node);
      if (boneName != null) {
        // 親ボーンの検索
        let parentBoneName = VRMHumanBoneParentMap[boneName];
        while (
          parentBoneName != null &&
          worldMatrixMap.get(parentBoneName) == null
        ) {
          parentBoneName = VRMHumanBoneParentMap[parentBoneName];
        }
        parentBoneName = parentBoneName || 'hipsParent';
        
        if (path === 'translation') {
          // 位置アニメーション: ワールド座標変換を適用
          const hipsParentWorldMatrix = worldMatrixMap.get('hipsParent');
          
          const trackValues = arrayChunk(origTrack.values, 3).flatMap((v) =>
            _v3A.fromArray(v).applyMatrix4(hipsParentWorldMatrix).toArray()
          );
          
          const track = origTrack.clone();
          track.values = new Float32Array(trackValues);
          
          result.humanoidTracks.translation.set(boneName, track);
          
        } else if (path === 'rotation') {
          // 回転アニメーション: クォータニオン変換を適用
          // 式: a' = p * a * c^-1 * p^-1
          // p: 親のワールド回転, c: 自身のワールド回転
          
          const worldMatrix = worldMatrixMap.get(boneName);
          const parentWorldMatrix = worldMatrixMap.get(parentBoneName);
          
          _quatA.setFromRotationMatrix(worldMatrix).normalize().invert();
          _quatB.setFromRotationMatrix(parentWorldMatrix).normalize();
          
          const trackValues = arrayChunk(origTrack.values, 4).flatMap((q) =>
            _quatC
              .fromArray(q)
              .premultiply(_quatB)
              .multiply(_quatA)
              .toArray()
          );
          
          const track = origTrack.clone();
          track.values = new Float32Array(trackValues);
          
          result.humanoidTracks.rotation.set(boneName, track);
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
        return;
      }
      
      // === 表情トラックの処理 ===
      const expressionName = nodeMap.expressionsIndexToName.get(node);
      if (expressionName != null) {
        if (path === 'translation') {
          // 表情の重みはX座標から取得
          const times = origTrack.times;
          const values = new Float32Array(origTrack.values.length / 3);
          for (let i = 0; i < values.length; i++) {
            values[i] = origTrack.values[3 * i];
          }
          
          const newTrack = new THREE.NumberKeyframeTrack(
            `${expressionName}.weight`,
            times,
            values
          );
          result.expressionTracks.set(expressionName, newTrack);
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
        return;
      }
      
      // === 視線トラックの処理 ===
      if (node === nodeMap.lookAtIndex) {
        if (path === 'rotation') {
          result.lookAtTrack = origTrack;
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
      }
    });
    
    return result;
  }
}

