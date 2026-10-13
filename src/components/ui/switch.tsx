'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'
import { usePreferences } from '../../context/PreferencesContext'
import { useSoundEffects } from '../../hooks/useSoundEffects'

function Switch({
  className,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const { effectsVolume, soundTheme } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);

  const [isInit, setIsInit] = React.useState(false);

  const handleCheckedChange = (nextChecked: boolean) => {
    setIsInit(true);
    playSound(nextChecked ? "switchOn" : "switchOff");
    onCheckedChange?.(nextChecked);
  };

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={handleCheckedChange}
      className={cn(
        't-toggle peer inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-[var(--node)] border-4 border-transparent [--toggle-travel:20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tone-0)] disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-[var(--ink)] data-[state=unchecked]:bg-[var(--tone-4)]',
        isInit ? 'is-init' : '',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="t-toggle-thumb pointer-events-none block h-6 w-6 rounded-[var(--node)] data-[state=checked]:bg-[var(--tone-0)] data-[state=unchecked]:bg-[var(--ink)]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
