import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Append ImageKit transformation params so the browser downloads a resized,
// auto-format (WebP/AVIF) version sized for where it's shown.
export function ikUrl(url: string, tr: string) {
  if (!url) return url
  return url.includes("?") ? `${url}&tr=${tr}` : `${url}?tr=${tr}`
}
