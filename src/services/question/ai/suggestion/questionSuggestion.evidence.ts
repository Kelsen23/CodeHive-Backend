type ProtectedTechnicalEvidence = {
  text: string;
  blocks: string[];
  placeholders: string[];
};

type BodyLine = {
  start: number;
  contentEnd: number;
  content: string;
};

const getBodyLines = (body: string): BodyLine[] => {
  const lines: BodyLine[] = [];
  let start = 0;

  while (start < body.length) {
    const newlineIndex = body.indexOf("\n", start);
    const end = newlineIndex < 0 ? body.length : newlineIndex + 1;
    const newlineLength = body[end - 2] === "\r" ? 2 : end > start ? 1 : 0;

    lines.push({
      start,
      contentEnd: end - newlineLength,
      content: body.slice(start, end - newlineLength),
    });
    start = end;
  }

  return lines;
};

const stripMarkdownContainerPrefix = (line: string): string => {
  let content = line;

  while (true) {
    const prefix = content.match(
      /^(?: {0,3}>[ \t]?| {0,3}(?:[-+*]|\d+[.)])[ \t]+)/,
    );

    if (!prefix) return content;
    content = content.slice(prefix[0].length);
  }
};

const getOpeningFence = (line: string) => {
  const content = stripMarkdownContainerPrefix(line);
  const match = content.match(/^ {0,3}(`{3,})(?!`)|^ {0,3}(~{3,})(?!~)/);

  if (!match?.[1] && !match?.[2]) return undefined;

  const fence = match[1] ?? match[2];

  return { character: fence[0], length: fence.length };
};

const isClosingFence = (
  line: string,
  openingFence: { character: string; length: number },
) => {
  const content = stripMarkdownContainerPrefix(line);
  const match = content.match(/^ {0,3}([`~]+)[ \t]*$/);

  if (!match) return false;

  const closingFence = match[1];

  return (
    closingFence[0] === openingFence.character &&
    closingFence.length >= openingFence.length
  );
};

const findTechnicalEvidenceRanges = (body: string) => {
  const lines = getBodyLines(body);
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const openingFence = getOpeningFence(lines[index].content);

    if (!openingFence) continue;

    let end = body.length;
    let lastIndex = lines.length - 1;

    for (
      let closingIndex = index + 1;
      closingIndex < lines.length;
      closingIndex += 1
    ) {
      if (isClosingFence(lines[closingIndex].content, openingFence)) {
        end = lines[closingIndex].contentEnd;
        lastIndex = closingIndex;
        break;
      }
    }

    ranges.push({ start: lines[index].start, end });
    index = lastIndex;
  }

  return ranges;
};

const protectTechnicalEvidence = (body: string): ProtectedTechnicalEvidence => {
  const ranges = findTechnicalEvidenceRanges(body);
  const blocks = ranges.map(({ start, end }) => body.slice(start, end));
  const placeholderBase = "__QANOPY_TECHNICAL_BLOCK_";
  let placeholderPrefix = placeholderBase;

  while (new RegExp(`${placeholderPrefix}\\d+__`).test(body)) {
    placeholderPrefix += "_";
  }

  const placeholders = blocks.map(
    (_, index) => `${placeholderPrefix}${index}__`,
  );
  let text = "";
  let cursor = 0;

  ranges.forEach(({ start, end }, index) => {
    text += body.slice(cursor, start);
    text += placeholders[index];
    cursor = end;
  });
  text += body.slice(cursor);

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
