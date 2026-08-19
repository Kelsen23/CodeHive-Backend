import llmGateway from "../../llmGateway/llmGateway.service.js";

const generateEmbedding = async (text: string) => {
  const response = await llmGateway.embed({
    input: text,
    inputType: "document",
  });

  return {
    embedding: response.embedding,
    model: response.metadata.model,
  };
};

export default generateEmbedding;
