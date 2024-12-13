import { ethers } from "ethers";
import axios from "axios";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import type { SimulationResponse } from "@flashbots/ethers-provider-bundle";
import { config } from "../config";
import { logger } from "../logger";

export class FlashbotService {
  private provider: ethers.providers.JsonRpcProvider;
  private safeWallet: ethers.Wallet;
  private hackWallet: ethers.Wallet;
  private gasEstimatesCache: any = null;
  private lastGasUpdateBlock: number = 0;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    this.safeWallet = new ethers.Wallet(
      process.env.PRIVATE_KEY_SAFE_WALLET!,
      this.provider
    );
    this.hackWallet = new ethers.Wallet(
      process.env.PRIVATE_KEY_HACK_WALLET!,
      this.provider
    );

    logger.info("FlashbotService initialized.");
  }

  async createBundle(blockNumber: number, inputData: string, amount: string) {
    try {
      logger.info("Creating bundle...");
      const gasEstimates = await this.getCachedGasEstimates(
        inputData,
        amount,
        blockNumber
      );
      const block = await this.provider.getBlock(blockNumber);
      const gasPrice = block.baseFeePerGas!;

      const bundle = await this.buildTransactionBundle(
        inputData,
        amount,
        gasEstimates,
        gasPrice
      );

      logger.info("Bundle created successfully.");
      return bundle;
    } catch (error) {
      logger.error(`Error creating bundle`, error);
      throw error;
    }
  }

  async sendBundleToRelayers(bundle: any[], blockNumber: number) {
    logger.info("Sending bundle to relayers...");
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      this.provider,
      ethers.Wallet.createRandom()
    );
    const signedTransactions = await flashbotsProvider.signBundle(bundle);
    const simulationResponse: SimulationResponse =
      await flashbotsProvider.simulate(signedTransactions, "latest");

    if ("error" in simulationResponse) {
      logger.error(`Simulation error: ${simulationResponse.error.message}`);
    }

    const bundlePromises = config.RELAYERS.map(async (relayerUrl) => {
      try {
        const flashbotsProvider = await FlashbotsBundleProvider.create(
          this.provider,
          this.safeWallet,
          relayerUrl
        );
        const result = await flashbotsProvider.sendBundle(
          bundle,
          blockNumber + 1
        );
        logger.info(`Bundle sent to ${relayerUrl}`);
        return result;
      } catch (error) {
        return null;
      }
    });

    await Promise.all(bundlePromises);

    const flashbotsResponse = await flashbotsProvider.sendBundle(
      bundle,
      blockNumber + 1
    );
    if ("error" in flashbotsResponse) {
      logger.error(`Error sending bundle: ${flashbotsResponse.error.message}`);
      return;
    }
    const resolution = await flashbotsResponse.wait();
    if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      logger.info("Transaction confirmed on chain.");
      process.exit(0);
    }
  }

  private async getCachedGasEstimates(
    inputData: string,
    amount: string,
    blockNumber: number
  ) {
    if (this.gasEstimatesCache && blockNumber < this.lastGasUpdateBlock + 20) {
      logger.info("Using cached gas estimates.");
      return this.gasEstimatesCache;
    }

    logger.info("Estimating gas for bundle...");
    this.gasEstimatesCache = await this.estimateGasBundle(inputData, amount);
    this.lastGasUpdateBlock = blockNumber;
    return this.gasEstimatesCache;
  }

  private async estimateGasBundle(inputData: string, amount: string) {
    logger.info("Estimating gas for bundle...");
    const estimateBundle = [
      {
        from: this.safeWallet.address,
        to: this.hackWallet.address,
        data: "0x",
        value: ethers.utils.parseEther("0.01").toHexString(),
      },
      {
        from: this.hackWallet.address,
        to: config.CLAIM_CONTRACT_ADDRESS,
        data: inputData,
      },
      {
        from: this.hackWallet.address,
        to: config.TOKEN_CONTRACT_ADDRESS,
        data: new ethers.utils.Interface([
          "function transfer(address recipient, uint256 amount)",
        ]).encodeFunctionData("transfer", [this.safeWallet.address, amount]),
      },
    ];

    try {
      const response = await axios.post(
        config.TENDERLY_URL,
        {
          jsonrpc: "2.0",
          id: 0,
          method: "tenderly_estimateGasBundle",
          params: [estimateBundle, "latest"],
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      logger.info("Gas estimate completed.");
      return response.data.result;
    } catch (error) {
      logger.error(`Error estimating gas: ${error}`);
      throw error;
    }
  }

  private async buildTransactionBundle(
    inputData: string,
    amount: string,
    gasEstimates: any,
    gasPrice: ethers.BigNumber
  ) {
    logger.info("Building transaction bundle...");

    const gasLimit = ethers.BigNumber.from(gasEstimates[1].gas).add(
      ethers.BigNumber.from(gasEstimates[2].gas)
    );

    const hackWalletBalance = await this.provider.getBalance(
      this.hackWallet.address
    );
    const gasFee = gasLimit.mul(gasPrice);
    const amountToSend = gasFee.sub(hackWalletBalance).gt(0)
      ? gasFee.sub(hackWalletBalance)
      : ethers.BigNumber.from(0);

    logger.info("Transaction bundle built successfully.");

    return [
      {
        transaction: {
          chainId: config.CHAIN_ID,
          to: this.hackWallet.address,
          value: amountToSend,
          type: 2,
          gasLimit: 21000,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
        },
        signer: this.safeWallet,
      },
      {
        transaction: {
          chainId: config.CHAIN_ID,
          to: config.CLAIM_CONTRACT_ADDRESS,
          data: inputData,
          type: 2,
          gasLimit: gasEstimates[1].gas,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
        },
        signer: this.hackWallet,
      },
      {
        transaction: {
          chainId: config.CHAIN_ID,
          to: config.TOKEN_CONTRACT_ADDRESS,
          data: new ethers.utils.Interface([
            "function transfer(address recipient, uint256 amount)",
          ]).encodeFunctionData("transfer", [this.safeWallet.address, amount]),
          type: 2,
          gasLimit: gasEstimates[2].gas,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
        },
        signer: this.hackWallet,
      },
    ];
  }

  subscribeToBlocks(callback: (blockNumber: number) => Promise<void>) {
    this.provider.on("block", callback);
  }
}