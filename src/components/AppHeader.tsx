const openSettings = (
  section: "profile" | "appearance" | "company"
) => {
  setMenuVisible(false);

  console.log("Opening:", section);

  router.push({
    pathname: "/(tabs)/settings",
    params: { section },
  });
};