'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type UserMinusProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    person: {
      initial: { x: 0, opacity: 1 },
      animate: {
        x: [0, -2, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
    minus: {
      initial: { scaleX: 1, opacity: 1 },
      animate: {
        scaleX: [1, 1.35, 1],
        opacity: [1, 0.55, 1],
        transition: { duration: 0.5, ease: 'easeInOut', delay: 0.08 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UserMinusProps) {
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
      <motion.g variants={variants.person} initial="initial" animate={controls}>
        <motion.path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <motion.circle cx="9" cy="7" r="4" />
      </motion.g>
      <motion.path
        d="M22 11h-6"
        variants={variants.minus}
        initial="initial"
        animate={controls}
        style={{ transformOrigin: '19px 11px' }}
      />
    </motion.svg>
  );
}

function UserMinus(props: UserMinusProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  UserMinus,
  UserMinus as UserMinusIcon,
  type UserMinusProps,
  type UserMinusProps as UserMinusIconProps,
};
