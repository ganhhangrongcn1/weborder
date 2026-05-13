import { useState } from "react";

export default function useAdminNavigationState() {
  const [section, setSection] = useState("dashboard");
  const [activeAdminNav, setActiveAdminNav] = useState("dashboard-main");
  const [activeSubSection, setActiveSubSection] = useState("ui");
  const [activeCampaignTab, setActiveCampaignTab] = useState("discount");

  return {
    section,
    setSection,
    activeAdminNav,
    setActiveAdminNav,
    activeSubSection,
    setActiveSubSection,
    activeCampaignTab,
    setActiveCampaignTab
  };
}
