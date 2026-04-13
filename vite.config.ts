import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return "react";
          if (id.includes("@supabase")) return "supabase";
          if (/react-hook-form|@hookform|zod/.test(id)) return "forms";
          if (/i18next|react-i18next/.test(id)) return "i18n";
          if (/react-day-picker|date-fns/.test(id)) return "datepicker";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("jspdf")) return "jspdf";
          if (id.includes("html-to-image")) return "html-to-image";
        },
      },
    },
  },
});
