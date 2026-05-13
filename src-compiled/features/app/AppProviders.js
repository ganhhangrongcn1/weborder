import useAppProviders from "./useAppProviders.js";
export default function AppProviders({
  children
}) {
  const providers = useAppProviders();
  return typeof children === "function" ? children(providers) : null;
}