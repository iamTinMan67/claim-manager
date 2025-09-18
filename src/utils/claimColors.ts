
// Predefined color palette for claims
const CLAIM_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
  { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
  { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800' },
  { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' },
  { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-800' },
  { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-800' },
  { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800' },
  { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
  { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-800' },
  { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-800' },
];

const claimColorMap = new Map<string, typeof CLAIM_COLORS[0]>();

export const getClaimColor = (claimId: string): typeof CLAIM_COLORS[0] => {
  if (!claimColorMap.has(claimId)) {
    const colorIndex = claimColorMap.size % CLAIM_COLORS.length;
    claimColorMap.set(claimId, CLAIM_COLORS[colorIndex]);
  }
  return claimColorMap.get(claimId)!;
};

export const resetClaimColors = () => {
  claimColorMap.clear();
};
