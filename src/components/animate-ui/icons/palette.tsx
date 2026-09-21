'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type PaletteProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -12, 10, -6, 4, 0],
        transformOrigin: 'bottom center',
        transition: { duration: 0.8, ease: 'easeInOut' },
      },
    },
    dots: {
      initial: { scale: 1, opacity: 1 },
      animate: {
        scale: [1, 1.35, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PaletteProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={variants.group}
      initial="initial"
      animate={controls}
      {...props}
    >
      <motion.circle cx="13.5" cy="6.5" r=".5" fill="currentColor" variants={variants.dots} initial="initial" animate={controls} />
      <motion.circle cx="17.5" cy="10.5" r=".5" fill="currentColor" variants={variants.dots} initial="initial" animate={controls} />
      <motion.circle cx="8.5" cy="7.5" r=".5" fill="currentColor" variants={variants.dots} initial="initial" animate={controls} />
      <motion.circle cx="6.5" cy="12.5" r=".5" fill="currentColor" variants={variants.dots} initial="initial" animate={controls} />
      <motion.path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
      />
    </motion.svg>
  );
}

function Palette(props: PaletteProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Palette,
  Palette as PaletteIcon,
  type PaletteProps,
  type PaletteProps as PaletteIconProps,
};
