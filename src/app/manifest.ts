import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "zibataWear — Moda Universitaria en Zibatá",
    short_name: "zibataWear",
    description:
      "Compra, vende y renta ropa entre universitarios en Zibatá y Campus Anáhuac Querétaro.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
