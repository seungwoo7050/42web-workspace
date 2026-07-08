import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import contactJson from "../../tests/fixtures/content/contact.json";
import curationJson from "../../tests/fixtures/content/curation.json";
import experienceJson from "../../tests/fixtures/content/experience.json";
import interviewMapJson from "../../tests/fixtures/content/interview-map.json";
import journeyJson from "../../tests/fixtures/content/journey.json";
import journeyNarrativeJson from "../../tests/fixtures/content/journey-narrative.json";
import linksJson from "../../tests/fixtures/content/links.json";
import presentationJson from "../../tests/fixtures/content/presentation.json";
import profileJson from "../../tests/fixtures/content/profile.json";
import projectsJson from "../../tests/fixtures/content/projects.json";
import resumeJson from "../../tests/fixtures/content/resume.json";
import siteJson from "../../tests/fixtures/content/site.json";
import skillsJson from "../../tests/fixtures/content/skills.json";
import techStackJson from "../../tests/fixtures/content/tech-stack.json";
import { validatePortfolioAssets } from "./content-assets";
import { loadPortfolioSource } from "./content-loader";

function loadFixtureSource() {
  return loadPortfolioSource({
    site: siteJson,
    profile: profileJson,
    projects: projectsJson,
    presentation: presentationJson,
    skills: skillsJson,
    techStack: techStackJson,
    experience: experienceJson,
    journey: journeyJson,
    links: linksJson,
    contact: contactJson,
    resume: resumeJson,
    journeyNarrative: journeyNarrativeJson,
    interviewMap: interviewMapJson,
    curation: curationJson,
  });
}

describe("visual fixture content", () => {
  it("passes the same schema and reference checks as real content", () => {
    expect(() => loadFixtureSource()).not.toThrow();
  });

  it("keeps every referenced asset inside the fixture public directory", () => {
    const fixturePublicRoot = resolve(process.cwd(), "tests/fixtures/public");

    expect(() =>
      validatePortfolioAssets(loadFixtureSource(), fixturePublicRoot),
    ).not.toThrow();
  });

  it("keeps the stable snapshot target and the harsh cases", () => {
    const source = loadFixtureSource();
    const [sample] = source.projects.items;

    expect(sample.id).toBe("visual-sample");
    expect(sample.screenshots).toEqual([]);
    expect(source.profile.photo).toBeUndefined();
    expect(source.projects.items.length).toBeGreaterThan(1);
  });
});
