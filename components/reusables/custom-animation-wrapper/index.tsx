// components/animation-wrappers.tsx
"use client";
import { motion, useAnimation, useInView } from "framer-motion";
import { HTMLAttributes, ReactNode, useEffect, useRef } from "react";
import {
  fadeInXAnimationVariants,
  fadeInYAnimationVariants,
  revealAnimationVariants,
} from "./variants"; // Ensure this path is correct relative to this file

interface RevealAnimationProps {
  index: number;
  children: ReactNode;
  trigger: "scroll" | "manual";
}

interface FadeInAnimationProps {
  index: number;
  children: ReactNode;
  type: "fadeInX" | "fadeInY";
  className?: HTMLAttributes<HTMLDivElement>["className"];
}

export const RevealAnimationWrapper = ({
  index,
  children,
  trigger,
}: RevealAnimationProps) => {
  const ref = useRef(null);
  const controls = useAnimation();
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    // For "scroll" trigger, animate when in view
    if (trigger === "scroll" && isInView) {
      controls.start("visible");
    }
    // For "manual" trigger, it's assumed an external control will trigger the animation.
    // The `animate` prop will be set directly to "visible" in the consuming component.
  }, [isInView, controls, trigger]);

  return (
    <motion.div
      variants={revealAnimationVariants}
      initial="hidden"
      // Apply animation based on trigger type.
      // For "manual", the `animate` prop directly dictates the state.
      // For "scroll", `controls` manage the animation based on isInView.
      animate={trigger === "manual" ? "visible" : controls}
      custom={index}
      ref={ref}
      className="overflow-hidden" // Corrected typo here
    >
      {children}
    </motion.div>
  );
};

export const FadeInAnimationWrapper = ({
  type,
  index,
  children,
  className,
}: FadeInAnimationProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      custom={index}
      initial="hidden"
      className={className}
      animate={isInView ? "visible" : "hidden"}
      variants={
        type === "fadeInX" ? fadeInXAnimationVariants : fadeInYAnimationVariants
      }
    >
      {children}
    </motion.div>
  );
};
