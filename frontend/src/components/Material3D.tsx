import { useState, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

interface Material3DProps {
  selectedMaterial: any
  position?: [number, number, number]
}

export default function Material3D({ selectedMaterial, position = [1.5, 1.2, 1.0] }: Material3DProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (selectedMaterial?.type === 'image' && selectedMaterial.downloadURL) {
      const loader = new THREE.TextureLoader()
      loader.load(selectedMaterial.downloadURL, (loadedTexture) => {
        setTexture(loadedTexture)
      })
    } else {
      setTexture(null)
    }
  }, [selectedMaterial])

  if (!selectedMaterial) return null

  if (selectedMaterial.type === 'image' && texture) {
    return (
      <group position={position}>
        {/* 画像を表示する3Dプレーン */}
        <mesh rotation={[0, -Math.PI / 6, 0]}>
          <planeGeometry args={[2, 1.5]} />
          <meshBasicMaterial map={texture} transparent />
        </mesh>
        
        {/* 枠 */}
        <mesh rotation={[0, -Math.PI / 6, 0]} position={[0, 0, -0.01]}>
          <planeGeometry args={[2.1, 1.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
    )
  }

  if (selectedMaterial.type === 'text') {
    return (
      <group position={position}>
        {/* テキスト教材の表示 */}
        <mesh rotation={[0, -Math.PI / 6, 0]}>
          <planeGeometry args={[2, 1.5]} />
          <meshBasicMaterial color="#f8f9fa" transparent opacity={0.9} />
        </mesh>
        
        {/* 枠 */}
        <mesh rotation={[0, -Math.PI / 6, 0]} position={[0, 0, -0.01]}>
          <planeGeometry args={[2.1, 1.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
        
        {/* テキスト内容の一部を表示 */}
        <Text
          position={[0, 0.3, 0.01]}
          fontSize={0.08}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.8}
          textAlign="center"
        >
          {selectedMaterial.content?.substring(0, 100) + (selectedMaterial.content?.length > 100 ? '...' : '')}
        </Text>

      </group>
    )
  }

  return null
}
