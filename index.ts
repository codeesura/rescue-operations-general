
import { FlashbotService } from './services/flashbot-service';
import { logger } from './logger';
import ethers from "ethers";

async function main() {
  const flashbotService = new FlashbotService();
  
  const inputData = "0x1234...";
  const amount = (ethers.utils.parseEther("2677.5")).toString();

  flashbotService.subscribeToBlocks(async (blockNumber) => {
    try {
      const bundle = await flashbotService.createBundle(blockNumber, inputData, amount);
      await flashbotService.sendBundleToRelayers(bundle, blockNumber);
    } catch (error) {
      logger.error('Error processing block', { blockNumber, error });
    }
  });
}

main().catch((error) => {
  logger.error('Application failed to start', { error });
  process.exit(1);
});