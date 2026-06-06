import { describe, it, expect } from "vitest";
import { normalizeLinkedInUrl, firstUrl } from "./url";
import { normalizeCountry, normalizeCompany } from "./normalize";
import { inferSeniority } from "./seniority";
import { buildProfileText } from "./profile-text";
import { relationshipStrength } from "./relationships";

describe("normalizeLinkedInUrl", () => {
  it("strips protocol, www, trailing slash, query, and lowercases", () => {
    const variants = [
      "https://www.linkedin.com/in/Ilhan-Toygan/",
      "http://linkedin.com/in/ilhan-toygan",
      "www.linkedin.com/in/ilhan-toygan?utm=1",
      "linkedin.com/in/ilhan-toygan/#section",
    ];
    for (const v of variants) {
      expect(normalizeLinkedInUrl(v)).toBe("linkedin.com/in/ilhan-toygan");
    }
  });
  it("returns null for empty input", () => {
    expect(normalizeLinkedInUrl(null)).toBeNull();
    expect(normalizeLinkedInUrl("   ")).toBeNull();
  });
});

describe("firstUrl", () => {
  it("takes the first of several urls", () => {
    expect(firstUrl("https://a.com/x https://b.com/y")).toBe("https://a.com/x");
    expect(firstUrl("https://a.com/x, https://b.com/y")).toBe("https://a.com/x");
    expect(firstUrl(null)).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("maps UK variants to 'united kingdom'", () => {
    expect(normalizeCountry("London, England, United Kingdom")).toBe("united kingdom");
    expect(normalizeCountry("Greater London")).toBe("united kingdom");
    expect(normalizeCountry("Manchester, England")).toBe("united kingdom");
  });
  it("maps US variants to 'united states'", () => {
    expect(normalizeCountry("San Francisco, California, United States")).toBe("united states");
    expect(normalizeCountry("New York, USA")).toBe("united states");
  });
  it("falls back to last segment otherwise", () => {
    expect(normalizeCountry("Berlin, Germany")).toBe("germany");
    expect(normalizeCountry(null)).toBeNull();
  });
});

describe("normalizeCompany", () => {
  it("strips legal suffixes and country qualifiers", () => {
    expect(normalizeCompany("Google LLC")).toBe("google");
    expect(normalizeCompany("Google UK")).toBe("google");
    expect(normalizeCompany("Acme Corp.")).toBe("acme");
    expect(normalizeCompany("Holonomy")).toBe("holonomy");
  });
  it("does not over-strip single-token names", () => {
    expect(normalizeCompany("Co")).toBe("co");
    expect(normalizeCompany(null)).toBeNull();
  });
});

describe("inferSeniority", () => {
  it("classifies titles", () => {
    expect(inferSeniority("Co-Founder and CEO")).toBe("founder");
    expect(inferSeniority("Owner")).toBe("founder");
    expect(inferSeniority("President")).toBe("founder");
    expect(inferSeniority("Vice President of Sales")).toBe("vp");
    expect(inferSeniority("VP Engineering")).toBe("vp");
    expect(inferSeniority("CTO")).toBe("c-suite");
    expect(inferSeniority("Head of Product")).toBe("director");
    expect(inferSeniority("Engineering Director")).toBe("director");
    expect(inferSeniority("Senior Manager")).toBe("manager");
    expect(inferSeniority("Software Engineer")).toBe("ic");
    expect(inferSeniority("")).toBe("ic");
  });
});

describe("buildProfileText", () => {
  it("includes core fields and omits empty sections", () => {
    const text = buildProfileText({
      fullName: "Ada Lovelace",
      position: "CTO",
      company: "Analytical Engines",
      country: "united kingdom",
      skills: ["mathematics", "computing"],
    });
    expect(text).toContain("Ada Lovelace, CTO at Analytical Engines.");
    expect(text).toContain("Location: united kingdom.");
    expect(text).toContain("Skills: mathematics, computing.");
    expect(text).not.toContain("About:");
    expect(text).not.toContain("Experience:");
  });
});

describe("relationshipStrength", () => {
  const now = new Date("2026-06-05T00:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("returns 'none' for no messages", () => {
    expect(
      relationshipStrength(
        { messageCount: 0, sentCount: 0, receivedCount: 0, firstContacted: null, lastContacted: null },
        now,
      ),
    ).toBe("none");
  });

  it("high count + recent = close", () => {
    expect(
      relationshipStrength(
        { messageCount: 12, sentCount: 12, receivedCount: 0, firstContacted: ago(40), lastContacted: ago(10) },
        now,
      ),
    ).toBe("close");
  });

  it("recent low count = active; bidirectional bumps to close", () => {
    const oneWay = { messageCount: 3, sentCount: 3, receivedCount: 0, firstContacted: ago(20), lastContacted: ago(10) };
    expect(relationshipStrength(oneWay, now)).toBe("active");
    expect(relationshipStrength({ ...oneWay, receivedCount: 1 }, now)).toBe("close");
  });

  it("within a year = warm; older = dormant", () => {
    expect(
      relationshipStrength(
        { messageCount: 5, sentCount: 5, receivedCount: 0, firstContacted: ago(300), lastContacted: ago(200) },
        now,
      ),
    ).toBe("warm");
    expect(
      relationshipStrength(
        { messageCount: 5, sentCount: 5, receivedCount: 0, firstContacted: ago(600), lastContacted: ago(500) },
        now,
      ),
    ).toBe("dormant");
  });
});
