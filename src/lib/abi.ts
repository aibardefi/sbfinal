/**
 * The slice of CBLending this screen actually uses, plus the ERC-20 calls that
 * go with it.
 *
 * Hand-written rather than the 106-entry artifact from the protocol repo, for
 * two reasons. `as const` is what lets viem infer argument and return types from
 * the ABI itself, so a typo in an argument list is a compile error rather than a
 * revert someone finds on mainnet. And a static export ships whatever it
 * imports — there is no reason to send the admin surface, the UUPS plumbing and
 * every AccessControl event to a visitor who is here to borrow.
 *
 * Every `error` below is carried deliberately: viem can only turn a revert into
 * a sentence if the error is in the ABI it was given. Drop one and that failure
 * silently degrades to "execution reverted". `describeError` in protocol.ts is
 * the other half of this.
 */

export const lendingAbi = [
  // --- reads -------------------------------------------------------------
  {
    type: "function",
    name: "collateralTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "collateralConfigs",
    stateMutability: "view",
    inputs: [{ name: "cToken", type: "address" }],
    outputs: [
      { name: "pool", type: "address" },
      { name: "poolFee", type: "uint24" },
      { name: "enabled", type: "bool" },
      { name: "minCollateralAmount", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "availableCB",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteCollateralInWeth",
    stateMutability: "view",
    inputs: [
      { name: "cToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteCBInWeth",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "positionsOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "cToken", type: "address" },
      { name: "collateralAmount", type: "uint128" },
      { name: "debtCB", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "ltvBps",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "CB", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "MAX_LTV_BPS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "LIQ_THRESHOLD_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },

  // --- writes ------------------------------------------------------------
  {
    type: "function",
    name: "openPosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cToken", type: "address" },
      { name: "collateralAmount", type: "uint256" },
      { name: "borrowAmount", type: "uint256" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "addCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrowCB",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },

  // --- errors, so a revert can be read ------------------------------------
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidPool", inputs: [] },
  { type: "error", name: "InvalidToken", inputs: [] },
  { type: "error", name: "CollateralDisabled", inputs: [] },
  { type: "error", name: "NoPosition", inputs: [] },
  { type: "error", name: "NotPositionOwner", inputs: [] },
  { type: "error", name: "DustAmount", inputs: [] },
  { type: "error", name: "LtvTooHigh", inputs: [{ name: "ltvBps", type: "uint256" }] },
  { type: "error", name: "NotLiquidatable", inputs: [{ name: "ltvBps", type: "uint256" }] },
  {
    type: "error",
    name: "InsufficientCBLiquidity",
    inputs: [
      { name: "requested", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
  { type: "error", name: "WindowOutOfBounds", inputs: [] },
  { type: "error", name: "SlippageOutOfBounds", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
] as const;

/**
 * Standard ERC-20, minus everything this screen has no business calling.
 *
 * `symbol` and `name` are declared as `string`. Some older tokens return a
 * fixed `bytes32` instead and will fail to decode — the metadata read in
 * protocol.ts treats that as "unknown symbol" rather than letting one odd token
 * take the whole collateral list down with it.
 */
export const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
