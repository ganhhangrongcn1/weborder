// Format legacy sample display names without changing stored records or identities.
export const employeeName = (name = "") => name.replace(/\s*·\s*Demo\b/g, "");
