'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type MessageSquareProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {
        scale: 1,
        rotate: 0,
      },
      animate: {
        scale: [1, 1.05, 1.05, 1],
        rotate: [0, -7, 7, 0],
        transition: {
          duration: 0.5,
          ease: 'easeInOut',
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MessageSquareProps) {
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
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function MessageSquare(props: MessageSquareProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { MessageSquare,
  MessageSquare as MessageSquareIcon,
  type MessageSquareProps,
  type MessageSquareProps as MessageSquareIconProps,
};
