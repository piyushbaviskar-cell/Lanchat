"use client"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, id, value, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const inputId = id || "animated-input-" + React.useId()
    const hasValue = value !== undefined && value !== "" && value !== null
    const isActive = isFocused || hasValue

    return (
      <div className="relative w-full">
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ staggerChildren: 0.05, delayChildren: 0.1 }}
              className="absolute left-3 top-[-10px] flex overflow-hidden bg-background px-1 text-xs font-semibold text-[var(--muted)] z-10"
            >
              {label.split("").map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <input
          id={inputId}
          type={type}
          value={value}
          className={cn(
            "flex h-12 w-full rounded-md border border-[var(--border-md)] bg-transparent px-3 py-2 text-sm text-[var(--text)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus:border-[var(--accent)]",
            className
          )}
          placeholder={isActive ? "" : label}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
