type ProtectedTechnicalEvidence = {
  text: string;
  blocks: string[];
};

const fencedTechnicalBlockPattern =
  /^ {0,3}(`{3,})[^\r\n]*\r?\n[\s\S]*?^ {0,3}\1`*[ \t]*$|^ {0,3}(~{3,})[^\r\n]*\r?\n[\s\S]*?^ {0,3}\2~*[ \t]*$/gm;

const protectTechnicalEvidence = (body: string): ProtectedTechnicalEvidence => {
  const blocks: string[] = [];
  const text = body.replace(fencedTechnicalBlockPattern, (block) => {
    const index = blocks.push(block) - 1;

    return `__QANOPY_TECHNICAL_BLOCK_${index}__`;
  });

  return { text, blocks };
};

const restoreTechnicalEvidence = (body: string, blocks: string[]): string => {
  let restoredBody = body;

  blocks.forEach((block, index) => {
    const placeholder = `__QANOPY_TECHNICAL_BLOCK_${index}__`;
    const occurrences = restoredBody.split(placeholder).length - 1;

    if (occurrences !== 1) {
      throw new Error(
        `Protected technical evidence placeholder ${placeholder} must occur exactly once; found ${occurrences}`,
      );
    }

    restoredBody = restoredBody.replace(placeholder, block);
  });

  return restoredBody;
};

export { protectTechnicalEvidence, restoreTechnicalEvidence };
export type { ProtectedTechnicalEvidence };
