import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";
import {
  BELLA_VISTA_COLUMNS,
  BELLA_VISTA_DOCS_TABLE,
  connectionString,
  poolConfig,
  seedBellaVistaDocEmbeddings,
} from "./utils/bella-vista";

import "dotenv/config"; // loads .env at startup

const embeddingFunction = new OpenAIEmbeddings();

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
  // Ensure the database is seeded
  await seedBellaVistaDocEmbeddings();

  // Create connection pool for querying
  const pool = new Pool(poolConfig);

  const vectorStore = new PGVectorStore(embeddingFunction, {
    pool,
    tableName: BELLA_VISTA_DOCS_TABLE,
    columns: BELLA_VISTA_COLUMNS,
  });

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

  await vectorStore.end(); // automatically closes the pool as well
}

main();
