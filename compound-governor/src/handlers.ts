import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  BIGDECIMAL_ZERO,
  BIGINT_ONE,
  BIGINT_ZERO,
  GOVERNANCE_NAME,
  ProposalState,
  VoteChoice,
  ZERO_ADDRESS,
} from "./constants";
import {
  Delegate,
  Governance,
  Proposal,
  TokenHolder,
  Vote,
  Delegation,
  TokenDailySnapshot,
  VoteDailySnapshot,
} from "../generated/schema";

export const SECONDS_PER_DAY = 60 * 60 * 24;

export function toDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  return value.divDecimal(
    BigInt.fromI32(10)
      .pow(<u8>decimals)
      .toBigDecimal()
  );
}
export function addressesToStrings(addresses: Address[]): Array<string> {
  const byteAddresses = new Array<string>();
  for (let i = 0; i < addresses.length; i++) {
    byteAddresses.push(addresses[i].toHexString());
  }
  return byteAddresses;
}

export function getVoteChoiceByValue(choiceValue: number): string {
  if (choiceValue === VoteChoice.AGAINST_VALUE) {
    return VoteChoice.AGAINST;
  } else if (choiceValue === VoteChoice.FOR_VALUE) {
    return VoteChoice.FOR;
  } else if (choiceValue === VoteChoice.ABSTAIN_VALUE) {
    return VoteChoice.ABSTAIN;
  } else {
    // Case that shouldn't happen
    log.error("Voting choice of {} does not exist", [choiceValue.toString()]);
    return VoteChoice.ABSTAIN;
  }
}

export function getGovernance(): Governance {
  let governance = Governance.load(GOVERNANCE_NAME);

  if (!governance) {
    governance = new Governance(GOVERNANCE_NAME);
    governance.totalTokenSupply = BIGINT_ZERO;
    governance.proposals = BIGINT_ZERO;
    governance.currentTokenHolders = BIGINT_ZERO;
    governance.totalTokenHolders = BIGINT_ZERO;
    governance.currentDelegates = BIGINT_ZERO;
    governance.totalDelegates = BIGINT_ZERO;
    governance.delegatedVotesRaw = BIGINT_ZERO;
    governance.delegatedVotes = BIGDECIMAL_ZERO;
    governance.proposalsQueued = BIGINT_ZERO;
    governance.proposalsExecuted = BIGINT_ZERO;
    governance.proposalsCanceled = BIGINT_ZERO;
    governance.totalDelegations = BIGINT_ZERO;
  }

  return governance;
}

export function getOrCreateProposal(
  id: string,
  createIfNotFound: boolean = true,
  save: boolean = false
): Proposal {
  let proposal = Proposal.load(id);

  if (!proposal && createIfNotFound) {
    proposal = new Proposal(id);
    proposal.tokenHoldersAtStart = BIGINT_ZERO;
    proposal.delegatesAtStart = BIGINT_ZERO;
    if (save) {
      proposal.save();
    }
  }

  return proposal as Proposal;
}

export function getOrCreateDelegate(
  address: string,
  createIfNotFound: boolean = true,
  save: boolean = true
): Delegate {
  let delegate = Delegate.load(address);

  if (!delegate && createIfNotFound) {
    delegate = new Delegate(address);
    delegate.delegatedVotesRaw = BIGINT_ZERO;
    delegate.delegatedVotes = BIGDECIMAL_ZERO;
    delegate.tokenHoldersRepresentedAmount = 0;
    delegate.numberVotes = 0;
    if (save) {
      delegate.save();
    }

    if (address != ZERO_ADDRESS) {
      let governance = getGovernance();
      governance.totalDelegates = governance.totalDelegates.plus(BIGINT_ONE);
      governance.save();
    }
  }

  return delegate as Delegate;
}

export function createDelegation(
  id: string,
  delegator: string,
  delegate: string,
  event: ethereum.Event,
  createIfNotFound: boolean = true,
  save: boolean = true
): Delegation {
  let delegation = Delegation.load(id);
  if (!delegation && createIfNotFound) {
    delegation = new Delegation(id);
    delegation.delegate = delegate;
    delegation.delegator = delegator;
    delegation.delegateTokens = BIGDECIMAL_ZERO;
    delegation.delegatorTokens = BIGDECIMAL_ZERO;
    delegation.block = event.block.number;
    delegation.blockTime = event.block.timestamp;
    delegation.txnHash = event.transaction.hash.toHexString();

    if (save) {
      delegation.save();
    }
    let governance = getGovernance();
    governance.totalDelegations = governance.totalDelegations.plus(BIGINT_ONE);
    governance.save();
  }

  return delegation as Delegation;
}

