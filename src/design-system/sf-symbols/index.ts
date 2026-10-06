export * from "./types";
export * from "./sfSymbolsMap";
export * from "./SfSymbol";

import { createSfSymbolIcon, createAnimatedSfSymbol } from "./SfSymbol";

// Core Navigation SF Symbol Icons (Static)
export const SfGamepadIcon = createSfSymbolIcon("gamecontroller", "gamecontroller.fill");
export const SfStarIcon = createSfSymbolIcon("star", "star.fill");
export const SfUsersIcon = createSfSymbolIcon("person.2", "person.2.fill");
export const SfRadarIcon = createSfSymbolIcon("dot.radiowaves.left.and.right");
export const SfHammerIcon = createSfSymbolIcon("hammer", "hammer.fill");
export const SfComputerIcon = createSfSymbolIcon("desktopcomputer");
export const SfUserIcon = createSfSymbolIcon("person.crop.circle", "person.crop.circle.fill");
export const SfTrophyIcon = createSfSymbolIcon("rosette");
export const SfGearIcon = createSfSymbolIcon("gear");
export const SfFolderIcon = createSfSymbolIcon("folder");
export const SfFolderOpenIcon = createSfSymbolIcon("folder.fill");

// Genre & Category SF Symbol Icons
export const SfCarIcon = createSfSymbolIcon("car", "car.fill");
export const SfShieldIcon = createSfSymbolIcon("shield", "shield.fill");
export const SfGlobeIcon = createSfSymbolIcon("globe");
export const SfScopeIcon = createSfSymbolIcon("scope");
export const SfFlameIcon = createSfSymbolIcon("flame", "flame.fill");
export const SfMapIcon = createSfSymbolIcon("map", "map.fill");
export const SfBoltIcon = createSfSymbolIcon("bolt", "bolt.fill");
export const SfSlidersIcon = createSfSymbolIcon("slider.horizontal.3");
export const SfWandIcon = createSfSymbolIcon("wand.and.stars");
export const SfFlagIcon = createSfSymbolIcon("flag", "flag.fill");
export const SfSparklesIcon = createSfSymbolIcon("sparkles");
export const SfSidebarToggleIcon = createSfSymbolIcon("sidebar.left");

// Apple Spring Animated SF Symbol Icons
export const SfAnimatedGamepadIcon = createAnimatedSfSymbol("gamecontroller", "gamecontroller.fill", "bounce");
export const SfAnimatedStarIcon = createAnimatedSfSymbol("star", "star.fill", "scale");
export const SfAnimatedUsersIcon = createAnimatedSfSymbol("person.2", "person.2.fill", "bounce");
export const SfAnimatedRadarIcon = createAnimatedSfSymbol("dot.radiowaves.left.and.right", undefined, "pulse");
export const SfAnimatedHammerIcon = createAnimatedSfSymbol("hammer", "hammer.fill", "bounce");
export const SfAnimatedComputerIcon = createAnimatedSfSymbol("desktopcomputer", undefined, "scale");
export const SfAnimatedUserIcon = createAnimatedSfSymbol("person.crop.circle", "person.crop.circle.fill", "bounce");
export const SfAnimatedGearIcon = createAnimatedSfSymbol("gear", undefined, "rotate");
