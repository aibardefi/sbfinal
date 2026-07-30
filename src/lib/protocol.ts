"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  formatUnits,
  parseUnits,
  type Address,
} from "viem";
import { erc20Abi, lendingAbi } from "./abi";
import { DEPLOYMENT, publicClient } from "./chain";
import { coinColour, rosterEntry, rosterIndex } from "@/components/protocol/tokens";
import { MAX_LTV } from "./health";

/**
 * Everything the borrow screen reads from CBLending, and the arithmetic that
 * turns a ratio on a ruler into an amount the contract will accept.
 *
 * The screen holds no list of coins, no price and no inventory figure of its
 * own. `collateralTokens()` is the roster, `collateralConfigs()` says which of
 * them may still be borrowed against, and `quoteCollateralInWeth` /
 * `quoteCBInWeth` are the same TWAP reads `_positionLtv` uses to decide whether
 * a borrow reverts. Anything computed from a different source is a second
 * opinion the contract has not agreed to.
 */

export type CollateralToken = {
  address: Address;
  /** The roster's ticker where there is one, otherwise the token's own. */
  symbol: string;
  /** What `symbol()` actually returned. Recorded, not displayed. */
  onChainSymbol: string;
  name: string;
  decimals: number;
  /** Gates opening and borrowing only. A disabled token still appears, because
      repaying and adding collateral against it must stay reachable. */
  enabled: boolean;
  minCollateral: bigint;
  bg: string;
  on: string;
};

export type Market = {
  cbDecimals: number;
  /**
   * What the lent token calls itself on chain.
   *
   * Recorded and deliberately not displayed. This deployment carries
   * `mocks: true` and its token answers `symbol()` with "WN" ("Wewen"); the
   * screen says $CB because that is the decision on file. Kept here so the next
   * person reads the difference in the code rather than discovering it in a
   * wallet.
   */
  cbSymbol: string;
  available: bigint;
  paused: boolean;
  collateral: CollateralToken[];
};

export type Position = {
  id: bigint;
  cToken: Address;
  collateralAmount: bigint;
  debtCB: bigint;
  ltvBps: bigint;
};

const lending = { address: DEPLOYMENT.lending, abi: lendingAbi } as const;

/** One whole token, as an integer. */
const unit = (decimals: number) => 10n ** BigInt(decimals);

async function readMetadata(address: Address) {
  // Settled, not `all`: one token with a bytes32 symbol must not blank the list.
  const [symbol, name, decimals] = await Promise.allSettled([
    publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address, abi: erc20Abi, functionName: "name" }),
    publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return {
    symbol: symbol.status === "fulfilled" ? symbol.value : "???",
    name: name.status === "fulfilled" ? name.value : "Unknown token",
    // 18 is the safe guess only for display; every amount below is computed from
    // whatever this returns, so a token that fails this read is one we cannot
    // size a loan for. It stays in the list, disabled by the contract or not.
    decimals: decimals.status === "fulfilled" ? Number(decimals.value) : 18,
  };
}

export async function loadMarket(): Promise<Market> {
  const [tokens, available, paused, cbDecimals, cbSymbol] = await Promise.all([
    publicClient.readContract({ ...lending, functionName: "collateralTokens" }),
    publicClient.readContract({ ...lending, functionName: "availableCB" }),
    publicClient.readContract({ ...lending, functionName: "paused" }),
    publicClient.readContract({ address: DEPLOYMENT.cb, abi: erc20Abi, functionName: "decimals" }),
    publicClient
      .readContract({ address: DEPLOYMENT.cb, abi: erc20Abi, functionName: "symbol" })
      .catch(() => "???"),
  ]);

  const collateral = (
    await Promise.all(
      tokens.map(async (address): Promise<CollateralToken> => {
        const [meta, cfg] = await Promise.all([
          readMetadata(address),
          publicClient.readContract({ ...lending, functionName: "collateralConfigs", args: [address] }),
        ]);
        const [, , enabled, minCollateralAmount] = cfg;
        const listed = rosterEntry(meta.symbol);
        return {
          address,
          ...meta,
          /* The roster wins over the token where the design has an opinion, for
             the ticker as well as the name. On this deployment the chain says
             LITTLEJOHN, CashDog, TENDIES and YOLO; the design says JOHN,
             CASHDOG, Tendies and Yolo. The address is the identity — the ticker
             is copy, and the chain is not where copy is decided. */
          symbol: listed?.sym ?? meta.symbol,
          name: listed?.name ?? meta.name,
          /** What the token itself answers, kept for the record. */
          onChainSymbol: meta.symbol,
          enabled,
          minCollateral: minCollateralAmount,
          ...coinColour(meta.symbol),
        };
      })
    )
  ).sort((a, b) => rosterIndex(a.symbol) - rosterIndex(b.symbol));

  return {
    cbDecimals: Number(cbDecimals),
    cbSymbol,
    available,
    paused,
    collateral,
  };
}

/** Value of one whole collateral token and one whole $CB, both in WETH wei. */
export type UnitPrices = { collateral: bigint; cb: bigint };

