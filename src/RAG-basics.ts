import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import "dotenv/config"; // loads .env at startup

const docs: Document[] = [
  new Document({
    pageContent:
      "Bella Vista is owned by Antonio Rossi, a renowned chef with over 20 years of experience in the culinary industry. He started Bella Vista to bring authentic Italian flavors to the community.",
    metadata: { source: "owner.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista offers a range of dishes with prices that cater to various budgets. Appetizers start at $8, main courses range from $15 to $35, and desserts are priced between $6 and $12.",
    metadata: { source: "dishes.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista is open from Monday to Sunday. Weekday hours are 11:00 AM to 10:00 PM, while weekend hours are extended from 11:00 AM to 11:00 PM.",
    metadata: { source: "restaurant_info.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista offers a variety of menus including a lunch menu, dinner menu, and a special weekend brunch menu. The lunch menu features light Italian fare, the dinner menu offers a more extensive selection of traditional and contemporary dishes, and the brunch menu includes both classic breakfast items and Italian specialties.",
    metadata: { source: "restaurant_info.txt" },
  }),
];

// 2. Create embeddings
const embeddings = new OpenAIEmbeddings();

// 3. Create in-memory vector store

async function main() {
  // Use MemoryVectorStore for reliable in-memory storage
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

  // Now you can run similarity search
  const results = await vectorStore.similaritySearch(
    "What are the hours on Sunday?",
    2
  );

  for (const doc of results) {
    console.log("Match:", doc.pageContent);
    console.log("Metadata:", doc.metadata);
  }
}

main();
