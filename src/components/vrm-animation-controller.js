/**
 * VRM Animation Controller Component
 * 
 * @description
 * VRMアバターのアニメーション管理コンポーネント。
 * VRMAファイルのhumanoidボーンマッピングを活用したリターゲティングにより、
 * ボーン命名規則に依存しない柔軟なアニメーション再生を実現。
 * 
 * @features
 * - VRMAnimationLoaderPluginによるVRMAファイルの正しい読み込み
 * - humanoidボーンマッピングを活用した自動リターゲティング
 * - 複数のアニメーション形式のサポート（Mixamo, VRM標準など）
 * - 感情に応じたアニメーション・表情の自動切り替え
 * - メモリリークを防ぐための適切なクリーンアップ処理
 * 
 * @architecture
 * 本実装は以下の設計原則に基づく：
 * 1. Single Responsibility: 各メソッドは単一の責務を持つ
 * 2. Dependency Injection: VRMインスタンスは外部から注入
 * 3. Error Handling: 全ての非同期処理に適切なエラーハンドリング
 * 4. Clean Code: 意図が明確な命名と適切なコメント
 * 
 * @example
 * // A-Frameエンティティに追加
 * <a-entity vrm-loader vrm-animation-controller></a-entity>
 * 
 * // JavaScriptから感情を変更
 * window.playEmotion('happy');
 * 
 * @author Cor.Inc Development Team
 * @version 2.0.0
 * @license ISC
 */

const THREE = AFRAME.THREE;
import { loadVRMAnimation } from '../lib/VRMAnimation/loadVRMAnimation.js';

