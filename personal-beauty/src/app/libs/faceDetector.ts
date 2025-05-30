export const drawInstructions = (
  ctx: CanvasRenderingContext2D,
  countdownActive: boolean,
  countdownValue: number,
  width: number,
  height: number
) => {
  // Clear the canvas first
  ctx.clearRect(0, 0, width, height);

  // Draw face outline guide
  const faceSize = Math.min(width, height) * 0.4;

  // Create a path for the entire canvas
  ctx.beginPath();
  ctx.rect(0, 0, width, height);

  // Create a cutout for the ellipse (face area)
  ctx.beginPath();
  // First create the outer rectangle (entire canvas)
  ctx.rect(0, 0, width, height);
  // Then create the ellipse cutout
  ctx.ellipse(
    width / 2,
    height / 2,
    faceSize / 1.5,
    faceSize / 1.2,
    0,
    0,
    Math.PI * 2
  );
  // Use "evenodd" fill rule to create the cutout effect
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fill("evenodd");

  // Draw the ellipse outline
  ctx.strokeStyle = "rgba(76, 175, 80, 1)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.setLineDash([10, 5]);
  ctx.ellipse(
    width / 2,
    height / 2,
    faceSize / 1.5,
    faceSize / 1.2,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // Text styling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Main instruction
  ctx.font = "bold 24px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Look straight at the camera", width / 2, height - 80);
  ctx.fillText("Don't blink or move", width / 2, height - 40);

  // Countdown display
  if (countdownActive) {
    ctx.font = "bold 72px Arial";
    ctx.fillStyle = "rgba(255, 64, 129, 0.5)"; // Pink color with 0.5 opacity
    ctx.fillText(countdownValue.toString(), width / 2, height / 2 + 80);
  }
};
