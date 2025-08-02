import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import "dotenv/config"; // loads .env at startup

const embeddingFunction = new OpenAIEmbeddings();

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

// RAG prompt template (equivalent to hub.pull("rlm/rag-prompt"))
const prompt =
  ChatPromptTemplate.fromTemplate(`You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.

Question: {question}

Context: {context}

Answer:`);

function formatDocs(docs: Document[]): string {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

async function main() {
  // Neon database configuration
  const connectionString = process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL environment variable is required");
  }

  // Parse the connection string to get connection options
  const url = new URL(connectionString);

  const vectorStore = await PGVectorStore.fromDocuments(
    docs,
    embeddingFunction,
    {
      postgresConnectionOptions: {
        host: url.hostname,
        port: Number(url.port) || 5432,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading slash
        ssl: true,
      },
      tableName: "bella_vista_docs",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    }
  );

  // retriever = db.as_retriever()
  const retriever = vectorStore.asRetriever({ k: 2 });

  const qaChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
    },
    prompt,
    new ChatOpenAI(),
    new StringOutputParser(),
  ]);

  const result = await qaChain.invoke("When are the opening hours?");

  console.log(result);
}

main();
