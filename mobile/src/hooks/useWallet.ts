import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCardCatalog } from "@/api/rewardly";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { CatalogCard, WalletCard } from "@/types/rewardly";

const defaultWallet: WalletCard[] = [];

export function useCardCatalog() {
  return useQuery({
    queryKey: ["cardCatalog"],
    queryFn: fetchCardCatalog,
    staleTime: 1000 * 60 * 15
  });
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => getJson<WalletCard[]>(storageKeys.wallet, defaultWallet)
  });
}

export function useWalletActions() {
  const queryClient = useQueryClient();

  const saveWallet = useMutation({
    mutationFn: async (wallet: WalletCard[]) => {
      await setJson(storageKeys.wallet, wallet);
      return wallet;
    },
    onSuccess: (wallet) => {
      queryClient.setQueryData(["wallet"], wallet);
    }
  });

  return {
    addCard(card: CatalogCard) {
      const wallet = queryClient.getQueryData<WalletCard[]>(["wallet"]) || [];
      if (wallet.some((item) => item.cardId === card.cardId)) return;
      saveWallet.mutate([...wallet, card]);
    },
    removeCard(cardId: string) {
      const wallet = queryClient.getQueryData<WalletCard[]>(["wallet"]) || [];
      saveWallet.mutate(wallet.filter((card) => card.cardId !== cardId));
    },
    updateNickname(cardId: string, nickname: string) {
      const wallet = queryClient.getQueryData<WalletCard[]>(["wallet"]) || [];
      saveWallet.mutate(
        wallet.map((card) =>
          card.cardId === cardId ? { ...card, nickname: nickname.trim() } : card,
        ),
      );
    },
    replaceWallet(wallet: WalletCard[]) {
      saveWallet.mutate(wallet);
    },
    clearWallet() {
      saveWallet.mutate([]);
    },
    isSaving: saveWallet.isPending
  };
}
