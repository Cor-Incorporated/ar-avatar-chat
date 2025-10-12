/**
 * Load VRM Animation Helper
 * 
 * @description
 * VRMAファイルを読み込み、VRMAnimationオブジェクトを返すヘルパー関数。
 * 
 * @example
 * const vrmAnimation = await loadVRMAnimation('./animation.vrma');
 * const clip = vrmAnimation.createAnimationClip(vrm);
 * 
 * @author Based on fbx2vrma-converter-ui by tegnike
 * @see https://github.com/tegnike/fbx2vrma-converter-ui
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin.js';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

/**
 * VRMAファイルを読み込む
 * 
 * @async
 * @param {string} url - VRMAファイルのURL
 * @returns {VRMAnimation|null} VRMAnimationオブジェクト、失敗時はnull
 * 
 * @description
 * GLTFLoaderとVRMAnimationLoaderPluginを使用してVRMAファイルを読み込み、
 * humanoidボーンマッピング情報を含むVRMAnimationオブジェクトを返す。
 */
export async function loadVRMAnimation(url) {
  try {
    const gltf = await loader.loadAsync(url);
    
    const vrmAnimations = gltf.userData.vrmAnimations;
    const vrmAnimation = vrmAnimations ? vrmAnimations[0] : undefined;
    
    return vrmAnimation || null;
  } catch (error) {
    console.error('[VRMAnimation] Failed to load:', error);
    throw error;
  }
}

