
export function generateTicket() {
  const ticket = Array.from({ length: 3 }, () =>
    Array(9).fill(null)
  );

  const columns = Array.from({ length: 9 }, (_, i) => {
    const start = i === 0 ? 1 : i * 10;
    const end = i === 8 ? 90 : i * 10 + 9;

    return Array.from(
      { length: end - start + 1 },
      (_, j) => start + j
    );
  });

  // Choose 5 columns for each row initially,
  // then ensure each column has at least one number.
  const rowCounts = [5, 5, 5];
  const colCounts = Array(9).fill(0);

  for (let row = 0; row < 3; row++) {
    const chosen = new Set();

    while (chosen.size < 5) {
      chosen.add(Math.floor(Math.random() * 9));
    }

    for (const col of chosen) {
      ticket[row][col] = true;
      colCounts[col]++;
    }
  }

  // Fill any empty columns while preserving 15 numbers total.
  for (let col = 0; col < 9; col++) {
    if (colCounts[col] === 0) {
      const row = Math.floor(Math.random() * 3);
      const otherCol = ticket[row].findIndex(
        (value, index) => value === true && colCounts[index] > 1
      );

      if (otherCol !== -1) {
        ticket[row][otherCol] = null;
        colCounts[otherCol]--;
        ticket[row][col] = true;
        colCounts[col]++;
      }
    }
  }

  // Replace selected positions with valid numbers.
  for (let col = 0; col < 9; col++) {
    const rows = [0, 1, 2].filter(
      (row) => ticket[row][col] === true
    );

    const nums = columns[col]
      .sort(() => Math.random() - 0.5)
      .slice(0, rows.length)
      .sort((a, b) => a - b);

    rows.forEach((row, index) => {
      ticket[row][col] = nums[index];
    });
  }

  return ticket;
}

