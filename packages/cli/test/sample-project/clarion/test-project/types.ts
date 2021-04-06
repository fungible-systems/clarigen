import { ClarityTypes, Transaction } from '@clarion/core';

export interface TestProjectContract {
  getName: () => Transaction<string, null>;
  getNumber: () => Promise<number>;
}
