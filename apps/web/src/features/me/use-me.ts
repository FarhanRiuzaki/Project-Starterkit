import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { MeDto } from "@/lib/shared/contracts/me";
import { ME_KEY } from "@/lib/shared/queries";

export { ME_KEY };

/** The signed-in user (GET /api/me), shared by the profile and security screens. */
export const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: () => api<MeDto>("/api/me") });
