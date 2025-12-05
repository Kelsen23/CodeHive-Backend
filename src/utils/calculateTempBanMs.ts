const calculateTempBanMs = (severity: number, confidence: number): number => {
  if (severity < 70) return 0;

  const hours = (severity - 60) * (1 + confidence);
  return hours * 60 * 60 * 1000;
};

export default calculateTempBanMs;
