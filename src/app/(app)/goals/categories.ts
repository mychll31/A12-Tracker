import type { GoalCategoryKey } from "@/lib/domain";

/**
 * `goalCategories.name` in the database is org-editable copy. These are the
 * fixed labels the UI filters and forms are written against, so a renamed row
 * never turns "Contribution" into an unfilterable chip.
 */
export const GOAL_CATEGORY_LABELS: Record<GoalCategoryKey, string> = {
  PERSONAL: "Personal",
  PROFESSIONAL: "Professional",
  CONTRIBUTION: "Contribution",
};
