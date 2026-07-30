"use client";

import { useCallback, useState } from "react";
import type { Address, Hash, WalletClient } from "viem";
import { erc20Abi } from "./abi";
import { DEPLOYMENT, publicClient } from "./chain";
import { describeError } from "./protocol";

/**
 * Running one or more transactions in order, and saying where we are.
 *
 * Borrowing here is two transactions, not one: ERC-20 has no way to let a
 * contract pull tokens without a prior `approve`, and `_pullCollateral` uses
 * `safeTransferFrom`. A screen that models this as a single "Borrow" button
 * either lies about progress or breaks the moment the first signature succeeds
 * and the second is refused — so the steps are explicit and the label says which
 * one is in the wallet right now.
 *
 * Every step simulates before it signs. `simulateContract` runs the call against
 * current state and throws the contract's own custom error, which
 * `describeError` turns into a sentence — so "that works out at 80.4%, past the
 * 80% limit" appears *before* the wallet popup rather than as a failed
 * transaction the visitor has already paid gas for.
 *
 * A mined receipt is checked for `status === "reverted"`. A transaction can be
 * included and still have failed; treating "we got a receipt" as success is how
 * a UI reports a loan that does not exist.
 */

export type TxPhase = "idle" | "signing" | "pending" | "done" | "error";

export type TxState = {
  phase: TxPhase;
  /** What is happening, in words — "Approving CASHCAT", "Opening the loan". */
  label?: string;
  hash?: Hash;
  error?: string;
  /** Which step of how many, for multi-step runs. */
  step: number;
  total: number;
};

export type Step = {
  label: string;
  run: () => Promise<Hash>;
};

const IDLE: TxState = { phase: "idle", step: 0, total: 0 };

export function useTx() {
  const [state, setState] = useState<TxState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const send = useCallback(async (steps: Step[]): Promise<boolean> => {
    for (let i = 0; i < steps.length; i++) {
      const { label, run } = steps[i];
      setState({ phase: "signing", label, step: i + 1, total: steps.length });
      let hash: Hash;
      try {
        hash = await run();
      } catch (e) {
        const error = describeError(e);
        // No message means the visitor closed the wallet prompt. Go quiet rather
        // than leaving a red box explaining their own decision back to them.
        setState(error ? { phase: "error", label, error, step: i + 1, total: steps.length } : IDLE);
        return false;
      }

      setState({ phase: "pending", label, hash, step: i + 1, total: steps.length });
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setState({
            phase: "error",
            label,
            hash,
            error: "The transaction was mined but reverted. Nothing changed.",
            step: i + 1,
            total: steps.length,
          });
          return false;
        }
      } catch {
        setState({
          phase: "error",
          label,
          hash,
          error: "Lost track of the transaction. Check the explorer before trying again.",
          step: i + 1,
          total: steps.length,
        });
        return false;
      }
    }

    setState((s) => ({ ...s, phase: "done" }));
    return true;
  }, []);

  return { state, send, reset };
}

/**
 * An approve step, but only when one is actually needed.
 *
 * Returns an empty list when the allowance already covers the amount, so a
 * second loan against the same coin is one signature rather than two.
 *
 * The approval is for exactly the amount being spent. An unlimited approval is
 * one signature cheaper forever and is the standing offer this contract would
 * need to be trusted with indefinitely — on a page whose whole argument is that
 * it does not ask for more than it needs, that trade is the wrong way round.
 */
export async function approvalStep(
  wallet: WalletClient,
  account: Address,
  token: Address,
  symbol: string,
  amount: bigint
): Promise<Step[]> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, DEPLOYMENT.lending],
  });
  if (allowance >= amount) return [];

  return [
    {
      label: `Approving ${symbol}`,
      run: async () => {
        const { request } = await publicClient.simulateContract({
          account,
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [DEPLOYMENT.lending, amount],
        });
        return wallet.writeContract(request);
      },
    },
  ];
}