export async function loadUnitPrices(token: CollateralToken, cbDecimals: number): Promise<UnitPrices> {
  const [collateral, cb] = await Promise.all([
    publicClient.readContract({
      ...lending,
      functionName: "quoteCollateralInWeth",
      args: [token.address, unit(token.decimals)],
    }),
    publicClient.readContract({ ...lending, functionName: "quoteCBInWeth", args: [unit(cbDecimals)] }),
  ]);
  return { collateral, cb };
}

/**
 * How much $CB a given amount of collateral supports at a given ratio.
 *
 * Scaled from unit prices rather than quoting the exact amount on every drag:
 * `TwapOracle.quoteAtTick` is a `mulDiv`, so it is linear in the amount and the
 * only difference is a wei or two of integer division. That is nowhere near the
 * headroom `UI_MAX_LTV` already leaves, and it is the difference between a
 * slider that moves and one that fires an RPC call per pixel.
 *
 * Both legs round in the borrower's favour by accident of the contract's own
 * rounding — collateral value is quoted down and $CB value up — so this estimate
 * sits under what the contract will compute, never over. The simulate step
 * before the write is what actually proves it.
 */
export function borrowableCB(
  collateralWei: bigint,
  ltvBps: number,
  prices: UnitPrices,
  collateralDecimals: number,
  cbDecimals: number
): bigint {
  if (collateralWei <= 0n || prices.cb <= 0n) return 0n;
  const collateralValueWeth = (prices.collateral * collateralWei) / unit(collateralDecimals);
  const targetDebtWeth = (collateralValueWeth * BigInt(ltvBps)) / 10_000n;
  return (targetDebtWeth * unit(cbDecimals)) / prices.cb;
}

