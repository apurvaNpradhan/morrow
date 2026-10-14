import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "tsc",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
    },
  },
});
