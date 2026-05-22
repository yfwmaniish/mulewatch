/**
 * Deterministic synthesizers for fields the dataset doesn't carry.
 * Same account_id always produces the same fake name / counterparty list, even across reloads.
 *
 * These are clearly labeled as DEMO in the UI footnote. The model output (score, band,
 * SHAP attributions, matched rules) is always real — only the customer-facing
 * identity decoration is synthesized.
 */

const FIRST_NAMES_M = [
  "Rajesh", "Vikram", "Amit", "Suresh", "Dinesh", "Aditya", "Arjun", "Manoj",
  "Sanjay", "Prakash", "Naveen", "Karthik", "Ravi", "Sunil", "Rohit", "Ajay",
  "Gopal", "Mukesh", "Pradeep", "Anil",
];
const FIRST_NAMES_F = [
  "Anjali", "Priyanka", "Pooja", "Ananya", "Kavya", "Meera", "Sneha", "Neha",
  "Lakshmi", "Divya", "Ritu", "Shreya", "Aishwarya", "Sunita", "Geeta", "Mansi",
  "Ramya", "Madhuri", "Anita", "Sangeeta",
];
const FIRST_NAMES_O = [
  "Akash", "Ishaan", "Riya", "Tara", "Aryan", "Aanya", "Kavi", "Mira",
];

const SURNAMES = [
  "Sharma", "Verma", "Gupta", "Patel", "Singh", "Kumar", "Mehta", "Iyer",
  "Nair", "Reddy", "Rao", "Joshi", "Das", "Banerjee", "Mukherjee", "Bose",
  "Sen", "Roy", "Chatterjee", "Bhat", "Pillai", "Naidu", "Chowdhury", "Khan",
];

const COUNTERPARTY_FIRST = [
  "Sahil", "Rekha", "Imran", "Lakshmi", "Vinod", "Pooja", "Tarun", "Reema",
  "Bhavna", "Yash", "Komal", "Ashok",
];

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1597334677) + 0x9e3779b9) >>> 0;
    return x / 0xffffffff;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Convert numeric account_id + (optional) gender into a synthesized display ID. */
export function synthesizeDisplayId(accountId: number): string {
  const tail = hash32(`acct-${accountId}`).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
  return `MULE_AC_${accountId}_${tail}`;
}

/** Deterministic customer name from account_id + gender hint. */
export function synthesizeCustomerName(accountId: number, gender?: string | null): string {
  const rng = seeded(hash32(`name-${accountId}`));
  let pool = FIRST_NAMES_O;
  if (gender === "M") pool = FIRST_NAMES_M;
  else if (gender === "F") pool = FIRST_NAMES_F;
  const first = pick(rng, pool);
  const last = pick(rng, SURNAMES);
  return `${first} ${last}`;
}

/** KYC status: derived from band + occupation, deterministic. */
export function synthesizeKycStatus(
  accountId: number,
  band: "LOW" | "MEDIUM" | "HIGH" | "FREEZE",
): "Verified" | "Pending" | "Flagged" {
  if (band === "FREEZE") return "Flagged";
  if (band === "HIGH") {
    // Most HIGH-band have pending KYC; some flagged
    return hash32(`kyc-${accountId}`) % 3 === 0 ? "Flagged" : "Pending";
  }
  if (band === "MEDIUM") return hash32(`kyc-${accountId}`) % 2 === 0 ? "Pending" : "Verified";
  return "Verified";
}

const CHANNELS = ["UPI", "IMPS", "NEFT", "RTGS", "AePS", "Cards"] as const;

export interface SynthesizedCounterparty {
  id: string;
  name: string;
  amount: number;
  channel: (typeof CHANNELS)[number];
  timestamp: string; // HH:MM:SS
}

/**
 * Deterministic counterparty list, sized by band severity.
 * Real graph data isn't in the dataset; these are for demonstration only.
 */
export function synthesizeCounterparties(
  accountId: number,
  band: "LOW" | "MEDIUM" | "HIGH" | "FREEZE",
): SynthesizedCounterparty[] {
  const rng = seeded(hash32(`cp-${accountId}`));
  const n = band === "FREEZE" ? 5 : band === "HIGH" ? 4 : band === "MEDIUM" ? 2 : 1;
  const out: SynthesizedCounterparty[] = [];
  let minute = 23;
  let second = Math.floor(rng() * 30);
  for (let i = 0; i < n; i++) {
    const first = pick(rng, COUNTERPARTY_FIRST);
    const last = pick(rng, SURNAMES);
    const channel = pick(rng, [...CHANNELS]);
    const amount =
      band === "LOW"
        ? Math.floor(5000 + rng() * 20000)
        : band === "MEDIUM"
          ? Math.floor(20000 + rng() * 80000)
          : Math.floor(40000 + rng() * 200000); // High/Freeze: near-threshold structuring
    second = (second + 15 + Math.floor(rng() * 30)) % 60;
    if (second < 15) minute += 1;
    out.push({
      id: `CP_${channel}_${(hash32(`${accountId}-${i}`) % 9000) + 1000}`,
      name: `${first} ${last}`,
      amount,
      channel,
      timestamp: `${minute.toString().padStart(2, "0")}:${second
        .toString()
        .padStart(2, "0")}:${Math.floor(rng() * 60)
        .toString()
        .padStart(2, "0")}`,
    });
  }
  return out;
}
