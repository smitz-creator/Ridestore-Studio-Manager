import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null, formatStr: string = "MMM d, yyyy") {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    try {
      return format(new Date(dateString), formatStr);
    } catch {
      return dateString;
    }
  }
}
