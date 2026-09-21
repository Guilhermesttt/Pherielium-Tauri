'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type Gamepad2Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: [0, -8, 8, -4, 4, 0],
        scale: [1, 1.05, 0.98, 1],
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    buttons: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.3, 1],
        transition: { duration: 0.4, ease: 'easeInOut', delay: 0.1 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Gamepad2Props) {
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
      style={{ transformOrigin: 'center' }}
      {...props}
    >
      <line x1="6" x2="10" y1="12" y2="12" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <motion.line
        x1="15"
        x2="15.01"
        y1="13"
        y2="13"
        variants={variants.buttons}
        initial="initial"
        animate={controls}
      />
      <motion.line
        x1="18"
        x2="18.01"
        y1="11"
        y2="11"
        variants={variants.buttons}
        initial="initial"
        animate={controls}
      />
      <rect width="20" height="12" x="2" y="6" rx="6" />
    </motion.svg>
  );
}

function Gamepad2(props: Gamepad2Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Gamepad2,
  Gamepad2 as Gamepad2Icon,
  type Gamepad2Props,
  type Gamepad2Props as Gamepad2IconProps,
};
