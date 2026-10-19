const needsTicket = new Set(["feat", "fix", "perf"]);

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "refs-trailer": ({ type, raw }) => {
          if (!needsTicket.has(type)) return [true];
          return [
            /^Refs: (MOR-\d+|CAL-\d+|none)$/m.test(raw),
            "feat, fix and perf commits end with a `Refs: MOR-n` trailer (`Refs: none` if there is no ticket)",
          ];
        },
      },
    },
  ],
  rules: { "refs-trailer": [2, "always"] },
};
