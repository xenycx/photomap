import { writable } from 'svelte/store';

// key is locationId, value is 'upvote' | 'downvote'
type VoteRecord = Record<string, 'upvote' | 'downvote'>;

function loadVotes(): VoteRecord {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('voted_locations');
    if (saved) {
      try { return JSON.parse(saved); } catch { return {}; }
    }
  }
  return {};
}

export const userVotes = writable<VoteRecord>(loadVotes());

userVotes.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('voted_locations', JSON.stringify(value));
  }
});

export function hasVoted(locationId: string): boolean {
  let voted = false;
  const unsub = userVotes.subscribe(v => {
    voted = !!v[locationId];
  });
  unsub();
  return voted;
}

export function recordVote(locationId: string, type: 'upvote' | 'downvote'): void {
  userVotes.update(votes => ({ ...votes, [locationId]: type }));
}
