# Rescue Operation's General

This project is designed to interact with the Ethereum blockchain using Flashbots for gas estimation and transaction bundling.

```bash
bun install
```

## Prerequisites
- Node.js
- Bun (v1.1.30 or later)
- An Ethereum node provider URL
- Environment variables for wallet private keys

## Installation
To install dependencies, run:

```bash
bun install
```

## Configuration
Create a `.env` file in the root directory and add the following environment variables:

## Running the Project
To run the project, execute:

```bash
bun start
```

## Project Structure
- `index.ts`: Entry point of the application.
- `config.ts`: Configuration file containing constants.
- `logger.ts`: Logger setup using Winston.
- `flashbot-service.ts`: Contains the `FlashbotService` class which handles gas estimation, transaction bundling, and sending bundles to relayers.

## Key Classes and Functions
- `FlashbotService`: Main service class.
    - `createBundle(blockNumber: number, inputData: string, amount: string)`: Creates a transaction bundle.
    - `sendBundleToRelayers(bundle: any[], blockNumber: number)`: Sends the transaction bundle to relayers.
    - `subscribeToBlocks(callback: (blockNumber: number) => Promise<void>)`: Subscribes to new blocks.

## Logging
Logs are stored in the `logs` directory:
- `combined.log`: Combined logs.
- `error.log`: Error logs.

## License
This project is licensed under the MIT License.