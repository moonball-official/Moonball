import { getAddress, isAddress, ZeroAddress } from "ethers";

/** Resolve a public address for read-only checks, without requiring a key. */
export function resolvePreflightDeployer(
  explicitAddress?: string,
  signerAddress?: string
): string {
  function normalize(name: string, value?: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    if (!isAddress(trimmed) || getAddress(trimmed) === ZeroAddress) {
      throw new Error(`${name} must be a valid nonzero address.`);
    }
    return getAddress(trimmed);
  }

  const explicit = normalize("DEPLOYER_ADDRESS", explicitAddress);
  const signer = normalize("Deployer signer", signerAddress);
  if (explicit && signer && explicit !== signer) {
    throw new Error("DEPLOYER_ADDRESS does not match the configured deployer signer.");
  }
  const address = explicit ?? signer;
  if (!address) {
    throw new Error(
      "Set DEPLOYER_ADDRESS to the public deployer address for read-only preflight; no private key is required."
    );
  }
  return address;
}
