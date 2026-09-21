'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type Trash2Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    lid: {
      initial: { rotate: 0, y: 0, transformOrigin: '12px 4px' },
      animate: {
        rotate: [-0, -18, -12, 0],
        y: [0, -1.5, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
    body: {
      initial: { y: 0 },
      animate: {
        y: [0, 1, 0],
        transition: { duration: 0.55, ease: 'easeInOut', delay: 0.05 },
      },
    },
    line1: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [1, 0.2, 1],
        opacity: [1, 0.4, 1],
        transition: { duration: 0.55, ease: 'easeInOut', delay: 0.08 },
      },
    },
    line2: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [1, 0.2, 1],
        opacity: [1, 0.4, 1],
        transition: { duration: 0.55, ease: 'easeInOut', delay: 0.14 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Trash2Props) {
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
      {...props}
    >
      <motion.g variants={variants.lid} initial="initial" animate={controls}>
        <motion.path d="M3 6h18" />
        <motion.path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </motion.g>
      <motion.g variants={variants.body} initial="initial" animate={controls}>
        <motion.path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <motion.path
          d="M10 11v6"
          variants={variants.line1}
          initial="initial"
          animate={controls}
        />
        <motion.path
          d="M14 11v6"
          variants={variants.line2}
          initial="initial"
          animate={controls}
        />
      </motion.g>
    </motion.svg>
  );
}

function Trash2(props: Trash2Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Trash2,
  Trash2 as Trash2Icon,
  type Trash2Props,
  type Trash2Props as Trash2IconProps,
};
