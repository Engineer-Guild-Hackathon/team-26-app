import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { OPTIMAL_CAMERA_POSITION } from '../constants/cameraPositions'
import Material3D from './Material3D'

function AnimatedModel() {
  const { scene, animations } = useGLTF('/udemy_test2.glb')
  const mixer = useRef<THREE.AnimationMixer | null>(null)

  useEffect(() => {
    if (scene && animations) {
      mixer.current = new THREE.AnimationMixer(scene)
      
      // "Study"アニメーションを探して再生
      const studyAnimation = animations.find(clip => clip.name === 'Study')
      if (studyAnimation && mixer.current) {
        const action = mixer.current.clipAction(studyAnimation)
        action.play()
      }
    }
  }, [scene, animations])

  useFrame((_, delta) => {
    if (mixer.current) {
      mixer.current.update(delta)
    }
  })

  return <primitive object={scene} />
}


interface StudyAnimationProps {
  className?: string
  selectedMaterial?: any
}

export default function StudyAnimation({ className, selectedMaterial }: StudyAnimationProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100vh' }}>
      <Canvas 
        camera={{ 
          position: [
            OPTIMAL_CAMERA_POSITION.position.x,
            OPTIMAL_CAMERA_POSITION.position.y,
            OPTIMAL_CAMERA_POSITION.position.z
          ],
          fov: 50 
        }}
        onCreated={({ camera }) => {
          camera.lookAt(
            OPTIMAL_CAMERA_POSITION.target.x,
            OPTIMAL_CAMERA_POSITION.target.y,
            OPTIMAL_CAMERA_POSITION.target.z
          )
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <AnimatedModel />
        
        {/* 3D教材表示 */}
        <Material3D selectedMaterial={selectedMaterial} />
        
        {/* グリッドヘルパー */}
        <gridHelper args={[20, 20]} />
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  )
}
