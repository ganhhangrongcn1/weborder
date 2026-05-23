const apkDownloads = [
  {
    id: "ghr-pos-printer",
    appName: "GHR POS Printer",
    version: "GHR VER 3",
    updatedAt: "2026-05-23",
    platform: "Android POS",
    printerSupport: "Xprinter 80mm USB/LAN/WiFi",
    fileName: "GHR VER 3.apk",
    url: "https://qjaklysckgzdfjthzkzu.supabase.co/storage/v1/object/public/app-downloads/GHR%20VER%203.apk",
    notes: [
      "Dùng cho máy POS Android tại chi nhánh.",
      "Hỗ trợ in bill khách qua Supabase print_jobs.",
      "Hỗ trợ máy in Xprinter 80mm qua USB hoặc LAN/WiFi."
    ]
  }
];

export function getAppDownloads() {
  return apkDownloads;
}

export default getAppDownloads;