export function getDelegation(
  id: string,
  delegate: string,
  event: ethereum.Event
): Delegation {
  let delegation = Delegation.load(id);

  if (!delegation) {
    delegation = new Delegation(id);
    delegation.delegate = delegate;
    delegation.delegator = ZERO_ADDRESS;
    delegation.delegateTokens = BIGDECIMAL_ZERO;
    delegation.delegatorTokens = BIGDECIMAL_ZERO;
    delegation.weight = BIGINT_ZERO;
    delegation.block = event.block.number;
    delegation.blockTime = event.block.timestamp;
    delegation.txnHash = event.transaction.hash.toHexString();
    delegation.save();
  }

  return delegation as Delegation;
}

export function getOrCreateTokenHolder(
  address: string,
  createIfNotFound: boolean = true,
  save: boolean = true
): TokenHolder {
  let tokenHolder = TokenHolder.load(address);

  if (!tokenHolder && createIfNotFound) {
    tokenHolder = new TokenHolder(address);
    tokenHolder.tokenBalanceRaw = BIGINT_ZERO;
    tokenHolder.tokenBalance = BIGDECIMAL_ZERO;
    tokenHolder.totalTokensHeldRaw = BIGINT_ZERO;
    tokenHolder.totalTokensHeld = BIGDECIMAL_ZERO;
    if (save) {
      tokenHolder.save();
    }

    if (address != ZERO_ADDRESS) {
      let governance = getGovernance();
      governance.totalTokenHolders =
        governance.totalTokenHolders.plus(BIGINT_ONE);
      governance.save();
    }
  }

  return tokenHolder as TokenHolder;
}

export function getOrCreateTokenDailySnapshot(
  block: ethereum.Block
): TokenDailySnapshot {
  let snapshotId = (block.timestamp.toI64() / SECONDS_PER_DAY).toString();
  let previousSnapshot = TokenDailySnapshot.load(snapshotId);

  if (previousSnapshot != null) {
    return previousSnapshot as TokenDailySnapshot;
  }
  let snapshot = new TokenDailySnapshot(snapshotId);
  return snapshot;
}

export function getOrCreateVoteDailySnapshot(
  proposal: Proposal,
  block: ethereum.Block
): VoteDailySnapshot {
  let snapshotId =
    proposal.id + "-" + (block.timestamp.toI64() / SECONDS_PER_DAY).toString();
  let previousSnapshot = VoteDailySnapshot.load(snapshotId);

  if (previousSnapshot != null) {
    return previousSnapshot as VoteDailySnapshot;
  }
  let snapshot = new VoteDailySnapshot(snapshotId);
  return snapshot;
}

