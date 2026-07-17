/**
 * The public surface of the Abundance Hub UI library.
 *
 * Re-exporting a "use client" module from here does not drag its neighbours
 * across the boundary — Next resolves that per module, so a server page can
 * still import Button and Card from this barrel without shipping their JS.
 */

export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
export type {
  CardContentProps,
  CardDescriptionProps,
  CardFooterProps,
  CardHeaderProps,
  CardProps,
  CardTitleProps,
} from "./card";

export { FormField, Input, Label, Textarea } from "./input";
export type {
  FormFieldProps,
  InputProps,
  LabelProps,
  TextareaProps,
} from "./input";

export { PasswordInput } from "./password-input";
export type { PasswordInputProps } from "./password-input";

export { Select } from "./select";
export type { SelectOption, SelectProps } from "./select";

export { Badge, StatusBadge } from "./badge";
export type {
  BadgeProps,
  BadgeSize,
  BadgeVariant,
  StatusBadgeProps,
} from "./badge";

export { ProgressBar, ScoreRing } from "./progress";
export type { ProgressBarProps, ScoreRingProps } from "./progress";

export { Avatar, AvatarGroup } from "./avatar";
export type { AvatarGroupProps, AvatarProps, AvatarSize } from "./avatar";

export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export type {
  TabsContentProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
} from "./tabs";

export { Modal } from "./modal";
export type { ModalProps, ModalSize } from "./modal";

export { ToastProvider, useToast } from "./toast";
export type {
  ToastOptions,
  ToastProviderProps,
  ToastRecord,
  ToastVariant,
} from "./toast";

export { Table, TBody, TD, TH, THead, TR } from "./table";
export type {
  TableProps,
  TBodyProps,
  TDProps,
  THeadProps,
  THProps,
  TRProps,
} from "./table";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

export { Skeleton, SkeletonCard } from "./skeleton";
export type { SkeletonCardProps, SkeletonProps } from "./skeleton";

export { StatCard } from "./stat";
export type { StatCardProps } from "./stat";

export { THEME_STORAGE_KEY, ThemeToggle } from "./theme-toggle";
export type { Theme, ThemeToggleProps } from "./theme-toggle";

export { Tooltip } from "./tooltip";
export type { TooltipProps, TooltipSide } from "./tooltip";
