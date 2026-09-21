import React, { useEffect, useRef, useState, useCallback } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Volume, Volume2 } from 'lucide-react';

const MAX_OVERFLOW = 50;

export interface ElasticSliderProps {
  value?: number;
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onChange?: (value: number) => void;
  showValue?: boolean;
  disabled?: boolean;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
  value: controlledValue,
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = '',
  isStepped = false,
  stepSize = 1,
  leftIcon = <Volume className="h-4 w-4" />,
  rightIcon = <Volume2 className="h-4 w-4" />,
  onChange,
  showValue = true,
  disabled = false,
}) => {
  const [internalValue, setInternalValue] = useState<number>(
    controlledValue !== undefined ? controlledValue : defaultValue
  );

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const updateValue = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, startingValue), maxValue);
      const stepped = isStepped ? Math.round(clamped / stepSize) * stepSize : clamped;
      setInternalValue(stepped);
      onChange?.(stepped);
    },
    [isStepped, maxValue, onChange, startingValue, stepSize]
  );

  const sliderRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<'left' | 'middle' | 'right'>('middle');
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  // Dynamic transforms directly subscribed to motion values for responsive physics
  const scaleX = useTransform(overflow, (of) => {
    if (sliderRef.current) {
      const { width } = sliderRef.current.getBoundingClientRect();
      return width > 0 ? 1 + of / width : 1;
    }
    return 1;
  });

  const scaleY = useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]);

  const transformOrigin = useTransform(clientX, (cx) => {
    if (sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      return cx < left + width / 2 ? 'right' : 'left';
    }
    return 'center';
  });

  const height = useTransform(scale, [1, 1.2], [6, 12]);
  const marginTop = useTransform(scale, [1, 1.2], [0, -3]);
  const marginBottom = useTransform(scale, [1, 1.2], [0, -3]);
  const opacity = useTransform(scale, [1, 1.2], [0.75, 1]);

  const leftIconX = useTransform(overflow, (of) => (region === 'left' ? -of / scale.get() : 0));
  const rightIconX = useTransform(overflow, (of) => (region === 'right' ? of / scale.get() : 0));

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.buttons > 0 && sliderRef.current) {
      const { left, right, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue + ((e.clientX - left) / width) * (maxValue - startingValue);
      if (isStepped) {
        newValue = Math.round(newValue / stepSize) * stepSize;
      }
      updateValue(newValue);

      let newOverflow = 0;
      if (e.clientX < left) {
        setRegion('left');
        newOverflow = left - e.clientX;
      } else if (e.clientX > right) {
        setRegion('right');
        newOverflow = e.clientX - right;
      } else {
        setRegion('middle');
        newOverflow = 0;
      }

      overflow.set(decay(newOverflow, MAX_OVERFLOW));
      clientX.set(e.clientX);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    animate(overflow, 0, { type: 'spring', bounce: 0.5, damping: 12, stiffness: 220 });
  };

  const getRangePercentage = (): number => {
    const totalRange = maxValue - startingValue;
    if (totalRange === 0) return 0;
    return Math.max(0, Math.min(100, ((currentValue - startingValue) / totalRange) * 100));
  };

  return (
    <div className={`relative flex flex-col items-center justify-center pt-5 pb-1 w-52 select-none ${className}`}>
      {/* Floating value centered directly above the slider */}
      {showValue && (
        <div className="absolute top-0 inset-x-0 flex items-center justify-center pointer-events-none">
          <motion.span
            style={{
              opacity,
              scale: useTransform(scale, [1, 1.2], [1, 1.1]),
            }}
            className="font-mono text-xs font-semibold text-white/80 tracking-wider select-none"
          >
            {Math.round(currentValue)}
          </motion.span>
        </div>
      )}

      <motion.div
        onHoverStart={() => animate(scale, 1.2, { duration: 0.2 })}
        onHoverEnd={() => animate(scale, 1, { duration: 0.2 })}
        onTouchStart={() => animate(scale, 1.2, { duration: 0.2 })}
        onTouchEnd={() => animate(scale, 1, { duration: 0.2 })}
        style={{
          scale,
          opacity,
        }}
        className="flex w-full touch-none select-none items-center justify-center gap-3"
      >
        <motion.div
          animate={{
            scale: region === 'left' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{
            x: leftIconX,
          }}
          className="shrink-0 text-white/50 hover:text-white cursor-pointer transition-colors p-0.5"
          onClick={() => {
            setRegion('left');
            updateValue(currentValue - (stepSize > 1 ? stepSize : 5));
            animate(overflow, [0, 15, 0], { duration: 0.25 });
          }}
        >
          {leftIcon}
        </motion.div>

        <div
          ref={sliderRef}
          className="relative flex w-full max-w-xs flex-grow cursor-grab active:cursor-grabbing touch-none select-none items-center py-2"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          {/* Accessible range input for Gamepad D-pad & Keyboard spatial navigation */}
          <input
            type="range"
            min={startingValue}
            max={maxValue}
            step={stepSize}
            value={currentValue}
            disabled={disabled}
            onChange={(e) => updateValue(Number(e.target.value))}
            className="sr-only"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                updateValue(currentValue - (stepSize > 1 ? stepSize : 5));
              } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                updateValue(currentValue + (stepSize > 1 ? stepSize : 5));
              }
            }}
          />

          <motion.div
            style={{
              scaleX,
              scaleY,
              transformOrigin,
              height,
              marginTop,
              marginBottom,
            }}
            className="flex flex-grow"
          >
            <div className="relative h-full flex-grow overflow-hidden rounded-full bg-white/15">
              <div
                className="absolute h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${getRangePercentage()}%`,
                  background: 'rgb(var(--launcher-accent, 255, 255, 255))',
                  boxShadow: '0 0 10px rgb(var(--launcher-accent, 255, 255, 255) / 0.5)',
                }}
              />
            </div>
          </motion.div>
        </div>

        <motion.div
          animate={{
            scale: region === 'right' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{
            x: rightIconX,
          }}
          className="shrink-0 text-white/50 hover:text-white cursor-pointer transition-colors p-0.5"
          onClick={() => {
            setRegion('right');
            updateValue(currentValue + (stepSize > 1 ? stepSize : 5));
            animate(overflow, [0, 15, 0], { duration: 0.25 });
          }}
        >
          {rightIcon}
        </motion.div>
      </motion.div>
    </div>
  );
};

function decay(value: number, max: number): number {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}

export default ElasticSlider;
