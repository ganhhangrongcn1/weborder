export default function TrackingContainer({ trackingRender: TrackingRender, ...props }) {
  if (!TrackingRender) return null;
  return <TrackingRender {...props} />;
}

