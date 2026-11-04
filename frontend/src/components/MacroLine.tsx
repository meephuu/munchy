/** One ingredient's protein, carbs and fat in the design's macro colors (protein green, carbs bronze, fat terracotta). */
export function MacroLine({
  protein,
  carbs,
  fat,
  className = "",
}: {
  protein: number;
  carbs: number;
  fat: number;
  className?: string;
}) {
  const g = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  return (
    <span className={`flex flex-wrap gap-x-2.5 font-mono text-[10px] ${className}`}>
      <span className="text-green">P {g(protein)}g</span>
      <span className="text-bronze">C {g(carbs)}g</span>
      <span className="text-terracotta-text">F {g(fat)}g</span>
    </span>
  );
}
