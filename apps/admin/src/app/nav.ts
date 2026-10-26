/**
 * The menu now lives in @l-shopee/shared, so the back office and the Expo app can never show two
 * different menus (2026-10-25). This path stays so every existing import is untouched.
 */
export * from "@l-shopee/shared/nav";
