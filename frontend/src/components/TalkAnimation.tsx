import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { OPTIMAL_CAMERA_POSITION } from '../constants/cameraPositions'

function AnimatedModel() {
  const { scene, animations } = useGLTF('/udemy_test.glb')
  const mixer = useRef<THREE.AnimationMixer>()

  useEffect(() => {
    if (scene && animations) {
      mixer.current = new THREE.AnimationMixer(scene)
      
      // "Talk"アニメーションを探して再生
      const talkAnimation = animations.find(clip => clip.name === 'Talk')
      if (talkAnimation && mixer.current) {
        const action = mixer.current.clipAction(talkAnimation)
        action.play()
      }
    }
  }, [scene, animations])

  useFrame((state, delta) => {
    if (mixer.current) {
      mixer.current.update(delta)
    }
  })

  return <primitive object={scene} />
}

interface TalkAnimationProps {
  className?: string
}

export default function TalkAnimation({ className }: TalkAnimationProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas 
        camera={{ 
          position: [
            OPTIMAL_CAMERA_POSITION.position.x,
            OPTIMAL_CAMERA_POSITION.position.y,
            OPTIMAL_CAMERA_POSITION.position.z
          ],
          fov: 60 // 顔全体が見えるよう視野角を広げる 
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
      </Canvas>
    </div>
  )
}