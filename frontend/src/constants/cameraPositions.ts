// 最適なカメラ位置設定
export interface OptimalCameraPosition {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  name: string
  description?: string
}

// ユーザーが特定した最適なカメラ位置
export const OPTIMAL_CAMERA_POSITION: OptimalCameraPosition = {
  position: {
    x: 0,
    y: 3.5, // 顔全体が見えるよう少し上から
    z: -7 // 顔全体が見えるよう少し引く
  },
  target: {
    x: 0,
    y: 2.5, // 顔の中心あたりを見る
    z: 0
  },
  name: "顔全体表示位置",
  description: "顔全体がしっかり見える最適なビューアングル"
}

// プリセットカメラ位置（必要に応じて追加可能）
export const PRESET_CAMERA_POSITIONS = {
  optimal: OPTIMAL_CAMERA_POSITION,
  // 将来的に他の角度も追加可能
}
