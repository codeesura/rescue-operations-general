interface Config {
  CHAIN_ID: number;
  RPC_URL: string;
  RELAYERS: string[];
  TENDERLY_URL: string;
  TOKEN_CONTRACT_ADDRESS: string;
  CLAIM_CONTRACT_ADDRESS: string;
}

export const config: Config = {
  CHAIN_ID: 1,
  RPC_URL: "https://ethereum-rpc.publicnode.com/",
  RELAYERS: [
    "https://rpc.titanbuilder.xyz",
    "https://mevshare-rpc.beaverbuild.org",
    "https://rsync-builder.xyz",
  ],
  TENDERLY_URL: "https://mainnet.gateway.tenderly.co/API-KEY",
  TOKEN_CONTRACT_ADDRESS: "TOKEN_CONTRACT_ADDRESS",
  CLAIM_CONTRACT_ADDRESS: "CLAIM_CONTRACT_ADDRESS",
};
