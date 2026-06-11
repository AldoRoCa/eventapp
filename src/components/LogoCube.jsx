import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
import * as THREE from "three"

function Cube() {
  const meshRef = useRef()

  useFrame((state) => {
    meshRef.current.rotation.y -= 0.006
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.15
  })

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#7c3aed"),
    roughness: 0.15,
    metalness: 0.7,
    reflectivity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  })

  return (
    <>
      <mesh ref={meshRef} castShadow receiveShadow material={material}>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.25} />
      </mesh>
    </>
  )
}

export default function LogoCube() {
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "380px",
      height: "380px",
      pointerEvents: "none",
      zIndex: 0,
      opacity: 0.55,
    }}>
      <Canvas
        camera={{ position: [2, 2, 5], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <fog attach="fog" args={["#000000", 5, 15]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4, 3, 4]} intensity={20} color="#8b5cf6" />
        <pointLight position={[4, -3, -4]} intensity={10} color="#4f46e5" />
        <Environment preset="city" />
        <Cube />
      </Canvas>
    </div>
  )
}