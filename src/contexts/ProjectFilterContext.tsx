import React, { createContext, useContext, useState } from 'react';

interface ProjectFilterContextType {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  executingProjects: any[];
  setExecutingProjects: (projects: any[]) => void;
}

const ProjectFilterContext = createContext<ProjectFilterContextType>({
  selectedProjectId: 'ALL',
  setSelectedProjectId: () => {},
  executingProjects: [],
  setExecutingProjects: () => {},
});

export function ProjectFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [executingProjects, setExecutingProjects] = useState<any[]>([]);
  return (
    <ProjectFilterContext.Provider value={{ selectedProjectId, setSelectedProjectId, executingProjects, setExecutingProjects }}>
      {children}
    </ProjectFilterContext.Provider>
  );
}

export function useProjectFilter() {
  return useContext(ProjectFilterContext);
}

