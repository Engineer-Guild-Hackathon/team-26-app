import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Text, Plane, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import modelUrl from '../assets/udemy_test2.glb?url'

const OPTIMAL_CAMERA_POSITION = {
  position: new THREE.Vector3(0, 3.5, 8.3),
  target: new THREE.Vector3(0, 2.3, 0),
};


/**
 * 3Dモデルを読み込み、"Study"アニメーションを再生するコンポーネント
 */
function AnimatedModel() {
  const { scene, animations } = useGLTF(modelUrl);
  const mixer = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    if (scene && animations.length) {
      mixer.current = new THREE.AnimationMixer(scene);
      const studyAnimation = animations.find(clip => clip.name === 'Study');
      if (studyAnimation) {
        const action = mixer.current.clipAction(studyAnimation);
        action.play();
      }
    }
  }, [scene, animations]);

  useFrame((_, delta) => {
    mixer.current?.update(delta);
  });

  return <primitive object={scene} scale={1.2} position={[0, 0, 0]} rotation={[0, Math.PI, 0]} />;
}

/**
 * 画像教材を表示する専用コンポーネント
 */
function ImageMaterial({ url, position, rotation }: { url: string, position: [number, number, number], rotation: [number, number, number] }) {
  const texture = useTexture(url); // フックの呼び出しをコンポーネントのトップレベルに移動
  if (Array.isArray(texture) || !(texture instanceof THREE.Texture)) {
    return null;
  }
  const aspectRatio = texture.image ? texture.image.width / texture.image.height : 1;
  const displayWidth = 1.4;
  
  return (
    <group position={position} rotation={rotation}>
      <Plane args={[displayWidth, displayWidth / aspectRatio]}>
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      </Plane>
    </group>
  );
}

/**
 * テキスト教材を表示する専用コンポーネント
 */
function TextMaterial({ textContent, position, rotation }: { textContent: string, position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Plane args={[1.55, 1.3]}>
        <meshBasicMaterial color="#333333" transparent opacity={0.8} />
      </Plane>
      <Plane args={[1.5, 1.25]} position={[0, 0, 0.01]}>
        <meshBasicMaterial color="#f0f0f0" transparent opacity={0.95} />
      </Plane>
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.08}
        color="#212529"
        maxWidth={1.4}
        lineHeight={1.4}
        textAlign="left"
        anchorX="center"
        anchorY="middle"
      >
        {textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '')}
      </Text>
    </group>
  );
}

/**
 * 表示する教材の種類に応じてコンポーネントを切り替える
 */
function MaterialDisplay({ selectedMaterial, textContent }: { selectedMaterial: any, textContent: string | null }) {
  if (!selectedMaterial) return null;

  const position: [number, number, number] = [0, 1.1, 3.6];
  const rotation: [number, number, number] = [-0.3, 0, 0];

  if (selectedMaterial.type === 'image' && selectedMaterial.downloadURL) {
    return <ImageMaterial url={selectedMaterial.downloadURL} position={position} rotation={rotation} />;
  }

  if (selectedMaterial.type === 'text' && textContent) {
    return <TextMaterial textContent={textContent} position={position} rotation={rotation} />;
  }

  return null;
}


interface StudyAnimationProps {
  selectedMaterial: any;
  textContent: string | null;
}
  
export default function StudyAnimation({ selectedMaterial, textContent }: StudyAnimationProps) {

  return (
    // ★ styleのタイポを修正 (width: '100%')
    <div style={{ width: '100%', height: '100vh', background: 'transparent' }}>
      <Canvas 
        camera={{ 
          position: OPTIMAL_CAMERA_POSITION.position, 
          fov: 50 
        }}
        onCreated={({ camera }) => {
          camera.lookAt(OPTIMAL_CAMERA_POSITION.target);
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        <Suspense fallback={null}>
          <AnimatedModel />
          <MaterialDisplay selectedMaterial={selectedMaterial} textContent={textContent} />
        </Suspense>

        <gridHelper args={[20, 20]} />
      </Canvas>
    </div>
  );
}

