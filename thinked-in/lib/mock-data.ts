// Placeholder data for the frontend. Swap for real Supabase/Apify data later.
// Avatars use randomuser.me (realistic stock-style faces) — allowed in
// next.config.ts remotePatterns.

import type { ChatSession, Connection, ProfileCardData, Seniority } from "./types";

const portrait = (g: "men" | "women", n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

const slug = (first: string, last: string) =>
  `https://linkedin.com/in/${first}-${last}`.toLowerCase();

function makeConnection(
  c: Omit<Connection, "name" | "location" | "linkedinUrl" | "enrichmentStatus"> &
    Partial<Pick<Connection, "enrichmentStatus">>,
): Connection {
  return {
    ...c,
    name: `${c.firstName} ${c.lastName}`,
    location:
      c.city && c.country ? `${c.city}, ${c.country}` : c.country ?? c.city ?? null,
    linkedinUrl: slug(c.firstName, c.lastName),
    enrichmentStatus: c.enrichmentStatus ?? "enriched",
  };
}

/* -------------------------------------------------------------------------- */
/* Landing-page demo: "here's a couple useful guys"                            */
/* -------------------------------------------------------------------------- */

export const landingDemoPeople: ProfileCardData[] = [
  {
    id: "demo-1",
    name: "Maya Chen",
    position: "University Recruiter",
    company: "Stripe",
    location: "London, UK",
    avatarUrl: portrait("women", 68),
    linkedinUrl: "https://linkedin.com/in/maya-chen",
  },
  {
    id: "demo-2",
    name: "Dev Patel",
    position: "Engineering Manager",
    company: "Notion",
    location: "San Francisco, USA",
    avatarUrl: portrait("men", 32),
    linkedinUrl: "https://linkedin.com/in/dev-patel",
  },
  {
    id: "demo-3",
    name: "Sofia Marenko",
    position: "Early Talent Lead",
    company: "Revolut",
    location: "London, UK",
    avatarUrl: portrait("women", 44),
    linkedinUrl: "https://linkedin.com/in/sofia-marenko",
  },
];

// Second landing loop: "find me 3 cracked cofounders my age"
export const landingCofounders: ProfileCardData[] = [
  {
    id: "cf-1",
    name: "Theo Nakamura",
    position: "Founder · 21",
    company: "building dev tools",
    location: "London, UK",
    avatarUrl: portrait("men", 18),
    linkedinUrl: "https://linkedin.com/in/theo-nakamura",
  },
  {
    id: "cf-2",
    name: "Amelia Frost",
    position: "Co-founder · 22",
    company: "AI agents",
    location: "Cambridge, UK",
    avatarUrl: portrait("women", 79),
    linkedinUrl: "https://linkedin.com/in/amelia-frost",
  },
  {
    id: "cf-3",
    name: "Raj Malhotra",
    position: "Founder · 20",
    company: "fintech",
    location: "London, UK",
    avatarUrl: portrait("men", 54),
    linkedinUrl: "https://linkedin.com/in/raj-malhotra",
  },
];

/* -------------------------------------------------------------------------- */
/* Enrichment animation roster — people that "pop in" while enriching          */
/* -------------------------------------------------------------------------- */

export interface RosterPerson {
  name: string;
  role: string;
  avatarUrl: string;
}

export const enrichmentRoster: RosterPerson[] = [
  { name: "Aisha Rahman", role: "Product Designer @ Figma", avatarUrl: portrait("women", 12) },
  { name: "Lucas Moreau", role: "Founder @ Northwind Software", avatarUrl: portrait("men", 11) },
  { name: "Priya Nair", role: "Data Scientist @ Spotify", avatarUrl: portrait("women", 21) },
  { name: "Tom Becker", role: "VP Engineering @ Monzo", avatarUrl: portrait("men", 51) },
  { name: "Hannah Lee", role: "Recruiter @ Google", avatarUrl: portrait("women", 33) },
  { name: "Marco Rossi", role: "CTO @ Lumina AI", avatarUrl: portrait("men", 64) },
  { name: "Chloe Dubois", role: "Growth Lead @ Wise", avatarUrl: portrait("women", 9) },
  { name: "Sam Okoye", role: "Software Engineer @ Stripe", avatarUrl: portrait("men", 23) },
  { name: "Yuki Tanaka", role: "PM @ Atlassian", avatarUrl: portrait("women", 55) },
  { name: "Daniel Schmidt", role: "Director of Eng @ Datadog", avatarUrl: portrait("men", 41) },
  { name: "Isabella Costa", role: "UX Researcher @ Canva", avatarUrl: portrait("women", 26) },
  { name: "Ahmed Hassan", role: "Co-founder @ Beacon Labs", avatarUrl: portrait("men", 77) },
  { name: "Grace Williams", role: "Talent Partner @ Meta", avatarUrl: portrait("women", 47) },
  { name: "Felix Andersson", role: "Staff Engineer @ Klarna", avatarUrl: portrait("men", 15) },
  { name: "Nadia Petrova", role: "Head of Design @ Miro", avatarUrl: portrait("women", 60) },
  { name: "Oliver Hartley", role: "Founder & CEO @ Northwind Software", avatarUrl: portrait("men", 86) },
  { name: "Mei Lin", role: "ML Engineer @ DeepMind", avatarUrl: portrait("women", 72) },
  { name: "Jacob Stern", role: "Engineering Lead @ Ramp", avatarUrl: portrait("men", 3) },
  { name: "Amara Diallo", role: "Product Lead @ Duolingo", avatarUrl: portrait("women", 16) },
  { name: "Liam O'Brien", role: "DevRel @ Vercel", avatarUrl: portrait("men", 90) },
  { name: "Sara Bianchi", role: "VP Product @ Typeform", avatarUrl: portrait("women", 5) },
  { name: "Kenji Watanabe", role: "Backend Engineer @ Shopify", avatarUrl: portrait("men", 29) },
  { name: "Elena Vasquez", role: "Recruiting Lead @ Airbnb", avatarUrl: portrait("women", 38) },
  { name: "Noah Kim", role: "Founder @ Pixelforge", avatarUrl: portrait("men", 47) },
  { name: "Fatima Zahra", role: "Data Engineer @ Bloomberg", avatarUrl: portrait("women", 81) },
  { name: "Henrik Larsen", role: "Principal Engineer @ Spotify", avatarUrl: portrait("men", 6) },
  { name: "Olivia Brooks", role: "Design Manager @ Linear", avatarUrl: portrait("women", 64) },
  { name: "Ravi Mehta", role: "CPO @ Razorpay", avatarUrl: portrait("men", 19) },
  { name: "Zoe Carter", role: "Frontend Engineer @ Webflow", avatarUrl: portrait("women", 90) },
  { name: "Mateo Ramirez", role: "Solutions Architect @ AWS", avatarUrl: portrait("men", 35) },
];

/* -------------------------------------------------------------------------- */
/* Chat network — what the bot "knows". Includes a UK software-company founder  */
/* so "someone who owns a software company in England" lands.                   */
/* -------------------------------------------------------------------------- */

export const networkConnections: Connection[] = [
  makeConnection({
    id: "c-1",
    firstName: "Oliver",
    lastName: "Hartley",
    position: "Founder & CEO",
    company: "Northwind Software",
    city: "London",
    country: "England",
    summary:
      "Bootstrapped Northwind Software to 40 people. Builds B2B workflow tooling for logistics. Angel-invests in early-stage SaaS.",
    industry: "Software",
    seniority: "founder",
    skills: ["SaaS", "B2B", "Leadership", "Product Strategy"],
    avatarUrl: portrait("men", 86),
  }),
  makeConnection({
    id: "c-2",
    firstName: "Eleanor",
    lastName: "Price",
    position: "Co-founder & CTO",
    company: "Brightloom",
    city: "Manchester",
    country: "England",
    summary:
      "Technical co-founder of a software company building AI tooling for retailers. Ex-Google engineer.",
    industry: "Software",
    seniority: "founder",
    skills: ["AI", "Engineering", "Startups"],
    avatarUrl: portrait("women", 60),
  }),
  makeConnection({
    id: "c-3",
    firstName: "Maya",
    lastName: "Chen",
    position: "University Recruiter",
    company: "Stripe",
    city: "London",
    country: "England",
    summary: "Runs early-careers hiring for Stripe across EMEA. Loves connecting students to internships.",
    industry: "Financial Technology",
    seniority: "ic",
    skills: ["Recruiting", "Early Careers", "Hiring"],
    avatarUrl: portrait("women", 68),
  }),
  makeConnection({
    id: "c-4",
    firstName: "Dev",
    lastName: "Patel",
    position: "Engineering Manager",
    company: "Notion",
    city: "San Francisco",
    country: "USA",
    summary: "Leads the integrations eng team at Notion. Mentors junior engineers and interns.",
    industry: "Software",
    seniority: "manager",
    skills: ["Engineering Management", "Mentorship", "APIs"],
    avatarUrl: portrait("men", 32),
  }),
  makeConnection({
    id: "c-5",
    firstName: "Tom",
    lastName: "Becker",
    position: "VP Engineering",
    company: "Monzo",
    city: "London",
    country: "England",
    summary: "Scaled Monzo's platform team. Frequently hires grads and runs an internship program.",
    industry: "Financial Technology",
    seniority: "vp",
    skills: ["Platform", "Hiring", "Leadership"],
    avatarUrl: portrait("men", 51),
  }),
  makeConnection({
    id: "c-6",
    firstName: "Marco",
    lastName: "Rossi",
    position: "CTO",
    company: "Lumina AI",
    city: "Berlin",
    country: "Germany",
    summary: "CTO of a software startup building computer-vision products. Owns ~30% of the company.",
    industry: "Software",
    seniority: "c-suite",
    skills: ["Computer Vision", "ML", "Leadership"],
    avatarUrl: portrait("men", 64),
  }),
  makeConnection({
    id: "c-7",
    firstName: "Hannah",
    lastName: "Lee",
    position: "Technical Recruiter",
    company: "Google",
    city: "Dublin",
    country: "Ireland",
    summary: "Recruits software engineering interns and new grads for Google's EU offices.",
    industry: "Software",
    seniority: "ic",
    skills: ["Recruiting", "Interns", "Tech Hiring"],
    avatarUrl: portrait("women", 33),
  }),
  makeConnection({
    id: "c-8",
    firstName: "Ahmed",
    lastName: "Hassan",
    position: "Co-founder",
    company: "Beacon Labs",
    city: "Bristol",
    country: "England",
    summary: "Co-founded a software consultancy in the UK. Hires interns every summer.",
    industry: "Software",
    seniority: "founder",
    skills: ["Consulting", "Founders", "Hiring"],
    avatarUrl: portrait("men", 77),
  }),
  makeConnection({
    id: "c-9",
    firstName: "Priya",
    lastName: "Nair",
    position: "Data Scientist",
    company: "Spotify",
    city: "Stockholm",
    country: "Sweden",
    summary: "Works on recommendations. Happy to refer strong data/ML candidates.",
    industry: "Music Technology",
    seniority: "ic",
    skills: ["Data Science", "ML", "Python"],
    avatarUrl: portrait("women", 21),
  }),
  makeConnection({
    id: "c-10",
    firstName: "Daniel",
    lastName: "Schmidt",
    position: "Director of Engineering",
    company: "Datadog",
    city: "London",
    country: "England",
    summary: "Engineering director overseeing observability teams. Sponsors the grad scheme.",
    industry: "Software",
    seniority: "director",
    skills: ["Observability", "Leadership", "Hiring"],
    avatarUrl: portrait("men", 41),
  }),
  makeConnection({
    id: "c-11",
    firstName: "Sofia",
    lastName: "Marenko",
    position: "Early Talent Lead",
    company: "Revolut",
    city: "London",
    country: "England",
    summary: "Owns the internship pipeline at Revolut. Always looking for ambitious students.",
    industry: "Financial Technology",
    seniority: "manager",
    skills: ["Early Careers", "Internships", "Recruiting"],
    avatarUrl: portrait("women", 44),
  }),
  makeConnection({
    id: "c-12",
    firstName: "Noah",
    lastName: "Kim",
    position: "Founder",
    company: "Pixelforge",
    city: "Leeds",
    country: "England",
    summary: "Owns a small software studio building games tooling. Open to interns and contractors.",
    industry: "Software",
    seniority: "founder",
    skills: ["Game Dev", "Tooling", "Startups"],
    avatarUrl: portrait("men", 47),
  }),
];

/* -------------------------------------------------------------------------- */
/* Seed chat sessions for the sidebar                                          */
/* -------------------------------------------------------------------------- */

export const seedChatSessions: ChatSession[] = [
  {
    id: "s-1",
    title: "Software founders in England",
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    messages: [],
  },
  {
    id: "s-2",
    title: "Who can refer me for an internship?",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    messages: [],
  },
  {
    id: "s-3",
    title: "Recruiters at fintech companies",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    messages: [],
  },
];

/** Seniority labels for display. */
export const seniorityLabel: Record<Seniority, string> = {
  founder: "Founder",
  "c-suite": "C-Suite",
  vp: "VP",
  director: "Director",
  manager: "Manager",
  ic: "Individual Contributor",
};
