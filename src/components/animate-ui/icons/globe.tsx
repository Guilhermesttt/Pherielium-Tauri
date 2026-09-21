'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type GlobeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, 180, 360],
        transition: { duration: 1.8, ease: 'easeInOut' },
      },
    },
    meridians: {
      initial: { scaleX: 1 },
      animate: {
        scaleX: [1, 0.4, 1],
        transition: { duration: 1.2, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: GlobeProps) {
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
      <circle cx="12" cy="12" r="10" />
      <motion.path
        d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
        variants={variants.meridians}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: 'center' }}
      />
      <line x1="2" x2="22" y1="12" y2="12" />
    </motion.svg>
  );
}

function Globe(props: GlobeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Globe,
  Globe as GlobeIcon,
  type GlobeProps,
  type GlobeProps as GlobeIconProps,
};
