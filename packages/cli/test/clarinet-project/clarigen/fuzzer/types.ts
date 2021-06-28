import { ClarityTypes, Transaction } from '@clarigen/core';

// prettier-ignore
export interface FuzzerContract {
  getName: () => Transaction<string, null>;
  getNumber: () => Promise<number>;
  ERR_SOMETHING: () => Promise<number>;
  myVar: () => Promise<number>;
  basicMap: (key: number) => Promise<boolean | null>;
  tupleMap: (key: {
  "a": string
    }) => Promise<{
  "b": number
    } | null>;
}
