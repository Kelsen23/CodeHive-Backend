type ProtectedTechnicalEvidence = {
  text: string;
  blocks: string[];
  placeholders: string[];
};

const fencedTechnicalBlockPattern =
  /^ {0,3}(`{3,})(?!`)[^\r\n]*\r?\n[\s\S]*?^ {0,3}\1`*[ \t]*$|^ {0,3}(~{3,})(?!~)[^\r\n]*\r?\n[\s\S]*?^ {0,3}\2~*[ \t]*$/gm;

const protectTechnicalEvidence = (body: string): ProtectedTechnicalEvidence => {
  const blocks: string[] = [];
  const placeholderBase = "__QANOPY_TECHNICAL_BLOCK_";
  let placeholderPrefix = placeholderBase;

  while (new RegExp(`${placeholderPrefix}\\d+__`).test(body)) {
    placeholderPrefix += "_";
  }

  const placeholders: string[] = [];
  const text = body.replace(fencedTechnicalBlockPattern, (block) => {
    const index = blocks.push(block) - 1;
    const placeholder = `${placeholderPrefix}${index}__`;
    placeholders.push(placeholder);

    return placeholder;
  });

  return { text, blocks, placeholders };
};

const restoreTechnicalEvidence = (
  body: string,
  blocks: string[],
  placeholders = blocks.map(
    (_, index) => `__QANOPY_TECHNICAL_BLOCK_${index}__`,
  ),
): string => {
  if (placeholders.length !== blocks.length) {
    throw new Error(
      "Protected technical evidence placeholders do not match blocks",
    );
  }

  let restoredBody = body;

  blocks.forEach((block, index) => {
    const placeholder = placeholders[index];

    if (!placeholder) {
      throw new Error(
        `Missing placeholder for protected technical block ${index}`,
      );
    }

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
