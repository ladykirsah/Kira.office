// Parts set B (gluestack-ui, plan 11.1) is styled with class names through NativeWind (plan 11.3).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
