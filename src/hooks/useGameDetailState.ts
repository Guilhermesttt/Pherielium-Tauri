import React from "react";
import type { GameDetailState, GameDetailAction, AchievementFilter } from "../types/gameDetail";

const initialDetailState = (defaultTab: string): GameDetailState => ({
  activeTab: defaultTab,
  isLaunching: false,
  launchError: null,
  galleryModalOpen: false,
  currentGalleryIndex: 0,
  deleteModalOpen: false,
  isDeleting: false,
  deleteConfirmText: "",
  achievementFilter: "all",
  achievementSearch: "",
  debouncedAchievementSearch: "",
  isAddAchModalOpen: false,
  newAchName: "",
  newAchDesc: "",
  isSavingLaunchProfile: false,
});

function gameDetailReducer(state: GameDetailState, action: GameDetailAction): GameDetailState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    case "SET_LAUNCHING":
      return { ...state, isLaunching: action.payload };
    case "SET_LAUNCH_ERROR":
      return { ...state, launchError: action.payload };
    case "OPEN_GALLERY":
      return {
        ...state,
        galleryModalOpen: true,
        currentGalleryIndex: action.payload ?? state.currentGalleryIndex,
      };
    case "CLOSE_GALLERY":
      return { ...state, galleryModalOpen: false };
    case "SET_GALLERY_INDEX":
      return { ...state, currentGalleryIndex: action.payload };
    case "OPEN_DELETE_MODAL":
      return { ...state, deleteModalOpen: true, deleteConfirmText: "" };
    case "CLOSE_DELETE_MODAL":
      return { ...state, deleteModalOpen: false, deleteConfirmText: "" };
    case "SET_DELETE_CONFIRM_TEXT":
      return { ...state, deleteConfirmText: action.payload };
    case "SET_DELETING":
      return { ...state, isDeleting: action.payload };
    case "SET_ACHIEVEMENT_FILTER":
      return { ...state, achievementFilter: action.payload };
    case "SET_ACHIEVEMENT_SEARCH":
      return { ...state, achievementSearch: action.payload };
    case "SET_DEBOUNCED_SEARCH":
      return { ...state, debouncedAchievementSearch: action.payload };
    case "OPEN_ADD_ACH_MODAL":
      return { ...state, isAddAchModalOpen: true };
    case "CLOSE_ADD_ACH_MODAL":
      return { ...state, isAddAchModalOpen: false, newAchName: "", newAchDesc: "" };
    case "SET_NEW_ACH_NAME":
      return { ...state, newAchName: action.payload };
    case "SET_NEW_ACH_DESC":
      return { ...state, newAchDesc: action.payload };
    case "SET_SAVING_LAUNCH_PROFILE":
      return { ...state, isSavingLaunchProfile: action.payload };
    case "RESET_FOR_GAME":
      return {
        ...initialDetailState(action.payload.defaultTab),
      };
    default:
      return state;
  }
}

export function useGameDetailState(defaultTab: string) {
  const [state, dispatch] = React.useReducer(
    gameDetailReducer,
    defaultTab,
    initialDetailState
  );

  // Debounce para busca de conquistas
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch({ type: "SET_DEBOUNCED_SEARCH", payload: state.achievementSearch });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state.achievementSearch]);

  const setActiveTab = React.useCallback((tab: string) => {
    dispatch({ type: "SET_TAB", payload: tab });
  }, []);

  const setLaunching = React.useCallback((launching: boolean) => {
    dispatch({ type: "SET_LAUNCHING", payload: launching });
  }, []);

  const setLaunchError = React.useCallback((err: string | null) => {
    dispatch({ type: "SET_LAUNCH_ERROR", payload: err });
  }, []);

  const openGallery = React.useCallback((index?: number) => {
    dispatch({ type: "OPEN_GALLERY", payload: index });
  }, []);

  const closeGallery = React.useCallback(() => {
    dispatch({ type: "CLOSE_GALLERY" });
  }, []);

  const setGalleryIndex = React.useCallback((index: number) => {
    dispatch({ type: "SET_GALLERY_INDEX", payload: index });
  }, []);

  const openDeleteModal = React.useCallback(() => {
    dispatch({ type: "OPEN_DELETE_MODAL" });
  }, []);

  const closeDeleteModal = React.useCallback(() => {
    dispatch({ type: "CLOSE_DELETE_MODAL" });
  }, []);

  const setDeleteConfirmText = React.useCallback((text: string) => {
    dispatch({ type: "SET_DELETE_CONFIRM_TEXT", payload: text });
  }, []);

  const setDeleting = React.useCallback((deleting: boolean) => {
    dispatch({ type: "SET_DELETING", payload: deleting });
  }, []);

  const setAchievementFilter = React.useCallback((filter: AchievementFilter) => {
    dispatch({ type: "SET_ACHIEVEMENT_FILTER", payload: filter });
  }, []);

  const setAchievementSearch = React.useCallback((query: string) => {
    dispatch({ type: "SET_ACHIEVEMENT_SEARCH", payload: query });
  }, []);

  const openAddAchModal = React.useCallback(() => {
    dispatch({ type: "OPEN_ADD_ACH_MODAL" });
  }, []);

  const closeAddAchModal = React.useCallback(() => {
    dispatch({ type: "CLOSE_ADD_ACH_MODAL" });
  }, []);

  const resetForGame = React.useCallback((tab: string) => {
    dispatch({ type: "RESET_FOR_GAME", payload: { defaultTab: tab } });
  }, []);

  return {
    state,
    dispatch,
    setActiveTab,
    setLaunching,
    setLaunchError,
    openGallery,
    closeGallery,
    setGalleryIndex,
    openDeleteModal,
    closeDeleteModal,
    setDeleteConfirmText,
    setDeleting,
    setAchievementFilter,
    setAchievementSearch,
    openAddAchModal,
    closeAddAchModal,
    resetForGame,
  };
}
