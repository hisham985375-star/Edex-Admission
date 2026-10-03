"use client";

import { useState, useEffect } from "react";
import ProgramSelection from "./ProgramSelection";
import EGX100Experience from "./egx100/EGX100Experience";
import EdexNextExperience from "./edexnext/EdexNextExperience";

export default function AdmissionsExperience() {
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("edex_selected_program");
    if (saved) setSelectedProgram(saved);
  }, []);

  const handleSelect = (program: string) => {
    localStorage.setItem("edex_selected_program", program);
    setSelectedProgram(program);
  };

  if (!selectedProgram) {
    return <ProgramSelection onSelect={handleSelect} />;
  }

  if (selectedProgram === "EGX 100") {
    return <EGX100Experience onChangeProgram={() => setSelectedProgram(null)} />;
  }

  if (selectedProgram === "EDEX Next") {
    return <EdexNextExperience onChangeProgram={() => setSelectedProgram(null)} />;
  }

  return null;
}
