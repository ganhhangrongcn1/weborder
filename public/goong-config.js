window.GOONG_CONFIG = {
  // Dán REST API Key của Goong vào đây. Không dùng Maptiles key cho phần tính phí ship.
  apiKey: "G8qaLgCJjRNKnYN8Cw0e4Zt3XvTGeR7I7KC7orqy",
  mapTilesKey: "MFfDNcCDT4IFu4CCEr8ULhzUlzpplZDgBQD0aeBO",
  defaultBranchId: "branch-1",
  branches: [
    {
      id: "branch-1",
      name: "Chi nhánh 1: Đường 30/4",
      address: "227 Đường 30/4, Phường Phú Hòa, TP. Thủ Dầu Một",
      location: "10.980000,106.670000"
    }
  ],
  shopLocation: "10.980000,106.670000",
  vehicle: "motorcycle",
  fallbackVehicle: "car",
  geocodeEndpoint: "https://rsapi.goong.io/geocode",
  autocompleteEndpoint: "https://rsapi.goong.io/Place/AutoComplete",
  placeDetailEndpoint: "https://rsapi.goong.io/Place/Detail",
  distanceEndpoint: "https://rsapi.goong.io/v2/distancematrix",
  distanceFallbackEndpoint: "https://rsapi.goong.io/DistanceMatrix"
};
