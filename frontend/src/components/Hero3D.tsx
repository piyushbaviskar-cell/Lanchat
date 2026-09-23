// @ts-nocheck
"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Wireframe, useCursor, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

function Icosahedron({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const shouldReduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const isTouch = typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches;

  useCursor(hovered);

  useFrame((_state, delta) => {
    if (!meshRef.current || shouldReduceMotion) return;
    
    // Idle rotation
    meshRef.current.rotation.y += 0.05 * delta;
    
    // Pointer follow (only on non-touch devices if not using PresentationControls)
    // Actually, we use PresentationControls wrapping this component, so we don't strictly need manual pointer follow,
    // but the prompt asked for lerp toward normalized mouse coords OR PresentationControls. Let's rely on PresentationControls for drag,
    // and just do a slight idle rotation here.
  });

  return (
    <mesh 
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <icosahedronGeometry args={[1.5, 0]} />
      <meshStandardMaterial 
        color={color} 
        wireframe 
        transparent 
        opacity={0.3} 
      />
      {/* Optional: Add a second inner solid geometry for depth */}
      <mesh>
        <icosahedronGeometry args={[1.45, 0]} />
        <meshStandardMaterial color={color} transparent opacity={0.1} />
      </mesh>
    </mesh>
  );
}

function Scene() {
  const [accentColor, setAccentColor] = useState("#4f7fff"); // Fallback

  useEffect(() => {
    // Read the --accent token
    const rootStyles = getComputedStyle(document.documentElement);
    let accentHsl = rootStyles.getPropertyValue('--accent').trim();
    if (accentHsl) {
        if (accentHsl.includes('oklch')) {
            // we can't easily parse oklch to threejs without a library. But we can use a canvas trick or just set it as a string if threejs supports it.
            // ThreeJS color supports some CSS strings, but standard HSL is safer.
            // Let's rely on a temp div to get computed RGB
            const div = document.createElement('div');
            div.style.color = `oklch(${accentHsl.replace('oklch(', '').replace(')', '')})`;
            if(!div.style.color) div.style.color = accentHsl.startsWith('oklch') ? accentHsl : `hsl(${accentHsl})`;
            document.body.appendChild(div);
            const computedColor = getComputedStyle(div).color;
            document.body.removeChild(div);
            setAccentColor(computedColor);
        } else {
            setAccentColor(`hsl(${accentHsl})`);
        }
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <PresentationControls
        global={false} 
        cursor={true}
        snap={true}
        speed={1}
        zoom={1}
        rotation={[0, 0, 0]}
        polar={[-Math.PI / 4, Math.PI / 4]}
        azimuth={[-Math.PI / 4, Math.PI / 4]}
      >
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
          <Icosahedron color={accentColor} />
        </Float>
      </PresentationControls>
    </>
  );
}

export default function Hero3D() {
  const shouldReduceMotion = useReducedMotion();
  const [isInView, setIsInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // WebGL Feature Detect
  const [hasWebGL, setHasWebGL] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setHasWebGL(!!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))));
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return (
        <div className="w-[300px] h-[300px] flex items-center justify-center opacity-30 border border-[var(--border-md)] rounded-full">
            Fallback SVG
        </div>
    );
  }

  return (
    <div ref={containerRef} className="w-[260px] h-[260px] md:w-[350px] md:h-[350px] cursor-grab active:cursor-grabbing">
      <Canvas 
        dpr={[1, 1.5]} 
        frameloop={isInView && !shouldReduceMotion ? "always" : "demand"}
        camera={{ position: [0, 0, 4], fov: 45 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
