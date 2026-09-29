import type { Project } from "./types";

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function filterProjects(projects: Project[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return projects;
  return projects.filter((project) => normalizeSearchText([
    project.name,
    project.description,
    project.environment,
    project.sprintNo,
    project.googleSheetUrl,
    project.googleSheetId,
  ].join(" ")).includes(normalizedQuery));
}
