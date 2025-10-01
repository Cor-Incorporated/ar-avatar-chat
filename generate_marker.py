#!/usr/bin/env python3
"""
AR.js マーカーパターンファイル生成スクリプト
画像ファイルを読み込み、.pattフォーマットに変換します
"""

from PIL import Image
import sys

def generate_marker_pattern(image_path, output_path, grid_size=16):
    """
    画像ファイルからAR.jsマーカーパターンファイルを生成

    Args:
        image_path: 入力画像のパス
        output_path: 出力.pattファイルのパス
        grid_size: グリッドサイズ（デフォルト: 16x16）
    """
    # 画像を読み込み
    img = Image.open(image_path)

    # グレースケールに変換してから、RGBに戻す（一貫性のため）
    img = img.convert('RGB')

    # 16x16にリサイズ
    img_resized = img.resize((grid_size, grid_size), Image.Resampling.LANCZOS)

    # ピクセルデータを取得
    pixels = list(img_resized.getdata())

    # RGB各チャンネルのデータを抽出
    red_channel = []
    green_channel = []
    blue_channel = []

    for pixel in pixels:
        red_channel.append(pixel[0])
        green_channel.append(pixel[1])
        blue_channel.append(pixel[2])

    # .pattフォーマットで出力
    with open(output_path, 'w') as f:
        # 赤チャンネル
        for i in range(grid_size):
            row = red_channel[i*grid_size:(i+1)*grid_size]
            f.write(' '.join(str(val) for val in row) + '\n')

        # 緑チャンネル
        for i in range(grid_size):
            row = green_channel[i*grid_size:(i+1)*grid_size]
            f.write(' '.join(str(val) for val in row) + '\n')

        # 青チャンネル
        for i in range(grid_size):
            row = blue_channel[i*grid_size:(i+1)*grid_size]
            f.write(' '.join(str(val) for val in row) + '\n')

    print(f"✅ マーカーパターンファイル生成完了: {output_path}")
    print(f"   入力画像: {image_path}")
    print(f"   グリッドサイズ: {grid_size}x{grid_size}")

if __name__ == "__main__":
    # 使用方法
    input_image = "/Users/teradakousuke/Developer/ar-avatar-chat/assets/penguin-logo.png"
    output_patt = "/Users/teradakousuke/Developer/ar-avatar-chat/src/assets/markers/penguin-marker.patt"

    print("🔄 AR.jsマーカーパターンファイル生成中...")
    generate_marker_pattern(input_image, output_patt)
