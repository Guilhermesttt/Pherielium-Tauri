'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type LaptopProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    screen: {
      initial: { rotateX: 0 },
      animate: {
        rotateX: [0, -20, 10, 0],
        transition: { duration: 0.8, ease: 'easeInOut' },
      },
    },
    base: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.05, 1],
        transition: { duration: 0.8, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LaptopProps) {
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
      variants={variants.base}
      initial="initial"
      animate={controls}
      style={{ transformOrigin: 'bottom center' }}
      {...props}
    >
      <motion.path
        d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9"
        variants={variants.screen}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: 'bottom center' }}
      />
      <path d="M4 16h16" />
      <path d="M2 20h20" />
    </motion.svg>
  );
}

function Laptop(props: LaptopProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Laptop,
  Laptop as LaptopIcon,
  type LaptopProps,
  type LaptopProps as LaptopIconProps,
};