/** The inverse, for reading a position back: what its debt is worth as a ratio. */
export function ltvPercent(ltvBps: bigint) {
  return Number(ltvBps) / 100;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

type Loaded<T> = { data?: T; error?: string; loading: boolean; refresh: () => void };

/**
 * One result, stamped with the key it was fetched for.
 *
 * Every hook below stores this shape rather than a bare value, and reads it back
 * only when the stamp still matches what is being asked for now. That is what
 * makes a stale answer unreachable instead of merely unlikely: switch coin and
 * the previous coin's prices are not "about to be replaced", they are already
 * not being returned — so a borrow amount can never be computed from the price
 * of a coin the visitor is no longer locking.
 *
 * It also keeps `loading` derived. A separate loading flag set at the top of an
 * effect is a synchronous state write during render's commit, which React 19
 * flags for good reason; `!current` says the same thing and cannot fall out of
 * step with the data it describes.
 */
type Stamped<T> = { key: string; data?: T; error?: string };

const settled = <T,>(entry: Stamped<T> | undefined, key: string | undefined) =>
  entry && key && entry.key === key ? entry : undefined;

/**
 * The market, refreshed on a timer.
 *
 * 30 seconds against a 60-second TWAP window: fast enough that a price cannot
 * move a whole window without the screen noticing, slow enough not to hammer a
 * public endpoint from a page people leave open.
 */
export function useMarket(): Loaded<Market> {
  const [entry, setEntry] = useState<Stamped<Market>>();
  const [tick, setTick] = useState(0);
  const key = `market:${tick}`;

  useEffect(() => {
    let live = true;
    loadMarket()
      .then((data) => live && setEntry({ key, data }))
      .catch(() => live && setEntry({ key, error: "Could not reach Robinhood Chain." }));
    return () => {
      live = false;
    };
  }, [key]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* Held across a refresh on purpose: the 30-second poll must not blank the
     figures every half minute. Only the very first load shows nothing. */
  const current = settled(entry, key) ?? entry;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

export function usePrices(token?: CollateralToken, cbDecimals?: number): Loaded<UnitPrices> {
  const [entry, setEntry] = useState<Stamped<UnitPrices>>();
  const [tick, setTick] = useState(0);
  const key = token && cbDecimals !== undefined ? `${token.address}:${cbDecimals}:${tick}` : undefined;

  useEffect(() => {
    if (!key || !token || cbDecimals === undefined) return;
    let live = true;
    loadUnitPrices(token, cbDecimals)
      .then((data) => live && setEntry({ key, data }))
      // An oracle that cannot be read is not a zero price. The error is stamped
      // like everything else, so it clears the moment the coin changes.
      .catch(() => live && setEntry({ key, error: "Could not read the price oracle." }));
    return () => {
      live = false;
    };
  }, [key, token, cbDecimals]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* Unlike the market, a price is only reused across the poll — never across a
     change of coin. `sameToken` drops the tick and keeps the address. */
  const sameToken =
    entry && token && cbDecimals !== undefined && entry.key.startsWith(`${token.address}:${cbDecimals}:`)
      ? entry
      : undefined;

  return {
    data: sameToken?.data,
    error: sameToken?.error,
    loading: !!key && !sameToken,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

export function usePositions(account?: Address): Loaded<Position[]> {
  const [entry, setEntry] = useState<Stamped<Position[]>>();
  const [tick, setTick] = useState(0);
  const key = account ? `${account}:${tick}` : undefined;

  useEffect(() => {
    if (!key || !account) return;
    let live = true;
    (async () => {
      const ids = await publicClient.readContract({
        ...lending,
        functionName: "positionsOf",
        args: [account],
      });
      return Promise.all(
        ids.map(async (id): Promise<Position> => {
          const [[, cToken, collateralAmount, debtCB], ltv] = await Promise.all([
            publicClient.readContract({ ...lending, functionName: "positions", args: [id] }),
            publicClient.readContract({ ...lending, functionName: "ltvBps", args: [id] }),
          ]);
          return { id, cToken, collateralAmount, debtCB, ltvBps: ltv };
        })
      );
    })()
      .then((data) => live && setEntry({ key, data }))
      .catch(() => live && setEntry({ key, error: "Could not load your positions." }));
    return () => {
      live = false;
    };
  }, [key, account]);

  /* Positions are never shown across a change of account — that would be showing
     one person somebody else's money — so this matches on the address, and the
     tick is allowed to differ so a refresh does not blank the list. */
  const sameAccount = entry && account && entry.key.startsWith(`${account}:`) ? entry : undefined;

  return {
    data: sameAccount?.data,
    error: sameAccount?.error,
    loading: !!key && !sameAccount,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

// ---------------------------------------------------------------------------
// Reverts, as sentences
// ---------------------------------------------------------------------------

/**
 * Turn a failed call into something a person can act on.
 *
 * Returns `undefined` when the visitor simply closed the wallet prompt — that
 * is an answer, not an error, and putting a red box under it teaches people
 * their own choices are faults.
 */
export function describeError(e: unknown): string | undefined {
  if (e instanceof BaseError) {
    if (e.walk((err) => err instanceof UserRejectedRequestError)) return undefined;

    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      const args = (revert.data?.args ?? []) as readonly unknown[];
      switch (name) {
        case "LtvTooHigh": {
          const bps = Number(args[0] ?? 0);
          return `That works out at ${(bps / 100).toFixed(2)}% — past the ${MAX_LTV}% limit. Lock more, or borrow less.`;
        }
        case "InsufficientCBLiquidity":
          return "The desk does not have that much $CB left to lend right now.";
        case "CollateralDisabled":
          return "That coin is not accepted for new loans at the moment. Repaying and adding collateral still work.";
        case "DustAmount":
          return "That is below the minimum this coin can open a position with.";
        case "ZeroAmount":
        case "InvalidAmount":
          return "That amount is not something the contract will take.";
        case "NoPosition":
          return "That position is already closed.";
        case "NotPositionOwner":
          return "That position belongs to another wallet.";
        case "EnforcedPause":
          return "New borrowing is paused. Repaying, adding collateral and withdrawing still work.";
        case "InvalidPool":
        case "InvalidToken":
          return "The contract will not price that token.";
        default:
          if (name) return `The contract refused this: ${name}.`;
      }
    }

    if (e.shortMessage?.toLowerCase().includes("insufficient funds"))
      return "Not enough ETH in the wallet to pay for gas.";
    return e.shortMessage || "The transaction failed.";
  }
  return "The transaction failed.";
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Amounts are read, not audited: four decimals is plenty and 18 is noise. */
export function formatAmount(value: bigint, decimals: number, max = 4) {
  const n = Number(formatUnits(value, decimals));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

/**
 * The same value with nothing lost — for filling a field, never for reading.
 *
 * `formatAmount` goes through a double to add thousands separators, and a double
 * holds about 15 significant digits against this chain's 18. That is invisible
 * in a summary line and wrong in an input: "Max" on a repay has to be the debt
 * to the wei, or the loan closes owing dust and stays open.
 */
export const exactAmount = (value: bigint, decimals: number) => formatUnits(value, decimals);

/**
 * An ERC-20 balance, for the Max buttons.
 *
 * Undefined while unknown and undefined on failure, which the callers treat as
 * "offer no Max" rather than "the balance is zero" — a Max button that fills in
 * 0 because a read timed out is worse than no Max button.
 */
export function useTokenBalance(token?: Address, account?: Address): bigint | undefined {
  const [entry, setEntry] = useState<{ key: string; balance: bigint }>();
  const key = token && account ? `${token}:${account}` : undefined;

  useEffect(() => {
    if (!key || !token || !account) return;
    let live = true;
    publicClient
      .readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account] })
      .then((balance) => live && setEntry({ key, balance }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, token, account]);

  // Stamped like the rest: a balance belongs to one token and one account, and
  // showing the last one against a newly picked coin would put the wrong number
  // behind the Max button.
  return entry && entry.key === key ? entry.balance : undefined;
}

/** Parse a typed amount, tolerating the commas `formatAmount` puts in. */
export function parseAmount(text: string, decimals: number): bigint {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return 0n;
  try {
    return parseUnits(cleaned, decimals);
  } catch {
    return 0n;
  }
}

export function useShortAddress(account?: Address) {
  return useMemo(() => (account ? `${account.slice(0, 6)}…${account.slice(-4)}` : undefined), [account]);
}
