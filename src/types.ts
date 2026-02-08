import type {ReactNode, ButtonHTMLAttributes} from 'react'
import type {IconDefinition} from '@fortawesome/fontawesome-svg-core'

// Core domain types

export interface ScrollDetails {
  uuid: string;
  scrollPosition: number;
  viewportHeight: number;
  contentHeight: number;
  dateISO: string;
  name: string;
  note: string;
}

export interface PageData {
  scrolls: ScrollDetails[];
  title: string | null;
}

export type PageDetailsByURL = Record<string, PageData>;

// React context type for the popup
export interface BootContextValue {
  activeTab: chrome.tabs.Tab;
  absoluteURL: string;
  pageData: PageData;
  setPageData: (data: PageData) => void;
  patchScroll: (uuid: string, patch: Partial<ScrollDetails>) => void;
}

// Component props

export interface GenericScrollProps {
  scrollDetails: ScrollDetails;
  onJump: () => void;
  pageData: PageData;
  setPageData: (data: PageData) => void;
  patchScroll: (uuid: string, patch: Partial<ScrollDetails>) => void;
}

export interface SortableScrollListProps {
  children: ReactNode[];
  pageData: PageData;
  setPageData: (data: PageData) => void;
}

export interface TextInputProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  type?: 'input' | 'textarea';
  className?: string;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  icon?: IconDefinition;
}

// Hook return type
export type UsePageDataStateReturn = [
  PageData,
  (data: PageData) => void,
  (uuid: string, patch: Partial<ScrollDetails>) => void
];
