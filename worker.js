self.addEventListener("message", (event) => {
  const duration = Number(event.data.duration);
  const startedAt = performance.now();
  let iterations = 0;

  while (performance.now() - startedAt < duration) {
    iterations += 1;
    Math.sqrt(iterations);
  }

  self.postMessage({
    iterations,
    duration: Math.round(performance.now() - startedAt)
  });
});
