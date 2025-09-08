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
    y: 2.5,
    z: -5 // 背面からの最適な距離
  },
  target: {
    x: 0,
    y: 2,
    z: 0
  },
  name: "最適位置",
  description: "確定した最適なビューアングル"
}

// プリセットカメラ位置（必要に応じて追加可能）
export const PRESET_CAMERA_POSITIONS = {
  optimal: OPTIMAL_CAMERA_POSITION,
  // 将来的に他の角度も追加可能
}
