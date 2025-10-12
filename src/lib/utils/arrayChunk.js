/**
 * Array Chunk Utility
 * 
 * @description
 * 配列を指定されたサイズのチャンクに分割するユーティリティ関数。
 * VRMアニメーションのトラックデータ処理で使用。
 * 
 * @param {Array} array - 分割する配列
 * @param {number} every - チャンクサイズ
 * @returns {Array<Array>} チャンクの配列
 * 
 * @example
 * arrayChunk([1, 2, 3, 4, 5, 6], 2)
 * // => [[1, 2], [3, 4], [5, 6]]
 * 
 * arrayChunk([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 3)
 * // => [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
 */
export function arrayChunk(array, every) {
  const N = array.length;
  const ret = [];
  let current = [];
  let remaining = 0;
  
  for (let i = 0; i < N; i++) {
    const el = array[i];
    
    if (remaining <= 0) {
      remaining = every;
      current = [];
      ret.push(current);
    }
    
    current.push(el);
    remaining--;
  }
  
  return ret;
}

