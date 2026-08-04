import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteAccount, logout, signIn, signUp } from "@/api/rewardly";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession
} from "@/api/authSession";

export function useAuthSession() {
  return useQuery({
    queryKey: ["authSession"],
    queryFn: getStoredAuthSession,
    staleTime: 1000 * 60 * 5
  });
}

export function useAuthActions() {
  const queryClient = useQueryClient();

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async (session) => {
      await setStoredAuthSession(session);
      queryClient.setQueryData(["authSession"], session);
      await queryClient.invalidateQueries();
    }
  });

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async (session) => {
      await setStoredAuthSession(session);
      queryClient.setQueryData(["authSession"], session);
      await queryClient.invalidateQueries();
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const session = await getStoredAuthSession();
      await logout(session?.refreshToken);
      await clearStoredAuthSession();
    },
    onSuccess: async () => {
      queryClient.clear();
      queryClient.setQueryData(["authSession"], null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await clearStoredAuthSession();
    },
    onSuccess: async () => {
      queryClient.clear();
      queryClient.setQueryData(["authSession"], null);
    }
  });

  return {
    signIn: signInMutation,
    signUp: signUpMutation,
    logout: logoutMutation,
    deleteAccount: deleteMutation
  };
}
