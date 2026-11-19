const config = {
  appId: "com.zibatawear.app",
  appName: "zibataWear",
  webDir: "out",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://zibatawear.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
