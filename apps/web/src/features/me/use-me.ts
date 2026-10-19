import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { UserDto } from "@/lib/shared/contracts/users";

export const ME_KEY = ["me"] as const;

/** The signed-in user (GET /api/me), shared by the profile and security screens. */
export const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: () => api<UserDto>("/api/me") });
