import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const homebaseTimeFormat = {
  name: "homebase-12-hour-time",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith("/src/main.jsx")) return null;
    return {
      code: code
        .replace('hour12: false', 'hour12: true')
        .replace('event.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })', 'event.start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })'),
      map: null
    };
  }
};

export default defineConfig({
  base: "/Homebase/",
  plugins: [homebaseTimeFormat, react()]
});
