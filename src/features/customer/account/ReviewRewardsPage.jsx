import ReviewRewardPanel from "../../account/components/ReviewRewardPanel.jsx";

export default function ReviewRewardsPage({ navigate, branches = [] }) {
  return (
    <ReviewRewardPanel
      variant="page"
      showHistory
      onBack={() => navigate("home", "home")}
      onLogin={() => navigate("account", "account")}
      branches={branches}
    />
  );
}
