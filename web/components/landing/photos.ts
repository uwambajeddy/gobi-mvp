import type { StaticImageData } from "next/image";

import bridgeTanker from "@/public/landing/bridge-tanker.webp";
import corridorRoad from "@/public/landing/corridor-road.webp";
import heroPortStorm from "@/public/landing/hero-port-storm.webp";
import portContainer from "@/public/landing/port-container.webp";
import portCrew from "@/public/landing/port-crew.webp";
import portTruck from "@/public/landing/port-truck.webp";
import sunsetRoad from "@/public/landing/sunset-road.webp";

export interface LandingPhoto {
  src: StaticImageData;
  /** Short title used in the photo credits. */
  title: string;
  alt: string;
  /** Where the photo was taken, shown as a caption tag. */
  place: string;
  credit: { author: string; license: string; licenseUrl?: string; source: string };
}

const MEAACT = "Kenyan Ministry of East African Affairs, Commerce and Tourism (MEAACT)";
const CC_BY_SA = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };

/**
 * Landing-page photography from Wikimedia Commons, resized and converted to
 * WebP. Every photo is credited in the page footer as its licence requires.
 */
export const PHOTOS = {
  portTruck: {
    src: portTruck,
    title: "Container transfer at the quay",
    alt: "A terminal tractor moving a Maersk container beside the cranes at the Port of Mombasa",
    place: "Port of Mombasa, Kenya",
    credit: {
      author: MEAACT,
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0020.jpg",
    },
  },
  portCrew: {
    src: portCrew,
    title: "Port crew between the stacks",
    alt: "Two port workers in safety vests walking between container stacks and trucks at the Port of Mombasa",
    place: "Port of Mombasa, Kenya",
    credit: {
      author: MEAACT,
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0035.jpg",
    },
  },
  portContainer: {
    src: portContainer,
    title: "Container truck at the terminal",
    alt: "A worker in orange overalls walking past a container truck at the Port of Mombasa",
    place: "Port of Mombasa, Kenya",
    credit: {
      author: MEAACT,
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0042.jpg",
    },
  },
  corridorRoad: {
    src: corridorRoad,
    title: "Road through tea country",
    alt: "A truck on a road winding through tea plantations near Fort Portal, Uganda",
    place: "Fort Portal, Uganda",
    credit: {
      author: "Jameswasswa",
      ...CC_BY_SA,
      source: "https://commons.wikimedia.org/wiki/File:Roads_to_Tomorrow,_Framing_Uganda%E2%80%99s_Future.jpg",
    },
  },
  bridgeTanker: {
    src: bridgeTanker,
    title: "Tanker on the Nyabugogo bridge",
    alt: "A fuel tanker crossing a bridge over the Nyabugogo River in Kigali while a cyclist waits",
    place: "Kigali, Rwanda",
    credit: { author: "Mrbobax", ...CC_BY_SA, source: "https://commons.wikimedia.org/wiki/File:Big_Truck_Passing_on_the_bridge.jpg" },
  },
  sunsetRoad: {
    src: sunsetRoad,
    title: "Open road at sunset",
    alt: "A truck on an open road in Tanzania with mountains at sunset",
    place: "Tanzania",
    credit: {
      author: "RahimMngwaya",
      ...CC_BY_SA,
      source: "https://commons.wikimedia.org/wiki/File:A_transportation_van_at_sunset.jpg",
    },
  },
} satisfies Record<string, LandingPhoto>;

/**
 * Backdrop of the landing hero and the auth panel. It has no Commons credit,
 * so it stays out of PHOTOS and the footer credits.
 */
export const HERO_PHOTO = {
  src: heroPortStorm,
  alt: "A red truck hauling containers under a port crane on a rain-soaked quay beneath a stormy sky",
};

/** Every landing photo, in credit order. */
export const PHOTO_LIST: LandingPhoto[] = Object.values(PHOTOS);
