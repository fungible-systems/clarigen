import { Client, NativeClarityBinProvider } from '@blockstack/clarity';
import {
  ClarityValue,
  cvToString,
  deserializeCV,
  parseToCV,
  responseErrorCV,
  responseOkCV,
} from '@stacks/transactions';
import { ClarityAbiFunction } from '@stacks/transactions/dist/transactions/src/contract-abi';
import { Submitter, Transaction, TransactionResult } from '../../transaction';
import { evalJson, executeJson, Allocation, createClarityBin } from './utils';
export { Allocation, createClarityBin } from './utils';
import { Contract, ContractInstances, Contracts } from '../../types';

interface CreateOptions {
  allocations?: Allocation[];
  contractIdentifier: string;
  contractFilePath: string;
  clarityBin: NativeClarityBinProvider;
}

interface FromContractOptions<T> {
  contract: Contract<T>;
  clarityBin: NativeClarityBinProvider;
}

export class TestProvider {
  clarityBin: NativeClarityBinProvider;
  client: Client;

  constructor(clarityBin: NativeClarityBinProvider, client: Client) {
    this.clarityBin = clarityBin;
    this.client = client;
  }

  static async create({ clarityBin, contractFilePath, contractIdentifier }: CreateOptions) {
    const client = new Client(contractIdentifier, contractFilePath, clarityBin);
    await client.deployContract();
    return new this(clarityBin, client);
  }

  static async fromContract<T>({ contract, clarityBin }: FromContractOptions<T>) {
    const { address } = contract;
    if (!address) {
      throw new Error('TestProvider must have an address');
    }
    const provider = await this.create({
      clarityBin,
      contractFilePath: contract.contractFile,
      contractIdentifier: `${address}.router`,
    });
    return contract.contract(provider);
  }

  static async fromContracts<T extends Contracts<M>, M>(
    contracts: T
  ): Promise<ContractInstances<T, M>> {
    const clarityBin = await createClarityBin();
    const instances = {} as ContractInstances<T, M>;
    for (const k in contracts) {
      const contract = contracts[k];
      const instance = this.fromContract({
        contract,
        clarityBin,
      });
      instances[k] = instance as ReturnType<T[typeof k]['contract']>;
    }
    return instances;
  }

  async callReadOnly(func: ClarityAbiFunction, args: any[]): Promise<ClarityValue> {
    const argsFormatted = this.formatArguments(func, args);
    const result = await evalJson({
      contractAddress: this.client.name,
      functionName: func.name,
      args: argsFormatted,
      provider: this.clarityBin,
    });
    const resultCV = deserializeCV(Buffer.from(result.result_raw, 'hex'));
    return resultCV;
  }

  callPublic(func: ClarityAbiFunction, args: any[]): Transaction<ClarityValue, ClarityValue> {
    const argsFormatted = this.formatArguments(func, args);
    const submit: Submitter<ClarityValue, ClarityValue> = async options => {
      if (!options?.sender) {
        throw new Error('Passing `sender` is required.');
      }
      const receipt = await executeJson({
        provider: this.clarityBin,
        contractAddress: this.client.name,
        senderAddress: options.sender,
        functionName: func.name,
        args: argsFormatted,
      });
      const getResult = (): Promise<TransactionResult<ClarityValue, ClarityValue>> => {
        const resultCV = deserializeCV(Buffer.from(receipt.result_raw, 'hex'));
        if (receipt.success) {
          return Promise.resolve({
            isOk: true,
            response: responseOkCV(resultCV),
            value: resultCV,
          });
        } else {
          return Promise.resolve({
            isOk: false,
            response: responseErrorCV(resultCV),
            value: resultCV,
          });
        }
      };
      return {
        getResult,
      };
    };
    return {
      submit,
    };
  }

  formatArguments(func: ClarityAbiFunction, args: any[]): string[] {
    return args.map((arg, index) => {
      const { type } = func.args[index];
      const argCV = parseToCV(arg, type);
      const cvString = cvToString(argCV);
      if (type === 'principal') {
        return `'${cvString}`;
      }
      return cvString;
    });
  }
}
