import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { api } from "@/api";
import { type GenericId as Id } from "convex/values";
import { useQuery } from "convex/react";

export function useStorageUrl(storageId: Id<"_storage"> | undefined) {
  return useQuery(api.storage.getUrl, storageId ? { storageId } : "skip");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
