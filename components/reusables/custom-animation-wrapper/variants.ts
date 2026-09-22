import { Variants } from "framer-motion";

export const revealAnimationVariants: Variants = {
  hidden: (i: number) => ({
    clipPath: "inset(0% 100% 0% 0%)",
    transition: { delay: i + 0.25, duration: i + 0.1, ease: "easeIn" },
  }),

  visible: (i: number) => ({
    clipPath: "inset(0% 0% 0% 0%)",
    transition: { delay: i + 0.25, duration: i + 0.1, ease: "easeIn" },
  }),
};

export const fadeInXAnimationVariants: Variants = {
  hidden: (i: number) => ({
    x: 100,
    opacity: 0.3,
    transition: { delay: i + 0.25, duration: i + 0.1, ease: "easeIn" },
  }),

  visible: (i: number) => ({
    x: 0,
    opacity: 1,
    transition: { delay: i + 0.25, duration: i + 0.1, ease: "easeIn" },
  }),
};

export const fadeInYAnimationVariants: Variants = {
  hidden: (i: number) => ({
    y: 100,
    opacity: 0.3,
    transition: { duration: i * 0.25, ease: "easeIn" },
  }),

  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { duration: i * 0.25, ease: "easeIn" },
  }),
};
