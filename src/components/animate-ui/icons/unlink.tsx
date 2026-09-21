'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type UnlinkProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    left: {
      initial: { x: 0, y: 0, rotate: 0 },
      animate: {
        x: [-0, -2, 0],
        y: [0, 1.5, 0],
        rotate: [0, -8, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
    right: {
      initial: { x: 0, y: 0, rotate: 0 },
      animate: {
        x: [0, 2, 0],
        y: [0, -1.5, 0],
        rotate: [0, 8, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
    break1: {
      initial: { opacity: 1, pathLength: 1 },
      animate: {
        opacity: [1, 0.25, 1],
        pathLength: [1, 0.4, 1],
        transition: { duration: 0.55, ease: 'easeInOut', delay: 0.06 },
      },
    },
    break2: {
      initial: { opacity: 1, pathLength: 1 },
      animate: {
        opacity: [1, 0.25, 1],
        pathLength: [1, 0.4, 1],
        transition: { duration: 0.55, ease: 'easeInOut', delay: 0.1 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UnlinkProps) {
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
      <motion.path
        d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"
        variants={variants.right}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"
        variants={variants.left}
        initial="initial"
        animate={controls}
      />
      <motion.line
        x1="8"
        x2="8"
        y1="2"
        y2="4"
        variants={variants.break1}
        initial="initial"
        animate={controls}
      />
      <motion.line
        x1="16"
        x2="16"
        y1="20"
        y2="22"
        variants={variants.break2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Unlink(props: UnlinkProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Unlink,
  Unlink as UnlinkIcon,
  type UnlinkProps,
  type UnlinkProps as UnlinkIconProps,
};
