type ProtectedTechnicalEvidence = {
  text: string;
  blocks: string[];
};

const fencedTechnicalBlockPattern =
  /^(`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*?^\1[ \t]*$/gm;

const protectTechnicalEvidence = (body: string): ProtectedTechnicalEvidence => {
  const blocks: string[] = [];
  const text = body.replace(fencedTechnicalBlockPattern, (block) => {
    const index = blocks.push(block) - 1;

    return `__QANOPY_TECHNICAL_BLOCK_${index}__`;
  });

  return { text, blocks };
};

const restoreTechnicalEvidence = (body: string, blocks: string[]): string =>
  blocks.reduce(
    (restoredBody, block, index) =>
      restoredBody.replaceAll(`__QANOPY_TECHNICAL_BLOCK_${index}__`, block),
    body,
  );

export { protectTechnicalEvidence, restoreTechnicalEvidence };
export type { ProtectedTechnicalEvidence };
