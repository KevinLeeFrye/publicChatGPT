(() => {
  const hourHand = document.getElementById('hourHand');
  const minuteHand = document.getElementById('minuteHand');
  const secondHand = document.getElementById('secondHand');
  const liveTime = document.getElementById('liveTime');
  const year = document.getElementById('year');

  if (year) year.textContent = new Date().getFullYear();

  function updateWatch() {
    const now = new Date();
    const ms = now.getMilliseconds();
    const seconds = now.getSeconds() + ms / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    if (secondHand) secondHand.style.transform = `rotate(${seconds * 6}deg)`;
    if (minuteHand) minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
    if (hourHand) hourHand.style.transform = `rotate(${hours * 30}deg)`;
    if (liveTime) liveTime.textContent = now.toLocaleTimeString([], { hour12: false });
    requestAnimationFrame(updateWatch);
  }

  updateWatch();
})();
