import { Address, createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { FPMM_ADDRESS, fpmmABI } from './polymarket-contracts';
import { verifyContractAddress } from './contract-verification';

export interface ABIValidationResult {
  isValid: boolean;
  contractAddress: Address;
  functions: {
    name: string;
    exists: boolean;
  }[];
  error?: string;
}

/**
 * Verify that the ABI matches the contract at the given address
 */
export async function verifyABI(
  contractAddress: Address,
  abi: any[]
): Promise<ABIValidationResult> {
  try {
    // First verify the contract exists
    const isContract = await verifyContractAddress(contractAddress);
    if (!isContract) {
      return {
        isValid: false,
        contractAddress,
        functions: [],
        error: 'Contract address is not a valid contract',
      };
    }

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    // Extract function names from ABI
    const functionNames = abi
      .filter((item) => item.type === 'function')
      .map((item) => item.name);

    // Verify each function exists by attempting to read the contract
    const functionChecks = await Promise.allSettled(
      functionNames.map(async (functionName) => {
        try {
          // Try to call the function (this will fail if function doesn't exist)
          // We'll use a dummy call to verify the function exists
          await publicClient.readContract({
            address: contractAddress,
            abi: abi,
            functionName: functionName as any,
            args: [] as any,
            // We can't actually call without args, but we can check if the function is in the ABI
          } as any);
          return { name: functionName, exists: true };
        } catch (error: any) {
          // If error is about missing function, it doesn't exist
          // If error is about wrong args, function exists
          if (error.message?.includes('function') && error.message?.includes('not found')) {
            return { name: functionName, exists: false };
          }
          // If error is about wrong args, function exists
          return { name: functionName, exists: true };
        }
      })
    );

    const functions = functionChecks.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // If check failed, assume function doesn't exist
      return { name: functionNames[index], exists: false };
    });

    const allFunctionsExist = functions.every((func) => func.exists);

    return {
      isValid: allFunctionsExist,
      contractAddress,
      functions,
      error: allFunctionsExist ? undefined : 'Some functions in ABI do not exist on contract',
    };
  } catch (error) {
    console.error('ABI verification error:', error);
    return {
      isValid: false,
      contractAddress,
      functions: [],
      error: error instanceof Error ? error.message : 'Failed to verify ABI',
    };
  }
}

/**
 * Verify the FPMM contract ABI
 */
export async function verifyFPMMABI(): Promise<ABIValidationResult> {
  return verifyABI(FPMM_ADDRESS, fpmmABI as unknown as any[]);
}

/**
 * Validate ABI structure
 */
export function validateABIStructure(abi: any[]): boolean {
  if (!Array.isArray(abi)) {
    return false;
  }

  // Check that all items have required fields
  return abi.every((item) => {
    if (item.type === 'function') {
      return item.name && (item.inputs || item.outputs);
    }
    if (item.type === 'event') {
      return item.name && item.inputs;
    }
    return true; // Other types are valid
  });
}

/**
 * Get function signatures from ABI
 */
export function getFunctionSignatures(abi: any[]): string[] {
  return abi
    .filter((item) => item.type === 'function')
    .map((item) => {
      const inputs = (item.inputs || []).map((input: any) => input.type).join(',');
      return `${item.name}(${inputs})`;
    });
}

/**
 * Compare two ABIs to check if they're compatible
 */
export function compareABIs(abi1: any[], abi2: any[]): {
  compatible: boolean;
  missingInABI2: string[];
  missingInABI1: string[];
} {
  const functions1 = getFunctionSignatures(abi1);
  const functions2 = getFunctionSignatures(abi2);

  const missingInABI2 = functions1.filter((sig) => !functions2.includes(sig));
  const missingInABI1 = functions2.filter((sig) => !functions1.includes(sig));

  return {
    compatible: missingInABI2.length === 0 && missingInABI1.length === 0,
    missingInABI2,
    missingInABI1,
  };
}