AFRAME.registerComponent('vrm-animation-controller', {
  schema: {},

  /**
   * 定数定義
   */
  FADE_DURATION: 0.5,              // アニメーション切り替え時のフェード時間（秒）
  LOG_PREFIX: '[Animation]',       // ログのプレフィックス

  /**
   * コンポーネントの初期化
   * アニメーション管理に必要な状態とイベントリスナーを設定
   */
  init: function() {
    // === アニメーション管理の状態 ===
    this.mixer = null;              // Three.js AnimationMixer
    this.actions = {};              // 感情別のAnimationActionマップ
    this.currentAction = null;      // 現在再生中のアクション
    this.vrm = null;               // VRMインスタンス（外部から注入）
    this.vrmAnimations = {};       // ロード済みVRMAnimationマップ
    
    // === 設定 ===
    this.idleEmotion = 'neutral';   // デフォルトのアイドル状態
    this.finishedListener = null;   // アニメーション終了リスナー
    
    // === 感情とアニメーションファイルのマッピング ===
    // 注：この実装により、異なる命名規則のVRMAファイルも使用可能
    // 実証済み: Mixamo (mixamorig:*), VRM標準 (J_Bip_C_*), カスタム (l_*/r_*)
    this.emotionToAnimation = {
      'neutral': './assets/animations/VRMA_01.vrma',    // Mixamo形式（mixamorig:*）
      'happy': './assets/animations/VRMA_02.vrma',        // VRM標準形式（J_Bip_C_*）
      'angry': './assets/animations/VRMA_03.vrma',        // VRM標準形式
      'sad': './assets/animations/VRMA_04.vrma',          // VRM標準形式
      'relaxed': './assets/animations/VRMA_05.vrma',      // VRM標準形式
      'surprised': './assets/animations/VRMA_06.vrma',    // VRM標準形式
      'thinking': './assets/animations/VRMA_07.vrma'      // VRM標準形式
    };

    // === VRMロード完了イベントのリスニング ===
    // VRMローダーからVRMインスタンスを受け取り、アニメーション読み込みを開始
    this.el.addEventListener('vrm-loaded', (e) => {
      this.vrm = e.detail.vrm;
      this.loadAllAnimations();
    });

    // === グローバルAPIの提供 ===
    // 外部（ChatControllerなど）からアニメーションを制御可能に
    window.playEmotion = (emotion) => this.playEmotion(emotion);
  },

  /**
   * 全アニメーションの一括読み込み
   * 
   * @async
   * @description
   * 全ての感情に対応するVRMAファイルを並行読み込みし、
   * humanoidボーンマッピングを使用してリターゲティング処理を実行。
   * これにより、ボーン命名規則に依存しないアニメーション再生が可能となる。
   * 
   * @performance
   * Promise.allSettledを使用し、一部のアニメーションが失敗しても
   * 他のアニメーションの読み込みを継続する。
   */
  async loadAllAnimations() {
    console.log(`${this.LOG_PREFIX} 🎬 全アニメーションの読み込みを開始...`);

    if (!this.vrm) {
      console.error(`${this.LOG_PREFIX} ❌ VRMインスタンスが見つかりません`);
      return;
    }

    // 全アニメーションを並行読み込み（パフォーマンス最適化）
    const loadPromises = Object.entries(this.emotionToAnimation).map(
      ([emotion, path]) => this.loadAnimation(emotion, path)
    );

    // Promise.allSettled: 一部が失敗しても全体を継続
    const results = await Promise.allSettled(loadPromises);
    
    // 結果の集計
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`${this.LOG_PREFIX} ✅ アニメーション読み込み完了: 成功 ${succeeded}/${results.length}`);
    if (failed > 0) {
      console.warn(`${this.LOG_PREFIX} ⚠️ 失敗したアニメーション: ${failed}個`);
    }

    // デフォルトアニメーションの再生
    this.playEmotion(this.idleEmotion);
  },

  /**
   * 個別アニメーションの読み込みとリターゲティング
   * 
   * @async
   * @param {string} emotion - 感情名（'happy', 'sad'など）
   * @param {string} path - VRMAファイルのパス
   * 
   * @description
   * 【重要】本メソッドがボーン命名規則に依存しない柔軟性の核心部分。
   * 
   * three-vrm v2.1.0のVRMAnimation APIを使用してリターゲティングを実現：
   * 1. GLTFLoaderでVRMAファイルを読み込み
   * 2. VRMC_vrm_animation拡張からhumanoidボーンマッピングを取得
   * 3. VRMAnimationクラスでAnimationClipを生成（リターゲティング実行）
   * 4. VRMモデルのヒューマノイド構造に適合したアニメーションが完成
   * 
   * これにより、以下の全ての命名規則が動作：
   * - Mixamo: mixamorig:Hips, mixamorig:Spine
   * - VRM標準: J_Bip_C_Hips, J_Bip_C_Spine
   * - カスタム: l_up_leg, r_up_arm, torso_1
   * 
   * @example
   * // Mixamo形式のVRMAファイル
   * await loadAnimation('happy', './LyingDown.vrma');
   * 
   * // VRM標準形式のVRMAファイル  
   * await loadAnimation('sad', './VRMA_01.vrma');
   * 
   * // カスタム形式のVRMAファイル
   * await loadAnimation('neutral', './idle_loop.vrma');
   * 
   * // どれも同じVRMモデルで正しく再生される！
   */
  async loadAnimation(emotion, path) {
    try {
      // === ステップ1: VRMAファイルの読み込み ===
      // loadVRMAnimationはGLTFLoaderにVRMAnimationLoaderPluginを自動登録し、
      // humanoidボーンマッピングを解析してVRMAnimationオブジェクトを返す
      const vrmAnimation = await loadVRMAnimation(path);

      if (!vrmAnimation) {
        throw new Error('VRMAnimationデータが見つかりません');
      }

      this.vrmAnimations[emotion] = vrmAnimation;

      // === ステップ2: リターゲティング処理 ===
      // VRMAnimation.createAnimationClipが魔法を実行：
      // - VRMAのhumanoidボーンマッピングを使用
      // - ボーン名をVRMモデルのhumanoid構造に自動変換
      // - ワールド座標変換を適用
      // - mixamorig:Hips → J_Bip_C_Hips などの変換が自動で実行される
      const clip = vrmAnimation.createAnimationClip(this.vrm);

      if (!clip) {
        throw new Error('AnimationClipの作成に失敗しました');
      }

      // === ステップ3: AnimationMixerの初期化 ===
      if (!this.mixer) {
        this.mixer = new THREE.AnimationMixer(this.vrm.scene);
      }

      // === ステップ4: AnimationActionの作成と設定 ===
      const action = this.mixer.clipAction(clip);
      
      // ループ設定：neutralはループ、その他は1回再生
      if (emotion === this.idleEmotion) {
        action.loop = THREE.LoopRepeat;
        console.log(`${this.LOG_PREFIX} 📂 ${emotion} (idle, リターゲット済み): ${path}`);
      } else {
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = true;
        console.log(`${this.LOG_PREFIX} 📂 ${emotion} (oneshot, リターゲット済み): ${path}`);
      }
      
      this.actions[emotion] = action;

    } catch (error) {
      // エラーハンドリング：詳細なログで問題の特定を容易に
      console.error(`${this.LOG_PREFIX} ❌ ${emotion} の読み込み失敗 (${path}):`, error);
      console.error(`${this.LOG_PREFIX} 原因候補:`, {
        'VRMAファイルが存在しない': 'ファイルパスを確認',
        'VRMC_vrm_animation拡張がない': 'FBX2VRMA-Converterで再変換',
        'humanoidボーンマッピング不一致': 'VRMモデルのhumanoid構造を確認',
        'ネットワークエラー': 'サーバー接続を確認'
      });
      throw error;  // Promise.allSettledでキャッチされる
    }
  },

  /**
   * 感情に応じたアニメーションの再生
   * 
   * @param {string} emotion - 再生する感情名
   * 
   * @description
   * 指定された感情のアニメーションを再生し、同時にVRM表情も変更。
   * neutral以外のアニメーションは、終了後に自動的にneutralに戻る。
   * 
   * @architecture
   * フェードイン/フェードアウトにより滑らかな遷移を実現。
   * メモリリーク防止のため、イベントリスナーを適切にクリーンアップ。
   */
  playEmotion(emotion) {
    const action = this.actions[emotion];

    if (!action) {
      console.warn(`${this.LOG_PREFIX} ⚠️ アニメーションが見つかりません: ${emotion}`);
      console.warn(`${this.LOG_PREFIX} 利用可能な感情:`, Object.keys(this.actions));
      return;
    }

    console.log(`${this.LOG_PREFIX} 🎭 感情切り替え: ${emotion}`);

    // === 現在のアニメーションのフェードアウト ===
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(this.FADE_DURATION);
    }

    // === 新しいアニメーションのフェードイン ===
    action.reset().fadeIn(this.FADE_DURATION).play();
    this.currentAction = action;

    // === neutral以外: 終了後にneutralへ自動復帰 ===
    if (emotion !== this.idleEmotion) {
      this.setupAnimationFinishListener(action, emotion);
    }

    // === VRM表情の同期 ===
    if (this.vrm) {
      this.setVRMExpression(emotion);
    }
  },

  /**
   * アニメーション終了リスナーのセットアップ
   * 
   * @private
   * @param {THREE.AnimationAction} action - 監視対象のアクション
   * @param {string} emotion - 感情名（ログ用）
   * 
   * @description
   * アニメーション終了時にneutralに戻るリスナーを設定。
   * メモリリーク防止のため、既存リスナーのクリーンアップを徹底。
   */
  setupAnimationFinishListener(action, emotion) {
    // 既存リスナーのクリーンアップ（メモリリーク防止）
    if (this.finishedListener) {
      this.mixer.removeEventListener('finished', this.finishedListener);
    }
    
    // 新しいリスナーを設定
    this.finishedListener = (e) => {
      if (e.action === action) {
        console.log(`${this.LOG_PREFIX} ⏹️ ${emotion} 終了 → neutralへ復帰`);
        
        // リスナーの削除（一度だけ実行）
        this.mixer.removeEventListener('finished', this.finishedListener);
        this.finishedListener = null;
        
        // neutralアニメーションの再生
        this.playEmotion(this.idleEmotion);
      }
    };
    
    this.mixer.addEventListener('finished', this.finishedListener);
  },

  /**
   * VRM表情の設定
   * 
   * @param {string} emotion - 設定する感情名
   * 
   * @description
   * VRMの表情マネージャーを使用して、感情に応じた表情を設定。
   * アニメーションとは独立した表情制御により、より豊かな表現を実現。
   * 
   * @note
   * VRM 1.0仕様に準拠した表情名を使用。
   * カスタム表情を追加する場合は、VRMモデル側に表情定義が必要。
   */
  setVRMExpression(emotion) {
    if (!this.vrm || !this.vrm.expressionManager) {
      console.warn(`${this.LOG_PREFIX} ⚠️ ExpressionManager not found`);
      return;
    }

    const expressionManager = this.vrm.expressionManager;

    // === 全表情をリセット ===
    const allExpressions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
    allExpressions.forEach(expr => {
      expressionManager.setValue(expr, 0);
    });

    // === 指定された表情を設定 ===
    if (allExpressions.includes(emotion)) {
      expressionManager.setValue(emotion, 1.0);
    }

    // 表情の反映（VRM必須）
    expressionManager.update();

    console.log(`${this.LOG_PREFIX} 😊 表情設定: ${emotion}`);
  },

  /**
   * フレーム毎の更新処理
   * 
   * @param {number} time - 経過時間（ミリ秒）
   * @param {number} deltaTime - 前フレームからの経過時間（ミリ秒）
   * 
   * @description
   * AnimationMixerの更新を行い、アニメーションを進行させる。
   * A-Frameのtickイベントから毎フレーム呼び出される。
   */
  tick: function(time, deltaTime) {
    if (this.mixer) {
      // deltaTimeをミリ秒から秒に変換
      this.mixer.update(deltaTime / 1000);
    }
  },

  /**
   * コンポーネントの削除時のクリーンアップ
   * 
   * @description
   * メモリリークを防ぐため、リスナーとリソースを適切に解放。
   * 本番環境での長時間稼働に備えた重要な処理。
   */
  remove: function() {
    // イベントリスナーのクリーンアップ
    if (this.finishedListener && this.mixer) {
      this.mixer.removeEventListener('finished', this.finishedListener);
    }

    // AnimationActionの停止と解放
    Object.values(this.actions).forEach(action => {
      if (action) {
        action.stop();
      }
    });

    // AnimationMixerの解放
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    // 参照のクリア
    this.actions = {};
    this.vrmAnimations = {};
    this.currentAction = null;
    this.vrm = null;

    console.log(`${this.LOG_PREFIX} 🧹 コンポーネントをクリーンアップしました`);
  }
});