export function _handleProposalCreated(
  proposalId: string,
  proposerAddr: string,
  targets: Address[],
  values: BigInt[],
  signatures: string[],
  calldatas: Bytes[],
  startBlock: BigInt,
  endBlock: BigInt,
  description: string,
  event: ethereum.Event
): void {
  let proposal = getOrCreateProposal(proposalId);
  let proposer = getOrCreateDelegate(proposerAddr);

  // Checking if the proposer was a delegate already accounted for, if not we should log an error
  // since it shouldn't be possible for a delegate to propose anything without first being "created"
  if (proposer == null) {
    log.error(
      "Delegate participant {} not found on ProposalCreated. tx_hash: {}",
      [proposerAddr, event.transaction.hash.toHexString()]
    );
  }

  // Creating it anyway since we will want to account for this event data, even though it should've never happened
  proposer = getOrCreateDelegate(proposerAddr);

  proposal.proposer = proposer.id;
  proposal.txnHash = event.transaction.hash.toHexString();
  proposal.againstDelegateVotes = BIGINT_ZERO;
  proposal.forDelegateVotes = BIGINT_ZERO;
  proposal.abstainDelegateVotes = BIGINT_ZERO;
  proposal.totalDelegateVotes = BIGINT_ZERO;
  proposal.againstWeightedVotes = BIGINT_ZERO;
  proposal.forWeightedVotes = BIGINT_ZERO;
  proposal.abstainWeightedVotes = BIGINT_ZERO;
  proposal.totalWeightedVotes = BIGINT_ZERO;
  proposal.targets = addressesToStrings(targets);
  proposal.values = values;
  proposal.signatures = signatures;
  proposal.calldatas = calldatas;
  proposal.creationBlock = event.block.number;
  proposal.creationTime = event.block.timestamp;
  proposal.startBlock = startBlock;
  proposal.endBlock = endBlock;
  proposal.description = description;
  proposal.state =
    event.block.number >= proposal.startBlock
      ? ProposalState.ACTIVE
      : ProposalState.PENDING;
  proposal.save();

  // Increment gov proposal count
  let governance = getGovernance();
  governance.proposals = governance.proposals.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalCanceled(
  proposalId: string,
  event: ethereum.Event
): void {
  let proposal = getOrCreateProposal(proposalId);
  proposal.state = ProposalState.CANCELED;
  proposal.cancellationBlock = event.block.number;
  proposal.cancellationTime = event.block.timestamp;
  proposal.save();

  // Update governance proposal state counts
  let governance = getGovernance();
  governance.proposalsCanceled = governance.proposalsCanceled.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalExecuted(
  proposalId: string,
  event: ethereum.Event
): void {
  // Update proposal status + execution metadata
  let proposal = getOrCreateProposal(proposalId);
  proposal.state = ProposalState.EXECUTED;
  proposal.executionBlock = event.block.number;
  proposal.executionTime = event.block.timestamp;
  proposal.save();

  // Update governance proposal state counts
  let governance = getGovernance();
  governance.proposalsQueued = governance.proposalsQueued.minus(BIGINT_ONE);
  governance.proposalsExecuted = governance.proposalsExecuted.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalExtended(
  proposalId: string,
  extendedDeadline: BigInt
): void {
  // Update proposal endBlock
  let proposal = getOrCreateProposal(proposalId);
  proposal.endBlock = extendedDeadline;
  proposal.save();
}

export function _handleProposalQueued(proposalId: BigInt, eta: BigInt): void {
  // Update proposal status + execution metadata
  let proposal = getOrCreateProposal(proposalId.toString());
  proposal.state = ProposalState.QUEUED;
  proposal.executionETA = eta;
  proposal.save();

  // Update governance proposal state counts
  let governance = getGovernance();
  governance.proposalsQueued = governance.proposalsQueued.plus(BIGINT_ONE);
  governance.save();
}

export function _handleVoteCast(
  proposal: Proposal,
  voterAddress: string,
  weight: BigInt,
  reason: string,
  support: i32,
  event: ethereum.Event
): void {
  let voteId = voterAddress.concat("-").concat(proposal.id);
  let vote = new Vote(voteId);
  vote.proposal = proposal.id;
  vote.voter = voterAddress;
  vote.weight = weight;
  vote.reason = reason;
  vote.block = event.block.number;
  vote.blockTime = event.block.timestamp;
  vote.txnHash = event.transaction.hash.toHexString();
  // Retrieve enum string key by value (0 = Against, 1 = For, 2 = Abstain)
  vote.choice = getVoteChoiceByValue(support);
  vote.save();

  // Increment respective vote choice counts
  // NOTE: We are counting the weight instead of individual votes
  if (support === VoteChoice.AGAINST_VALUE) {
    proposal.againstDelegateVotes =
      proposal.againstDelegateVotes.plus(BIGINT_ONE);
    proposal.againstWeightedVotes = proposal.againstWeightedVotes.plus(weight);
  } else if (support === VoteChoice.FOR_VALUE) {
    proposal.forDelegateVotes = proposal.forDelegateVotes.plus(BIGINT_ONE);
    proposal.forWeightedVotes = proposal.forWeightedVotes.plus(weight);
  } else if (support === VoteChoice.ABSTAIN_VALUE) {
    proposal.abstainDelegateVotes =
      proposal.abstainDelegateVotes.plus(BIGINT_ONE);
    proposal.abstainWeightedVotes = proposal.abstainWeightedVotes.plus(weight);
  }
  // Increment total
  proposal.totalDelegateVotes = proposal.totalDelegateVotes.plus(BIGINT_ONE);
  proposal.totalWeightedVotes = proposal.totalWeightedVotes.plus(weight);
  proposal.save();

  // Add 1 to participant's proposal voting count
  let voter = getOrCreateDelegate(voterAddress);
  voter.numberVotes = voter.numberVotes + 1;
  voter.save();

  // Take snapshot
  let dailySnapshot = getOrCreateVoteDailySnapshot(proposal, event.block);
  dailySnapshot.proposal = proposal.id;
  dailySnapshot.forWeightedVotes = proposal.forWeightedVotes;
  dailySnapshot.againstWeightedVotes = proposal.againstWeightedVotes;
  dailySnapshot.abstainWeightedVotes = proposal.abstainWeightedVotes;
  dailySnapshot.totalWeightedVotes = proposal.totalWeightedVotes;
  dailySnapshot.blockNumber = event.block.number;
  dailySnapshot.timestamp = event.block.timestamp;
  dailySnapshot.save();
}
