import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial } from "@react-three/drei"

function Cube() {
  const meshRef = useRef()

  useFrame((state) => {
    meshRef.current.rotation.y -= 0.008
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2.2, 2.2, 2.2]} />
      <MeshTransmissionMaterial
        backside
        samples={4}
        thickness={0.3}
        chromaticAberration={0.1}
        anisotropy={0.3}
        distortion={0.2}
        distortionScale={0.3}
        temporalDistortion={0.1}
        iridescence={0.5}
        iridescenceIOR={1}
        iridescenceThicknessRange={[0, 1400]}
        color="#7c3aed"
        transmission={0.95}
        roughness={0.1}
        metalness={0.1}
      />
    </mesh>
  )
}

export default function LogoCube() {
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "400px",
      height: "400px",
      pointerEvents: "none",
      zIndex: 0,
      opacity: 0.5,
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#a78bfa" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4f46e5" />
        <Cube />
      </Canvas>
    </div>
  )
}