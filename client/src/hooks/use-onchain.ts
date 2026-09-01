import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { ACTIVE_CHAIN } from "@/lib/moonball-contracts";

// ─── Wallet ─────────────────────────────────────────────────────────────
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToActiveChain: () => Promise<void>;
  getSigner: () => Promise<any>;
}

export function useWallet(): WalletState {
  const hasWallet = typeof window !== "undefined" && !!window.ethereum;
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
    } catch {
      /* ignore */
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("No Ethereum wallet found. Install MetaMask or Coinbase Wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0] ?? null);
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
      localStorage.removeItem("wallet_disconnected");
    } catch (e: any) {
      setError(e?.message || "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
    localStorage.setItem("wallet_disconnected", "1");
  }, []);

  const switchToActiveChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request?.({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ACTIVE_CHAIN.hexId }],
      });
    } catch (e: any) {
      // 4902 = chain not added to wallet
      if (e?.code === 4902) {
        await window.ethereum.request?.({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: ACTIVE_CHAIN.hexId,
              chainName: ACTIVE_CHAIN.name,
              nativeCurrency: {
                name: ACTIVE_CHAIN.nativeSymbol,
                symbol: ACTIVE_CHAIN.nativeSymbol,
                decimals: 18,
              },
              rpcUrls: [ACTIVE_CHAIN.rpcUrl],
              blockExplorerUrls: ACTIVE_CHAIN.explorer ? [ACTIVE_CHAIN.explorer] : [],
            },
          ],
        });
      } else {
        setError(e?.message || "Failed to switch network.");
      }
    }
    await refreshChain();
  }, [refreshChain]);

  const getSigner = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet available.");
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }, []);

  // React to account / chain changes from the wallet.
  useEffect(() => {
    if (!window.ethereum?.on) return;
    const onAccounts = (accounts: string[]) => setAddress(accounts[0] ?? null);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    // Pick up an already-authorized session without prompting,
    // but only if the user hasn't explicitly disconnected.
    if (!localStorage.getItem("wallet_disconnected")) {
      new BrowserProvider(window.ethereum)
        .send("eth_accounts", [])
        .then((accts: string[]) => {
          if (accts?.[0]) {
            setAddress(accts[0]);
            refreshChain();
          }
        })
        .catch(() => {});
    }
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, [refreshChain]);

  const isWrongNetwork = address != null && chainId != null && chainId !== ACTIVE_CHAIN.id;

  return {
    address,
    chainId,
    connecting,
    error,
    hasWallet,
    isWrongNetwork,
    connect,
    disconnect,
    switchToActiveChain,
    getSigner,
  };
}

