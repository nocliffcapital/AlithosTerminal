// Polymarket smart contract addresses and ABIs
import { Address, parseAbi } from 'viem';

// Polygon Mainnet
export const POLYGON_CHAIN_ID = 137;

// Polymarket Conditional Tokens Contract
export const CONDITIONAL_TOKENS_ADDRESS: Address =
  '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

// Polymarket Fixed Product Market Maker
export const FPMM_ADDRESS: Address =
  '0x89CbC02fE62F56B6e8bA0Cbd3b30FcB8C9Dc8fD4';

// USDC on Polygon
export const USDC_ADDRESS: Address =
  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

// Conditional Tokens ABI (simplified - key functions only)
export const conditionalTokensABI = parseAbi([
  'function getCollectionId(bytes32 conditionId, uint256 indexSet) external pure returns (bytes32)',
  'function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount) external',
  'function mergePositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount) external',
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets) external',
]);

// FPMM ABI (simplified - key trading functions)
export const fpmmABI = parseAbi([
  'function buy(uint256 investmentAmount, uint256 outcomeIndex, uint256 minOutcomeTokensToBuy) external returns (uint256 outcomeTokensBought, uint256 feeAmount)',
  'function sell(uint256 returnAmount, uint256 outcomeIndex, uint256 maxOutcomeTokensToSell) external returns (uint256 outcomeTokensSold, uint256 feeAmount)',
  'function calcBuyAmount(uint256 investmentAmount, uint256 outcomeIndex) external view returns (uint256)',
  'function calcSellAmount(uint256 returnAmount, uint256 outcomeIndex) external view returns (uint256)',
  'function getPoolBalances() external view returns (uint256[] memory)',
  'function getFeeAmount() external view returns (uint256)',
]);

// ERC20 ABI (for USDC)
export const erc20ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]);

export interface TradeParams {
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: bigint; // in USDC (with decimals)
  minOutcomeTokens?: bigint;
  maxOutcomeTokens?: bigint;
}

export interface TradeResult {
  success: boolean;
  transactionHash?: string;
  outcomeTokensBought?: bigint;
  feeAmount?: bigint;
  error?: string;
}

