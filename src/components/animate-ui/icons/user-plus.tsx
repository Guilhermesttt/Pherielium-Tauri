'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type UserPlusProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {
        y: 0,
      },
      animate: {
        y: [0, 2, -2, 0],
        transition: {
          duration: 0.6,
          ease: 'easeInOut',
        },
      },
    },
    path2: {
      initial: {
        x: 0,
      },
      animate: {
        x: [0, 4, 0],
        transition: {
          duration: 0.4,
          ease: 'easeInOut',
        },
      },
    },
    path3: {
      initial: {
        x: 0,
      },
      animate: {
        x: [0, 3, 0],
        transition: {
          duration: 0.4,
          ease: 'easeInOut',
          delay: 0.2,
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UserPlusProps) {
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
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx="9"
        cy="7"
        r="4"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M22 21v-2a4 4 0 0 0-3-3.87"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 3.128a4 4 0 0 1 0 7.744"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M22 8h-4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M20 6v4"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function UserPlus(props: UserPlusProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { UserPlus,
  UserPlus as UserPlusIcon,
  type UserPlusProps,
  type UserPlusProps as UserPlusIconProps,
};
