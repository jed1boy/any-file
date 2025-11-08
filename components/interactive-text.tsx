"use client"

import { useEffect, useRef, useState } from "react"

interface InteractiveTextProps {
  children: string
  className?: string
}

export function InteractiveText({ children, className = "" }: InteractiveTextProps) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (textRef.current && isHovering) {
        const rect = textRef.current.getBoundingClientRect()
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isHovering])

  return (
    <span
      ref={textRef}
      className={`relative inline-block cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {children}
      {/* Animated underline that follows the cursor */}
      <span
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none"
        style={{
          width: "100%",
          opacity: isHovering ? 1 : 0,
          transition: "opacity 0.3s ease",
          background: isHovering
            ? `linear-gradient(90deg, 
                transparent 0%, 
                transparent ${Math.max(0, (mousePos.x / (textRef.current?.offsetWidth || 1)) * 100 - 20)}%, 
                rgba(255,255,255,0.8) ${(mousePos.x / (textRef.current?.offsetWidth || 1)) * 100}%, 
                transparent ${Math.min(100, (mousePos.x / (textRef.current?.offsetWidth || 1)) * 100 + 20)}%, 
                transparent 100%)`
            : "transparent",
        }}
      />
      {/* Subtle glow effect */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: isHovering ? 0.4 : 0,
          transition: "opacity 0.3s ease",
          textShadow: "0 0 20px rgba(255, 255, 255, 0.6)",
        }}
      >
        {children}
      </span>
    </span>
  )
}
