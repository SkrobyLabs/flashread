const slider = document.getElementById("wpm");
const val = document.getElementById("wpmVal");

chrome.storage.sync.get("wpm").then(({ wpm = 350 }) => {
  slider.value = wpm;
  val.textContent = `${wpm} wpm`;
});

slider.addEventListener("input", () => {
  val.textContent = `${slider.value} wpm`;
});
slider.addEventListener("change", () => {
  chrome.storage.sync.set({ wpm: Number(slider.value) });
});
