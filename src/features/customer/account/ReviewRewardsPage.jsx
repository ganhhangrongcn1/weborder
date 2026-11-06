import ReviewRewardPanel from "../../account/components/ReviewRewardPanel.jsx";

export default function ReviewRewardsPage({ navigate, branches = [] }) {
  return (
    <ReviewRewardPanel
      variant="page"
      showHistory
      onBack={() => {
        if (window.history.state?.idx > 0) window.history.back();
        else navigate("home", "home");
      }}
      onLogin={() => navigate("account", "account")}
      branches={branches}
    />
  );
}
