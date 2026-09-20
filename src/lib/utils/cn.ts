import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Teach tailwind-merge our custom type scale (text-11 … text-26) so it isn't treated as a colour. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["11", "12", "13", "14", "15", "16", "18", "22", "26"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
