/**
 * VRMAnimation Class
 * 
 * @description
 * VRMAファイルのhumanoidボーンマッピングを使用して、
 * VRMモデルに適合したAnimationClipを生成するクラス。
 * 
 * ボーン命名規則に依存しない自動リターゲティングの核心実装。
 * 
 * @author Based on fbx2vrma-converter-ui by tegnike
 * @see https://github.com/tegnike/fbx2vrma-converter-ui
 */

import * as THREE from 'three';

export class VRMAnimation {
  constructor() {
    this.duration = 0.0;
    this.restHipsPosition = new THREE.Vector3();
    
    // humanoidトラック: ボーン名 → AnimationTrack
    this.humanoidTracks = {
      translation: new Map(),
      rotation: new Map(),
    };
    
    // 表情トラック: 表情名 → AnimationTrack
    this.expressionTracks = new Map();
    
    // 視線トラック
    this.lookAtTrack = null;
  }
  
  /**
   * VRMモデルに適合したAnimationClipを生成
   * 
   * @param {VRM} vrm - 対象のVRMインスタンス
   * @returns {THREE.AnimationClip} リターゲティング済みのAnimationClip
   * 
   * @description
   * humanoidボーンマッピングを使用して、VRMAファイルのアニメーションを
   * VRMモデルのボーン構造に適合させる。
   * これにより、mixamorig:Hips → J_Bip_C_Hipsのような変換が自動で行われる。
   */
  createAnimationClip(vrm) {
    const tracks = [];
    
    // humanoidトラックの生成
    tracks.push(...this.createHumanoidTracks(vrm));
    
    // 表情トラックの生成
    if (vrm.expressionManager != null) {
      tracks.push(...this.createExpressionTracks(vrm.expressionManager));
    }
    
    // 視線トラックの生成
    if (vrm.lookAt != null) {
      const track = this.createLookAtTrack('lookAtTargetParent.quaternion');
      
      if (track != null) {
        tracks.push(track);
      }
    }
    
    return new THREE.AnimationClip('Clip', this.duration, tracks);
  }
  
  /**
   * humanoidボーントラックの生成
   * 
   * @private
   * @param {VRM} vrm - VRMインスタンス
   * @returns {Array<THREE.KeyframeTrack>} トラック配列
   * 
   * @description
   * VRMモデルのhumanoidボーン構造に基づいてトラックを生成。
   * ボーン名のマッピングとスケール調整を自動で行う。
   */
  createHumanoidTracks(vrm) {
    const humanoid = vrm.humanoid;
    const metaVersion = vrm.meta.metaVersion;
    const tracks = [];
    
    // 回転トラックの生成
    for (const [name, origTrack] of this.humanoidTracks.rotation.entries()) {
      const nodeName = humanoid.getNormalizedBoneNode(name)?.name;
      
      if (nodeName != null) {
        const track = new THREE.VectorKeyframeTrack(
          `${nodeName}.quaternion`,
          origTrack.times,
          origTrack.values.map((v, i) =>
            metaVersion === '0' && i % 2 === 0 ? -v : v
          )
        );
        tracks.push(track);
      }
    }
    
    // 移動トラックの生成
    for (const [name, origTrack] of this.humanoidTracks.translation.entries()) {
      const nodeName = humanoid.getNormalizedBoneNode(name)?.name;
      
      if (nodeName != null) {
        const animationY = this.restHipsPosition.y;
        const humanoidY = humanoid.getNormalizedAbsolutePose().hips.position[1];
        const scale = humanoidY / animationY;
        
        const track = origTrack.clone();
        track.values = track.values.map(
          (v, i) => (metaVersion === '0' && i % 3 !== 1 ? -v : v) * scale
        );
        track.name = `${nodeName}.position`;
        tracks.push(track);
      }
    }
    
    return tracks;
  }
  
  /**
   * 表情トラックの生成
   * 
   * @private
   * @param {VRMExpressionManager} expressionManager - VRM表情マネージャー
   * @returns {Array<THREE.KeyframeTrack>} トラック配列
   */
  createExpressionTracks(expressionManager) {
    const tracks = [];
    
    for (const [name, origTrack] of this.expressionTracks.entries()) {
      const trackName = expressionManager.getExpressionTrackName(name);
      
      if (trackName != null) {
        const track = origTrack.clone();
        track.name = trackName;
        tracks.push(track);
      }
    }
    
    return tracks;
  }
  
  /**
   * 視線トラックの生成
   * 
   * @private
   * @param {string} trackName - トラック名
   * @returns {THREE.KeyframeTrack|null} 視線トラック
   */
  createLookAtTrack(trackName) {
    if (this.lookAtTrack == null) {
      return null;
    }
    
    const track = this.lookAtTrack.clone();
    track.name = trackName;
    return track;
  }
}

