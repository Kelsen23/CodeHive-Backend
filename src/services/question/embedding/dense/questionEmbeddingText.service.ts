import crypto from "crypto";

import normalizeText from "../../../../utils/question/normalizeText.util.js";

const buildQuestionEmbeddingInput = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => {
  const text = `Title: ${normalizeText(title)}\nBody: ${normalizeText(body)}`;
  const hash = crypto.createHash("sha256").update(text).digest("hex");

  return { text, hash };
};

export default buildQuestionEmbeddingInput;
