export const TRANSPORT_IMAGES = {
  bus: require("../assets/transport/bus.png"),
  van: require("../assets/transport/van.png"),
  minivan: require("../assets/transport/van.png"),
  boat: require("../assets/transport/boat.png"),
  ferry: require("../assets/transport/boat.png"),
};

export const getTransportImage = (type) =>
  TRANSPORT_IMAGES[String(type || "").toLowerCase()] || null;
