import bus from "../assets/transport/bus.png";
import van from "../assets/transport/van.png";
import boat from "../assets/transport/boat.png";

const TYPE_IMAGES = {
  bus,
  van,
  minivan: van,
  boat,
  ferry: boat,
};

export const transportImage = (type) =>
  TYPE_IMAGES[String(type || "").toLowerCase()] ?? bus;
