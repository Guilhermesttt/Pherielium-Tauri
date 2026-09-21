'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type MicProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.1, 0.95, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    waves: {
      initial: { scale: 1, opacity: 1 },
      animate: {
        scale: [1, 1.15, 1],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MicProps) {
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
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <motion.path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        variants={variants.waves}
        initial="initial"
        animate={controls}
      />
      <line x1="12" x2="12" y1="19" y2="22" />
    </motion.svg>
  );
}

function Mic(props: MicProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Mic,
  Mic as MicIcon,
  type MicProps,
  type MicProps as MicIconProps,
};
